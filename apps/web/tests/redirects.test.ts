import { describe, expect, it } from "vitest";

import { resolveRedirects } from "@/lib/redirects";

describe("przekierowania stałe", () => {
  it("łańcuch przez wycofany wpis prowadzi do żywego profilu", () => {
    const map = resolveRedirects([
      { from: "/kluczbork/strona-glowna", to: "/kluczbork/murzynski-nieruchomosci", published: false },
      { from: "/kluczbork/murzynski-nieruchomosci", to: "/warszawa/murzynski-nieruchomosci", published: true },
      { from: "/szczyrk/borowicz", to: "/bielsko-biala/borowicz", published: true },
      { from: "/x/sam-wycofany", to: "/y/wycofany", published: false },
      { from: "/a/petla", to: "/b/petla", published: false },
      { from: "/b/petla", to: "/a/petla", published: false },
    ]);
    expect(map["/kluczbork/strona-glowna"]).toBe("/warszawa/murzynski-nieruchomosci");
    expect(map["/kluczbork/murzynski-nieruchomosci"]).toBe("/warszawa/murzynski-nieruchomosci");
    expect(map["/szczyrk/borowicz"]).toBe("/bielsko-biala/borowicz");
    expect(map["/x/sam-wycofany"]).toBeUndefined();
    expect(map["/a/petla"]).toBeUndefined();
  });
});
