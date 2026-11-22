import { supabaseAdmin } from "@/integrations/supabase/legacy-client.server";
import { getServerRuntimeSecret } from "@/lib/config.server";

export type FreeTalkBudget = {
  enabled: boolean;
  unlimited: boolean;
  remainingSeconds: number | null;
  limitSeconds: number | null;
  period: string;
  resetsAt: string | null;
  serverNow: string;
  activeSessionId: string | null;
  activeDeadline: string | null;
};
export type FreeTalkGrant = FreeTalkBudget & {
  sessionId: string;
  deadline: string;
  roomName: string;
  reservedSeconds: number;
};
const DEFAULT_MODAL_URL = "https://abdalrhmanshahin391--ritajet-voice-start-session.modal.run";
export class FreeTalkError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export async function voiceRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(name, args);
  if (error) {
    const code = /free_talk_[a-z_]+/.exec(error.message)?.[0] ?? "free_talk_unavailable";
    throw new FreeTalkError(code);
  }
  return data as T;
}
export const freeTalkBudget = (userId: string) =>
  voiceRpc<FreeTalkBudget>("free_talk_budget", { p_user: userId });
export const reserveFreeTalk = (userId: string, sessionId: string) =>
  voiceRpc<FreeTalkGrant>("free_talk_reserve", { p_user: userId, p_session: sessionId });
export function voiceControlUrl() {
  // Never forward the worker credential to a caller-supplied origin or Host header.
  return "https://ritajet.com/api/rita-v3/session/end";
}
export async function modalControl(action: string, body: Record<string, unknown>) {
  const url = (await getServerRuntimeSecret("MODAL_START_URL")) || DEFAULT_MODAL_URL;
  const token = await getServerRuntimeSecret("MODAL_START_TOKEN");
  if (!token) throw new FreeTalkError("free_talk_unavailable");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, action, body }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.quotaProtocol !== 1)
    throw new FreeTalkError("free_talk_stop_unconfirmed");
  return result;
}
/** No browser-provided duration or provider id is accepted. */
export async function endFreeTalk(userId: string, sessionId: string) {
  const row = await voiceRpc<{
    state: string;
    roomName: string;
    providerCallId: string | null;
    active: boolean;
  } | null>("free_talk_close", { p_user: userId, p_session: sessionId });
  if (!row) return false;
  if (row.state === "closed") return true;
  // A pending start might still create its room: only its trusted cleanup or expiry can release it.
  if (!row.active) return true;
  const stopped = await modalControl("stop", {
    roomName: row.roomName,
    providerCallId: row.providerCallId,
  });
  if (stopped.stopped !== true) throw new FreeTalkError("free_talk_stop_unconfirmed");
  await voiceRpc("free_talk_settle", { p_session: sessionId });
  return true;
}
