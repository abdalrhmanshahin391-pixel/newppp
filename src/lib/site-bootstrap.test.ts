import { expect, test, spyOn } from "bun:test";
import { loadSiteBootstrap, invalidateSiteBootstrapCache } from "./site-bootstrap.server";

test("cold public startup and invalidation perform zero network requests", async () => {
  const network = spyOn(globalThis, "fetch").mockImplementation(() => {
    throw new Error("Public startup must not contact the backend");
  });
  try {
    const first = await loadSiteBootstrap();
    invalidateSiteBootstrapCache();
    const second = await loadSiteBootstrap();
    expect(second).toEqual(first);
    expect(first.settings?.["id"]).toBe(true);
    expect(network).not.toHaveBeenCalled();
  } finally {
    network.mockRestore();
  }
});