import { afterEach, describe, expect, it, vi } from "vitest";

describe("path-status", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("rozpoznaje adresy profili i miast", async () => {
    const { isCandidatePath } = await import("@/lib/path-status");
    expect(isCandidatePath("/szczyrk/biuro-patria")).toBe(true);
    expect(isCandidatePath("/kielczow")).toBe(true);
    expect(isCandidatePath("/")).toBe(false);
    expect(isCandidatePath("/admin/login/x")).toBe(false);
    expect(isCandidatePath("/sitemap.xml")).toBe(false);
  });

  it("zwraca przekierowanie, 410 albo nic, a przy błędzie nic", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ redirects: { "/szczyrk/patria": "/szczecin/patria" }, gone: ["/kielczow"] })),
    );
    const { pathStatus } = await import("@/lib/path-status");
    const wait = () => undefined;
    expect(await pathStatus("/szczyrk/patria", "https://x", wait)).toEqual({ kind: "redirect", to: "/szczecin/patria" });
    expect(await pathStatus("/kielczow", "https://x", wait)).toEqual({ kind: "gone" });
    expect(await pathStatus("/krakow", "https://x", wait)).toBeNull();
  });

  it("bez danych z API strona działa jak dotąd", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("brak sieci"));
    const { pathStatus } = await import("@/lib/path-status");
    expect(await pathStatus("/kielczow", "https://x", () => undefined)).toBeNull();
  });
});
