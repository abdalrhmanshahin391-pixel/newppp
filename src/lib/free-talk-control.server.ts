import { getServerRuntimeSecret } from "@/lib/config.server";
import { voiceRpc } from "@/lib/free-talk.server";
import { timingSafeEqual } from "node:crypto";

/** Trusted worker lifecycle, shared endpoint; a learner JWT never authorizes this branch. */
export async function handleFreeTalkControl(request: Request): Promise<Response> {
  const expected = Buffer.from((await getServerRuntimeSecret("MODAL_START_TOKEN")) || "");
  const supplied = Buffer.from(
    (request.headers.get("authorization") ?? "").replace(/^Bearer /, ""),
  );
  if (
    !expected.length ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return new Response("Unauthorized", { status: 401 });
  const body = await request.json().catch(() => null);
  if (
    !body ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(body.sessionId))
  )
    return new Response("Bad request", { status: 400 });
  try {
    const args = { p_session: body.sessionId };
    const reply = (data: object) =>
      Response.json({ quotaProtocol: 1, ...data }, { headers: { "Cache-Control": "no-store" } });
    if (body.action === "claim") return reply({ grant: await voiceRpc("free_talk_claim", args) });
    if (
      body.action === "bind" &&
      typeof body.callId === "string" &&
      body.callId.length > 0 &&
      body.callId.length < 200
    )
      return reply({ bound: await voiceRpc("free_talk_bind", { ...args, p_call: body.callId }) });
    if (body.action === "settle")
      return reply({ settled: await voiceRpc("free_talk_settle", args) });
    return new Response("Bad request", { status: 400 });
  } catch {
    return Response.json({ code: "free_talk_control_rejected" }, { status: 409 });
  }
}
