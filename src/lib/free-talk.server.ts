import { supabaseAdmin } from "@/integrations/supabase/legacy-client.server";
import { getServerRuntimeSecret } from "@/lib/config.server";

export type FreeTalkBudget = {
  enabled: boolean;
  unlimited: boolean;
  remainingSeconds: number | null;
  /** What is free now (an open call's reservation excluded). */
  availableSeconds: number | null;
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
    const code =
      /(?:free_talk|voice_board)_[a-z_]+/.exec(error.message)?.[0] ?? "free_talk_unavailable";
    // An unexpected failure (a missing function, a connection problem) is logged with its cause,
    // so «time unavailable» can be traced; a known refusal is ordinary.
    if (code === "free_talk_unavailable")
      console.error("Uzyra voice time call failed", {
        name,
        code: error.code,
        message: error.message,
      });
    throw new FreeTalkError(code);
  }
  return data as T;
}
export const freeTalkBudget = (userId: string) =>
  voiceRpc<FreeTalkBudget>("free_talk_budget", { p_user: userId });

/** Admins have no voice limit, even when the voice-time functions in the database fail. */
export async function isVoiceAdmin(userId: string) {
  try {
    const { data } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/** The budget for the top bar: an admin whose budget can't be read still sees "unlimited". */
export async function freeTalkBudgetForPage(userId: string): Promise<FreeTalkBudget> {
  try {
    return await freeTalkBudget(userId);
  } catch (error) {
    if (!(await isVoiceAdmin(userId))) throw error;
    return {
      enabled: true,
      unlimited: true,
      remainingSeconds: null,
      availableSeconds: null,
      limitSeconds: null,
      period: "admin",
      resetsAt: null,
      serverNow: new Date().toISOString(),
      activeSessionId: null,
      activeDeadline: null,
    };
  }
}

/**
 * What the whiteboard may do with its voice before it starts a step:
 * - "on": speak (and charge each clip);
 * - "call": a call is open and holds the time, so the board is silent (nothing charged);
 * - "none": the plan has no voice time, so the board is silent (nothing charged);
 * - "over": the time is used up, the board stops ("خلص وقتك ولا يمكنك الإكمال");
 * - "off": the time could not be read, so the board is silent rather than speaking unpaid.
 */
export type BoardVoice = "on" | "call" | "none" | "over" | "off";

export async function boardVoice(userId: string): Promise<BoardVoice> {
  if (await isVoiceAdmin(userId)) return "on";
  try {
    const budget = await freeTalkBudget(userId);
    if (budget.unlimited) return "on";
    if (!budget.limitSeconds) return "none";
    if ((budget.availableSeconds ?? 0) > 0) return "on";
    return budget.activeSessionId ? "call" : "over";
  } catch {
    return "off";
  }
}

export type BoardCharge = {
  charged: boolean;
  repeat?: boolean;
  unlimited?: boolean;
  leftMs?: number;
  reason?: "exhausted" | "call" | "none";
};

/** Take one clip's exact length (ms) from the learner's voice time; `ref` makes it happen once. */
export async function chargeBoardVoice(
  userId: string,
  milliseconds: number,
  ref: string,
): Promise<BoardCharge> {
  try {
    return await rawBoardCharge(userId, milliseconds, ref);
  } catch (error) {
    // An admin's clip is never held back by a failing charge.
    if (await isVoiceAdmin(userId)) return { charged: true, unlimited: true };
    throw error;
  }
}
const rawBoardCharge = (userId: string, milliseconds: number, ref: string) =>
  voiceRpc<BoardCharge>("voice_board_charge", {
    p_user: userId,
    p_ms: milliseconds,
    p_ref: ref,
  });
/**
 * Reserve call time from the learner's voice budget. Every call takes from the same budget (free
 * conversation, path lessons and book study); only a free conversation also needs free talk
 * switched on (`free_talk_config`), so turning it off never stops lessons.
 */
export const reserveFreeTalk = (userId: string, sessionId: string, freeConversation = true) =>
  voiceRpc<FreeTalkGrant>("free_talk_reserve", {
    p_user: userId,
    p_session: sessionId,
    p_free: freeConversation,
  });
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
