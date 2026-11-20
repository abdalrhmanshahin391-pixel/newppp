import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { SiteFooterView } from "./SiteFooterView";
import { footerColumns } from "../lib/footer-links";

function render(ar: boolean, tone?: "ink" | "light") {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <SiteFooterView
        ar={ar}
        columns={footerColumns(ar, true)}
        supportEmail="support@example.com"
        year={2026}
        tone={tone}
      />
    </RouterContextProvider>,
  );
}

test("the footer renders real navigation and legal destinations in both directions", () => {
  for (const ar of [false, true]) {
    const html = render(ar);
    assert.match(html, ar ? /dir="rtl"/ : /dir="ltr"/);
    for (const path of [
      "/learn",
      "/rita",
      "/rita-live",
      "/rita-lessons",
      "/study",
      "/study/lectures",
      "/study/todo",
      "/study/exams",
      "/spaces",
      "/share",
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
    assert.match(html, /class="uz-footer-art" aria-hidden="true"/);
    assert.doesNotMatch(html, /<canvas|<iframe|<img/);
  }
});

test("the offers link follows its setting, and the retired tools are not linked", () => {
  const destinations = (offers: boolean) =>
    footerColumns(false, offers).flatMap((column) => column.links.map((link) => link.to));
  assert.ok(destinations(true).includes("/offers"));
  assert.ok(!destinations(false).includes("/offers"));
  for (const gone of ["/german", "/study/match", "/study/pdf", "/study/all-in-one"])
    assert.ok(!destinations(true).includes(gone), gone);
});

test("the blog gets the same footer in its light tone", () => {
  assert.match(render(false), /data-tone="ink"/);
  const light = render(false, "light");
  assert.match(light, /data-tone="light"/);
  assert.match(light, /class="uz-footer-art" aria-hidden="true"/);
});
