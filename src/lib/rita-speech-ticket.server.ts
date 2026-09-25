type RitaSpeechTicketPayload = {
  userId: string;
  turnId: string;
  index: number;
  textHash: string;
  expiresAt: number;
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function textHash(value: string) {
  return base64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
  );
}

async function signingKey() {
  const root = String(process.env["SUPABASE_SERVICE_ROLE_KEY"] || "").trim();
  if (!root) throw new Error("Rita speech signing is not configured.");
  const material = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`rita-speech-ticket-v1:${root}`),
  );
  return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function createRitaSpeechTicket(args: {
  userId: string;
  turnId: string;
  index: number;
  text: string;
}) {
  const payload: RitaSpeechTicketPayload = {
    userId: args.userId,
    turnId: args.turnId,
    index: args.index,
    textHash: await textHash(args.text),
    expiresAt: Date.now() + 90_000,
  };
  const encoded = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(encoded)),
  );
  return `${encoded}.${base64Url(signature)}`;
}

export async function verifyRitaSpeechTicket(args: {
  ticket: string;
  userId: string;
  turnId: string;
  index: number;
  text: string;
}) {
  const [encoded, signature] = args.ticket.split(".");
  if (!encoded || !signature) return false;
  let payload: RitaSpeechTicketPayload;
  try {
    payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encoded)),
    ) as RitaSpeechTicketPayload;
  } catch {
    return false;
  }
  if (
    payload.userId !== args.userId ||
    payload.turnId !== args.turnId ||
    payload.index !== args.index ||
    payload.expiresAt < Date.now() ||
    payload.textHash !== (await textHash(args.text))
  )
    return false;
  return crypto.subtle.verify(
    "HMAC",
    await signingKey(),
    fromBase64Url(signature),
    new TextEncoder().encode(encoded),
  );
}
