"""Modal app that turns guide HTML into a PDF (Chromium). Used by the admin's "make a PDF guide".

The website sends `{ token, html }` and gets the PDF bytes back. The token is the same shared secret
the voice worker uses (secret `ritajet-voice`, key RITA_MODAL_TOKEN; the website calls it
MODAL_START_TOKEN), so no new secret has to be created.

Deploy: `modal deploy guides-worker/modal_app.py` from the repository root, or let
`.github/workflows/guides-modal-deploy.yml` do it when the code reaches main.
The endpoint answers at https://<workspace>--ritajet-guides-render.modal.run
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import modal

_HERE = Path(__file__).resolve().parent
APP_NAME = "ritajet-guides"
SECRET_NAME = "ritajet-voice"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("playwright==1.52.0", "fastapi[standard]")
    .run_commands("playwright install --with-deps chromium")
    .add_local_dir(_HERE / "fonts", remote_path="/app/fonts")
    .add_local_python_source("guide_render")
)

app = modal.App(APP_NAME, image=image)
secrets = [modal.Secret.from_name(SECRET_NAME)]


@app.function(secrets=secrets, timeout=120, max_containers=2, scaledown_window=120)
@modal.fastapi_endpoint(method="POST", docs=False)
async def render(payload: dict[str, Any]):
    """Check the token, render the HTML, return the PDF. Errors are short codes."""
    from fastapi import HTTPException
    from fastapi.responses import Response

    from guide_render import GuideRenderError, check_html, check_token, render_pdf

    try:
        check_token(os.environ.get("RITA_MODAL_TOKEN", ""), str(payload.get("token") or ""))
        html = check_html(payload.get("html"))
        pdf = await render_pdf(html, "/app/fonts")
    except GuideRenderError as error:
        raise HTTPException(status_code=error.status, detail=error.code) from error
    except Exception as error:  # the browser failed to start or to print
        print("guides render failed:", type(error).__name__, str(error)[:200])
        raise HTTPException(status_code=502, detail="render_failed") from error
    return Response(content=pdf, media_type="application/pdf")
