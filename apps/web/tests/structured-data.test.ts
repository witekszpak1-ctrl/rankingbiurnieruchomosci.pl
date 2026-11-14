import { describe, expect, it } from "vitest";

import { operatorJsonLd } from "@/lib/legal";
import { articleLd, ORG_ID, organizationLd, postalAddressLd } from "@/lib/seo";

describe("dane strukturalne", () => {
  it("adres biura z osobnym kodem pocztowym", () => {
    expect(postalAddressLd("ul. Skierniewicka 10A, 01-230, Warszawa", "Warszawa")).toMatchObject({
      streetAddress: "ul. Skierniewicka 10A", postalCode: "01-230", addressLocality: "Warszawa", addressCountry: "PL",
    });
    expect(postalAddressLd("ul. Puławska 5, 05-500 Piaseczno", "Warszawa")).toMatchObject({
      streetAddress: "ul. Puławska 5", postalCode: "05-500", addressLocality: "Piaseczno",
    });
    expect(postalAddressLd("30-102 Kraków, ul. Morawskiego 5/127", "Kraków")).toMatchObject({
      streetAddress: "ul. Morawskiego 5/127", postalCode: "30-102", addressLocality: "Kraków",
    });
    expect(postalAddressLd("ul. Długa 1", "Gdańsk")).toEqual({
      "@type": "PostalAddress", streetAddress: "ul. Długa 1", addressLocality: "Gdańsk", addressCountry: "PL",
    });
    expect(postalAddressLd(null, "Gdańsk")).toEqual({ "@type": "PostalAddress", addressLocality: "Gdańsk", addressCountry: "PL" });
  });
  it("jeden identyfikator serwisu, administrator z adresem w częściach", () => {
    const org = organizationLd();
    expect(org["@id"]).toBe(ORG_ID);
    expect(operatorJsonLd()).toMatchObject({
      name: "Luk Chok",
      address: { "@type": "PostalAddress", postalCode: "84330", addressCountry: "TH" },
      identifier: { "@type": "PropertyValue", value: "0845568016111" },
    });
  });
  it("artykuł: autor i wydawca, data zmiany nie wcześniejsza niż publikacji", () => {
    const a = articleLd({ headline: "X", path: "/raport", datePublished: "2026-11-14", dateModified: "2026-11-13" });
    expect(a.dateModified).toBe("2026-11-14");
    expect((a.author as { "@id": string })["@id"]).toBe(ORG_ID);
    expect(a.mainEntityOfPage).toMatch(/\/raport$/);
  });
});
