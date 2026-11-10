import { describe, expect, it } from "vitest";

import { isValidNip, validateRequestInput } from "../lib/requests";

const valid = {
  kind: "correction",
  nip: "123-456-32-18",
  email: " Jan.Kowalski@Przyklad.PL ",
  message: "Proszę o poprawę adresu siedziby firmy.",
};

describe("isValidNip", () => {
  it("akceptuje NIP z poprawną sumą kontrolną", () => {
    expect(isValidNip("1234563218")).toBe(true);
    expect(isValidNip("7740001454")).toBe(true);
  });
  it("odrzuca złą sumę, długość i znaki", () => {
    expect(isValidNip("1234563219")).toBe(false);
    expect(isValidNip("123456321")).toBe(false);
    expect(isValidNip("12345632180")).toBe(false);
    expect(isValidNip("12345abc18")).toBe(false);
    expect(isValidNip("")).toBe(false);
  });
});

describe("validateRequestInput", () => {
  it("normalizuje poprawne dane (NIP bez myślników, e-mail małymi literami)", () => {
    const result = validateRequestInput(valid);
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "correction",
        nip: "1234563218",
        email: "jan.kowalski@przyklad.pl",
        message: "Proszę o poprawę adresu siedziby firmy.",
      },
    });
  });

  it("NIP jest nieobowiązkowy", () => {
    const result = validateRequestInput({ ...valid, nip: "" });
    expect(result.ok && result.value.nip).toBe(null);
  });

  it.each([
    [{ kind: "inne" }, "kind"],
    [{ kind: undefined }, "kind"],
    [{ nip: "1234563219" }, "nip"],
    [{ email: "bez-malpy.pl" }, "email"],
    [{ email: "a@b" }, "email"],
    [{ email: `${"x".repeat(250)}@b.pl` }, "email"],
    [{ message: "krótko" }, "message"],
    [{ message: "x".repeat(2001) }, "message"],
    [{ message: "   \n  " }, "message"],
  ])("odrzuca %j z kodem %s", (override, code) => {
    const result = validateRequestInput({ ...valid, ...override });
    expect(result).toEqual({ ok: false, code });
  });

  it("liczy treść po obcięciu spacji i ujednoliceniu końców linii", () => {
    const result = validateRequestInput({ ...valid, message: `  Pierwsza linia\r\nDruga linia  ` });
    expect(result.ok && result.value.message).toBe("Pierwsza linia\nDruga linia");
  });
});
