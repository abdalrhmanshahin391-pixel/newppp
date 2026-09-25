import { resolvePaddlePrice } from "@/utils/payments.functions";

const liveClientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
const testClientToken = import.meta.env.VITE_PAYMENTS_TEST_CLIENT_TOKEN as string | undefined;
/** While the live account is still being reviewed every checkout runs in test mode. */
const forceTest = String(import.meta.env.VITE_PAYMENTS_FORCE_TEST ?? "") === "1";

export type PayEnv = "sandbox" | "live";

export type PaddleEventCallback = (event: { name: string; data?: any }) => void;

declare global {
  interface Window {
    Paddle: any;
  }
}

/** The environment every payment form must open in. */
export function getPaddleEnvironment(): PayEnv {
  if (forceTest) return "sandbox";
  if (testClientToken && !liveClientToken?.startsWith("live_")) return "sandbox";
  return liveClientToken?.startsWith("live_") ? "live" : "sandbox";
}

function tokenFor(env: PayEnv): string | undefined {
  if (env === "sandbox") {
    return testClientToken || (liveClientToken?.startsWith("test_") ? liveClientToken : undefined);
  }
  return liveClientToken?.startsWith("live_") ? liveClientToken : testClientToken;
}

let scriptPromise: Promise<void> | null = null;
let initializedEnv: PayEnv | null = null;
const eventListeners = new Set<PaddleEventCallback>();

/** Broadcasts all Paddle events to all registered listeners */
function handlePaddleEvent(event: any) {
  if (!event || !event.name) return;
  eventListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error("Error in Paddle event listener:", err);
    }
  });
}

export function addPaddleEventListener(listener: PaddleEventCallback): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

function loadScript(timeoutMs = 12000): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("The payment form can only open in your browser."));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]',
    );
    if (existing && window.Paddle) {
      resolve();
      return;
    }

    let timer: any = null;
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      script.async = true;
      document.head.appendChild(script);
    }

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };

    const onLoad = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      scriptPromise = null;
      reject(
        new Error(
          "The secure payment form could not load. Check your connection or any ad blocker and try again.",
        ),
      );
    };

    timer = setTimeout(() => {
      cleanup();
      scriptPromise = null;
      reject(
        new Error("Payment system connection timed out. Please check your network and try again."),
      );
    }, timeoutMs);

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
  });
  return scriptPromise;
}

export async function initializePaddle(
  env: PayEnv = getPaddleEnvironment(),
  customCallback?: PaddleEventCallback,
): Promise<void> {
  const token = tokenFor(env);
  if (!token) throw new Error("Card payments are being set up. Please try again shortly.");
  
  if (customCallback) {
    eventListeners.add(customCallback);
  }

  await loadScript();

  if (initializedEnv === env) {
    return;
  }

  window.Paddle.Environment.set(env === "sandbox" ? "sandbox" : "production");
  window.Paddle.Initialize({
    token,
    eventCallback: handlePaddleEvent,
  });
  initializedEnv = env;
}

/** Resolves our price id and says which environment the form must open in. */
export async function getPaddlePriceId(
  priceId: string,
): Promise<{ paddlePriceId: string; environment: PayEnv; amountCents?: number; currency?: string }> {
  const environment = getPaddleEnvironment();
  const result = await resolvePaddlePrice({ data: { priceId, environment } });
  if (!result.ok) throw new Error(result.error);
  return {
    paddlePriceId: result.paddlePriceId,
    environment: result.environment,
    amountCents: result.amountCents,
    currency: result.currency,
  };
}
