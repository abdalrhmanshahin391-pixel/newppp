import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Exercise the actual authenticated handlers with a fake owner-scoped database and Paddle.
// No credentials, network requests, real card deletion or subscription changes are involved.
const root = fileURLToPath(new URL("../../", import.meta.url));
const compiled = await build({
  entryPoints: [resolve(root, "src/lib/subscription.functions.ts")],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  alias: { "@": resolve(root, "src") },
  plugins: [
    {
      name: "billing-test-boundaries",
      setup(builder) {
        builder.onResolve(
          { filter: /(^@tanstack\/react-start$|legacy-auth-middleware$|paddle\.server$)/ },
          (args) => ({ path: args.path, namespace: "test-boundary" }),
        );
        builder.onLoad({ filter: /.*/, namespace: "test-boundary" }, ({ path }) => ({
          contents:
            path === "@tanstack/react-start"
              ? "export function createServerFn(){let validate=x=>x;const chain={middleware:()=>chain,inputValidator(fn){validate=fn;return chain},handler:fn=>async args=>fn({...args,data:validate(args.data)})};return chain}"
              : path.endsWith("legacy-auth-middleware")
                ? "export const requireSupabaseAuth={};"
                : "export const gatewayFetch=(...args)=>globalThis.__settingsBillingGateway(...args);",
        }));
      },
    },
  ],
});
type Result = { ok: boolean; code?: string; renewalStopped: boolean; cardRemoved: boolean };
type Handler = (input: { data: Record<string, string>; context: unknown }) => Promise<Result>;
const handlers = (await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
)) as { removeSavedPaymentMethod: Handler; cancelSubscription: Handler };
const owner = "11111111-1111-4111-8111-111111111111";
const cardId = "22222222-2222-4222-8222-222222222222";

function setup(providerFails = false, owned = true) {
  const state = {
    card: {
      id: cardId,
      user_id: owned ? owner : "another-owner",
      paddle_customer_id: "ctm_owned",
      paddle_payment_method_id: "pmt_owned",
      environment: "sandbox",
    },
    sub: {
      id: "row-owned",
      user_id: owner,
      paddle_subscription_id: "sub_owned",
      status: "active",
      environment: "sandbox",
      cancel_at_period_end: false,
    },
    rpcCalls: 0,
    deletes: 0,
    paths: [] as string[],
    environments: [] as string[],
  };
  const fetchProvider = async (environment: string, path: string) => {
    state.paths.push(path);
    state.environments.push(environment);
    return providerFails
      ? new Response("failure", { status: 503 })
      : new Response(null, { status: 204 });
  };
  (
    globalThis as typeof globalThis & { __settingsBillingGateway?: typeof fetchProvider }
  ).__settingsBillingGateway = fetchProvider;
  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let deleting = false;
      const finish = () => {
        const row = table === "customer_payment_methods" ? state.card : state.sub;
        const matches = Object.entries(filters).every(
          ([key, value]) => row[key as keyof typeof row] === value,
        );
        if (deleting && matches) state.deletes++;
        return { data: matches ? row : null, error: null };
      };
      const chain = {
        select: () => chain,
        eq(key: string, value: unknown) {
          filters[key] = value;
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => finish(),
        single: async () => finish(),
        delete() {
          deleting = true;
          return chain;
        },
        then(done: (value: ReturnType<typeof finish>) => unknown) {
          return Promise.resolve(finish()).then(done);
        },
      };
      return chain;
    },
    async rpc() {
      state.rpcCalls++;
      state.sub.cancel_at_period_end = true;
      return { error: null };
    },
  };
  return { state, context: { userId: owner, supabase: client } };
}
test("an unowned card is rejected before any provider operation", async () => {
  const { state, context } = setup(false, false);
  await assert.rejects(
    handlers.removeSavedPaymentMethod({ data: { cardId }, context }),
    /not found on your account/,
  );
  assert.deepEqual(state.paths, []);
  assert.equal(state.deletes, 0);
});
test("client-supplied customer and payment IDs never control a provider deletion", async () => {
  const { state, context } = setup();
  const result = await handlers.removeSavedPaymentMethod({
    data: {
      cardId,
      paddleCustomerId: "ctm_foreign",
      paddlePaymentMethodId: "pmt_foreign",
      paddleSubscriptionId: "sub_foreign",
    },
    context,
  });
  assert.equal(result.ok, true);
  assert.equal(state.deletes, 1);
  assert.deepEqual(state.paths, [
    "/subscriptions/sub_owned/cancel",
    "/customers/ctm_owned/payment-methods/pmt_owned",
  ]);
  assert.deepEqual(state.environments, ["sandbox", "sandbox"]);
});
test("the handler does not mutate local billing state when Paddle cannot confirm cancellation", async () => {
  const { state, context } = setup(true);
  const result = await handlers.removeSavedPaymentMethod({ data: { cardId }, context });
  assert.equal(result.ok, false);
  assert.equal(result.code, "provider_failed");
  assert.equal(state.rpcCalls, 0);
  assert.equal(state.deletes, 0);
  assert.equal(state.sub.cancel_at_period_end, false);
});
test("a subscription outside the authenticated account cannot be cancelled", async () => {
  const { state, context } = setup();
  await assert.rejects(
    handlers.cancelSubscription({ data: { paddleSubscriptionId: "sub_foreign" }, context }),
    /not found on your account/,
  );
  assert.deepEqual(state.paths, []);
  assert.equal(state.rpcCalls, 0);
});
