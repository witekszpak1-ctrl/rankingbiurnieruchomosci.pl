import { describe, expect, it, vi } from "vitest";

import { memoize } from "@/lib/memo";

describe("memoize", () => {
  it("zwraca zapamiętany wynik do końca czasu ważności, potem pyta ponownie", async () => {
    let t = 0;
    const fn = vi.fn(async () => t);
    const get = memoize(fn, 1000, () => t);
    expect(await get()).toBe(0);
    t = 999;
    expect(await get()).toBe(0);
    expect(fn).toHaveBeenCalledTimes(1);
    t = 1000;
    expect(await get()).toBe(1000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("równoczesne wywołania czekają na jedno zapytanie", async () => {
    const fn = vi.fn(async () => "ok");
    const get = memoize(fn, 1000, () => 0);
    expect(await Promise.all([get(), get(), get()])).toEqual(["ok", "ok", "ok"]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("nie zapamiętuje błędu", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("baza")).mockResolvedValueOnce("ok");
    const get = memoize(fn as () => Promise<string>, 1000, () => 0);
    await expect(get()).rejects.toThrow("baza");
    expect(await get()).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("zachowuje daty jako obiekty Date", async () => {
    const d = new Date("2026-11-28T00:00:00Z");
    const get = memoize(async () => [{ publishedAt: d }], 1000, () => 0);
    const [row] = await get();
    expect(row.publishedAt).toBeInstanceOf(Date);
  });
});
