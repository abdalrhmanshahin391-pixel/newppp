/**
 * The voice client shows only a refusal's `info` (or `detail`), so every refusal carries its code
 * there ("voice_not_available_for_language: …"); the page then names the real reason instead of a
 * generic "the connection stopped". A plain-text refusal (401) becomes JSON for the same reason.
 */
export async function withRefusalInfo(response: Response): Promise<Response> {
  if (response.ok) return response;
  const text = await response.clone().text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = {
      ok: false,
      code: response.status === 401 ? "unauthorized" : "start_refused",
      message: text,
    };
  }
  const code = typeof body.code === "string" ? body.code : "";
  const said = String(body.info ?? body.message ?? body.detail ?? "");
  if (!code || said.startsWith(code)) return response;
  return Response.json({ ...body, info: `${code}: ${said}` }, { status: response.status });
}
