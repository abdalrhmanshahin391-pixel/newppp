import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { BlogFooterView } from "./BlogFooter";
import { blogFooterColumns } from "../../lib/footer-links";

function render(ar: boolean, offers = true) {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ["/blog"] }),
  });
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <BlogFooterView
        ar={ar}
        columns={blogFooterColumns(ar, offers)}
        supportEmail="support@example.com"
        year={2026}
      />
    </RouterContextProvider>,
  );
}

test("the blog footer keeps the site's real destinations, in English and Arabic", () => {
  for (const ar of [false, true]) {
    const html = render(ar);
    assert.match(html, /class="ub-footer"/);
    for (const path of [
      "/blog",
      "/books",
      "/start",
      "/rita",
      "/rita-lessons",
      "/study",
      "/spaces",
      "/pricing",
      "/offers",
      "/support",
      "/terms",
      "/privacy-policy",
      "/refund-policy",
      "/settings?section=account",
      "/register",
    ]) {
      assert.ok(html.includes(`href="${path}"`), `Missing ${path}`);
    }
    assert.match(html, /href="mailto:support@example.com"/);
    assert.match(html, ar ? /ابدأ التعلّم/ : /Start learning/);
    assert.doesNotMatch(html, /uz-footer|<canvas|<iframe|<img/);
  }
});

test("the offers link follows the site setting", () => {
  assert.ok(!render(false, false).includes('href="/offers"'));
});
