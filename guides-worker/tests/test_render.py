"""Local check of the renderer (needs Playwright and a Chromium; set GUIDE_CHROMIUM_PATH if needed).

    python guides-worker/tests/test_render.py <html file written by build-samples.mjs>
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from guide_render import GuideRenderError, check_html, check_token, render_pdf  # noqa: E402

FONTS = str(Path(__file__).resolve().parents[1] / "fonts")


def expect_error(call, status, code):
    try:
        call()
    except GuideRenderError as error:
        assert (error.status, error.code) == (status, code), (error.status, error.code)
        return
    raise AssertionError(f"expected {status} {code}")


def main():
    expect_error(lambda: check_token("secret", "wrong"), 401, "unauthorized")
    expect_error(lambda: check_token("", ""), 401, "unauthorized")
    check_token("secret", " secret ")
    expect_error(lambda: check_html(""), 400, "bad_request")
    expect_error(lambda: check_html(None), 400, "bad_request")
    expect_error(lambda: check_html("x" * 700_000), 413, "too_large")

    html = Path(sys.argv[1]).read_text(encoding="utf-8") if len(sys.argv) > 1 else None
    if html:
        # the file written by build-samples.mjs points at absolute font files; the worker form is relative
        html = html.replace(Path(FONTS).as_uri() + "/", "fonts/")
        pdf = asyncio.run(render_pdf(html, FONTS))
        assert pdf.startswith(b"%PDF-"), "not a pdf"
        # a page that tries to reach the network still prints, and nothing is fetched
        hostile = html.replace("<body>", '<body><img src="http://127.0.0.1:9/x.png"><script>document.title="x"</script>')
        assert asyncio.run(render_pdf(hostile, FONTS)).startswith(b"%PDF-")
        print("pdf bytes:", len(pdf))
    print("ok")


main()
