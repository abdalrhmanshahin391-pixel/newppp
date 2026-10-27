// Asks the renderer (a Modal app with Chromium) to turn guide HTML into a PDF. Pure and given its
// `fetch`, so the failures are tested with a local server: not configured, not reachable, refused,
// not a PDF. The website calls this with the URL and token from its server secrets.
export const DEFAULT_GUIDES_URL = "https://abdalrhmanshahin391--ritajet-guides-render.modal.run";
export const RENDER_TIMEOUT_MS = 80_000;
export const MAX_PDF_BYTES = 8_000_000;

export type RenderFailureCode = "render_not_configured" | "render_unreachable" | "render_failed";

export type RenderResult =
  { ok: true; pdf: Uint8Array } | { ok: false; code: RenderFailureCode; message: string };

export async function renderPdf(options: {
  html: string;
  url: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<RenderResult> {
  if (!options.token) {
    return { ok: false, code: "render_not_configured", message: "MODAL_START_TOKEN is missing." };
  }
  const run = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await run(options.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: options.token, html: options.html }),
      signal: AbortSignal.timeout(options.timeoutMs ?? RENDER_TIMEOUT_MS),
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.slice(0, 160) : "no answer";
    return { ok: false, code: "render_unreachable", message };
  }
  // Modal answers 404 for an app that is not deployed, and 5xx while a container starts or fails.
  if (response.status === 404 || response.status === 502 || response.status === 503) {
    return {
      ok: false,
      code: "render_unreachable",
      message: `The renderer answered ${response.status}.`,
    };
  }
  if (response.status === 401) {
    return { ok: false, code: "render_not_configured", message: "The renderer refused the token." };
  }
  if (!response.ok) {
    return {
      ok: false,
      code: "render_failed",
      message: `The renderer answered ${response.status}.`,
    };
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const magic = String.fromCharCode(...bytes.slice(0, 5));
  if (magic !== "%PDF-" || bytes.length > MAX_PDF_BYTES) {
    return { ok: false, code: "render_failed", message: "The renderer did not return a PDF." };
  }
  return { ok: true, pdf: bytes };
}
