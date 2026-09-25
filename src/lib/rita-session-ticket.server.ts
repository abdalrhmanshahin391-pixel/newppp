// Short-lived signed session ticket: lets /api/rita/respond verify the caller
// locally (HMAC, <1 ms) instead of a network round-trip to the auth service.
const TTL_MS = 15 * 60_000;

function b64u(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64u(v: string) {
  const p = v.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(v.length / 4) * 4, "=");
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
}

let keyPromise: Promise<CryptoKey> | null = null;
function signingKey() {
  if (keyPromise) return keyPromise;
  keyPromise = (async () => {
    const root = String(process.env["SUPABASE_SERVICE_ROLE_KEY"] || "").trim();
    if (!root) throw new Error("Rita session signing is not configured.");
    const material = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`rita-session-ticket-v1:${root}`),
    );
    return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
      "verify",
    ]);
  })().catch((e) => {
    keyPromise = null;
    throw e;
  });
  return keyPromise;
}

export async function createRitaSessionTicket(userId: string) {
  const expiresAt = Date.now() + TTL_MS;
  const encoded = b64u(new TextEncoder().encode(JSON.stringify({ u: userId, e: expiresAt })));
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(encoded)),
  );
  return { ticket: `${encoded}.${b64u(sig)}`, expiresAt };
}

export async function verifyRitaSessionTicket(ticket: string): Promise<string | null> {
  try {
    const [encoded, sig] = ticket.split(".");
    if (!encoded || !sig) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64u(encoded))) as {
      u?: unknown;
      e?: unknown;
    };
    if (typeof payload.u !== "string" || !payload.u) return null;
    if (typeof payload.e !== "number" || payload.e < Date.now()) return null;
    const ok = await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      fromB64u(sig),
      new TextEncoder().encode(encoded),
    );
    return ok ? payload.u : null;
  } catch {
    return null;
  }
}
