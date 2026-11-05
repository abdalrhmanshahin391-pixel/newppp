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

function render(ar: boolean) {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <SiteFooterView
        ar={ar}
        columns={footerColumns(ar, "de", true)}
        supportEmail="support@example.com"
        year={2026}
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
      "/study/match",
      "/study/pdf",
      "/study/todo",
      "/german",
      "/spaces",
      "/share",
      "/pricing",
      "/offers",
      "/support",
      "/terms",
      "/privacy-policy",
      "/refund-policy",
      "/my-plan",
      "/register",
    ]) {
      assert.ok(html.includes(`href="${path}"`), `Missing ${path}`);
    }
    assert.match(html, /href="mailto:support@example.com"/);
    assert.match(html, /class="uz-footer-art" aria-hidden="true"/);
    assert.doesNotMatch(html, /<canvas|<iframe|<img/);
  }
});

test("account-sensitive links retain the original visibility rules", () => {
  const destinations = (language: string | null, offers: boolean) =>
    footerColumns(false, language, offers).flatMap((column) => column.links.map((link) => link.to));
  assert.ok(destinations("de", true).includes("/german"));
  assert.ok(!destinations("en", false).includes("/german"));
  assert.ok(!destinations("en", false).includes("/offers"));
});
