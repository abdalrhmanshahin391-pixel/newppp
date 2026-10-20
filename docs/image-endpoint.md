# Private image endpoint

`POST /api/admin/generate-image` makes one picture with the site's own OpenAI key. It exists so the
owner can ask Claude (in a coding session) for a picture and Claude can fetch it through the site.

## Turn it on (once)
1. Make a long random string (at least 32 characters). Do not paste it into any chat.
2. Add it as the secret `RITA_IMAGE_API_TOKEN` on the site (Lovable: Settings, Secrets).
3. Apply the migration `20261019180000_rita_image_generations.sql` (usage log and a private bucket).
4. Add the same value to the Claude Code environment (cloud environment menu, Edit, Network secrets or
   an environment variable named `RITA_IMAGE_API_TOKEN`). A new session picks it up.

Without the secret the endpoint answers 404, as if it did not exist. Rotating the secret cuts off the old value at once.

## Request
```
curl -sS https://ritajet.com/api/admin/generate-image \
  -H "Authorization: Bearer $RITA_IMAGE_API_TOKEN" -H "content-type: application/json" \
  -d '{"prompt":"a red apple on a school desk","size":"1024x1024","quality":"medium","style":"raw","save":false}'
```
- `prompt` 3 to 1000 characters. `size` 1024x1024 (default), 1536x1024 or 1024x1536.
- `quality` medium (default) or high (costs several times more). `style` raw (as written) or lesson (house cartoon style).
- `save: true` also keeps the picture in the private `generated-images` bucket and returns a link valid for 7 days.

Answer: `{ id, model, size, quality, content_type, bytes, image_base64, url, saved, save_error }`.
Errors are `{ "error": "..." }`: 400 bad input, 401 wrong token, 413 body too large, 429 cap reached
(`Retry-After` is set), 502 OpenAI refused or failed (its own reason is passed on), 503 log table missing.

## Limits (fail closed)
20 pictures per hour, 100 per day, 2 at a time. Counted from `rita_image_generations`; if that table is
missing the endpoint refuses instead of running without a cap. The log keeps a 120-character preview of the
prompt, never the whole prompt or the token. Rules and tests: `src/lib/rita-image-request.ts`.
