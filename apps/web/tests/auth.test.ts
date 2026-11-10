import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/password";
import { assertSecret, signSession, verifySession } from "@/lib/session";

const SECRET = "x".repeat(40);
const NOW = Date.UTC(2026, 10, 10, 12, 0, 0);

describe("sesja admina", () => {
  it("podpisany token wraca jako podmiot", async () => {
    const token = await signSession(SECRET, "admin@example.org", NOW, 3600);
    expect(await verifySession(token, SECRET, NOW + 1000)).toBe("admin@example.org");
  });

  it("odrzuca token wygasły, zmieniony i podpisany innym sekretem", async () => {
    const token = await signSession(SECRET, "admin@example.org", NOW, 3600);
    expect(await verifySession(token, SECRET, NOW + 3601 * 1000)).toBeNull();

    const [body, signature] = token.split(".");
    const forgedPayload = btoa(JSON.stringify({ sub: "ktos-inny", exp: 9999999999 })).replace(/=+$/, "");
    expect(await verifySession(`${forgedPayload}.${signature}`, SECRET, NOW)).toBeNull();
    expect(await verifySession(`${body}.${signature.slice(0, -2)}AA`, SECRET, NOW)).toBeNull();
    expect(await verifySession(token, "y".repeat(40), NOW)).toBeNull();
  });

  it("odrzuca puste i uszkodzone tokeny bez wyjątku", async () => {
    for (const bad of [undefined, null, "", "abc", "a.b", "...", "%%%.%%%"]) {
      expect(await verifySession(bad as string | undefined, SECRET, NOW)).toBeNull();
    }
  });

  it("wymaga sekretu o długości co najmniej 32 znaków", () => {
    expect(() => assertSecret(undefined)).toThrow();
    expect(() => assertSecret("krotki")).toThrow();
    expect(assertSecret(SECRET)).toBe(SECRET);
  });
});

describe("hasła", () => {
  it("weryfikuje poprawne hasło i odrzuca błędne", () => {
    const stored = hashPassword("tajne-haslo");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("tajne-haslo", stored)).toBe(true);
    expect(verifyPassword("inne-haslo", stored)).toBe(false);
  });

  it("dwa hasze tego samego hasła różnią się (sól)", () => {
    expect(hashPassword("a")).not.toBe(hashPassword("a"));
  });

  it("odrzuca uszkodzony lub brakujący hasz", () => {
    expect(verifyPassword("x", undefined)).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "bcrypt$cos")).toBe(false);
    expect(verifyPassword("x", "scrypt$1$1$1$%%%$%%%")).toBe(false);
  });

  it("skrypt hash-password.mjs daje hasz zgodny z biblioteką", () => {
    const script = path.resolve(__dirname, "../scripts/hash-password.mjs");
    const output = execFileSync("node", [script, "haslo-ze-skryptu"], { encoding: "utf8" }).trim();
    expect(verifyPassword("haslo-ze-skryptu", output)).toBe(true);
    expect(verifyPassword("zle", output)).toBe(false);
  });
});
