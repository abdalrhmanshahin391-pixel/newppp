"""Turns a guide's HTML into a PDF with Chromium. No Modal imports, so it runs the same locally.

The HTML comes from the website's own template (src/lib/guides/guide-html.ts), which escapes every
piece of text. Even so, the browser here is locked down: JavaScript is off and every request that is
not a local file is refused, so a page can neither run code nor reach the network.
"""

from __future__ import annotations

import hmac
import os
import tempfile
from pathlib import Path

MAX_HTML_BYTES = 600_000
MAX_PDF_BYTES = 8_000_000


class GuideRenderError(Exception):
    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = status
        self.code = code


def check_token(expected: str, supplied: str) -> None:
    """Constant-time comparison; a missing server token never matches anything."""
    expected = (expected or "").strip()
    supplied = (supplied or "").strip()
    if not expected or not hmac.compare_digest(expected, supplied):
        raise GuideRenderError(401, "unauthorized")


def check_html(html: object) -> str:
    if not isinstance(html, str) or not html.strip():
        raise GuideRenderError(400, "bad_request")
    if len(html.encode("utf-8")) > MAX_HTML_BYTES:
        raise GuideRenderError(413, "too_large")
    return html


async def render_pdf(html: str, fonts_dir: str) -> bytes:
    """One HTML document in, one PDF out. The page size comes from the document's own @page rule."""
    from playwright.async_api import async_playwright

    check_html(html)
    with tempfile.TemporaryDirectory(prefix="guide-") as tmp:
        # The template names its fonts as "fonts/<file>", next to the HTML file.
        os.symlink(fonts_dir, os.path.join(tmp, "fonts"))
        page_file = Path(tmp) / "guide.html"
        page_file.write_text(html, encoding="utf-8")
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                args=["--no-sandbox"],
                executable_path=os.environ.get("GUIDE_CHROMIUM_PATH") or None,
            )
            try:
                context = await browser.new_context(java_script_enabled=False)

                async def only_local(route):  # type: ignore[no-untyped-def]
                    if route.request.url.startswith("file://"):
                        await route.continue_()
                    else:
                        await route.abort()

                await context.route("**/*", only_local)
                page = await context.new_page()
                await page.goto(page_file.as_uri(), wait_until="load", timeout=30_000)
                await page.wait_for_timeout(400)  # fonts finish loading
                pdf = await page.pdf(print_background=True, prefer_css_page_size=True, tagged=True)
            finally:
                await browser.close()
    if not pdf.startswith(b"%PDF-") or len(pdf) > MAX_PDF_BYTES:
        raise GuideRenderError(502, "bad_pdf")
    return pdf
