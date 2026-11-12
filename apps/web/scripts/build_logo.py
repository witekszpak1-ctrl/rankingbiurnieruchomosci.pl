"""Generuje logo i ikony serwisu jako wektory (tekst zamieniony na krzywe, bez zależności od czcionek u odbiorcy).

Wzór: kwadratowa ramka z "RBN" oraz dwie linie "RANKING BIUR" / "NIERUCHOMOŚCI" (projekt właściciela serwisu).
Proporcje zmierzone z projektu (wersja 2, 638x198 px): ramka 121,5 px, kreska 5,5 px, RBN wysokości wersalików
30 px, linie tekstu wysokości wersalików 27,5 px. Czcionka: Inter (licencja SIL OFL), Bold, Medium i Regular.

Uruchomienie (wymaga fonttools i czcionek Inter w /usr/share/fonts/opentype/inter):
    python apps/web/scripts/build_logo.py
Zapisuje: lib/logo-paths.ts (używa go components/Logo.tsx i app/opengraph-image.tsx), app/icon.svg, public/logo.svg. Pliki PNG i ICO tworzy scripts/render_icons.cjs.
"""

from __future__ import annotations

from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONTS = Path("/usr/share/fonts/opentype/inter")
WEB = Path(__file__).resolve().parents[1]


class Face:
    def __init__(self, name: str):
        self.font = TTFont(FONTS / name)
        self.glyphs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.cap = self.font["OS/2"].sCapHeight

    def name(self, ch: str) -> str:
        return self.cmap[ord(ch)]

    def advance(self, ch: str) -> int:
        return self.font["hmtx"][self.name(ch)][0]

    def bounds(self, ch: str):
        pen = BoundsPen(self.glyphs)
        self.glyphs[self.name(ch)].draw(pen)
        return pen.bounds  # (xMin, yMin, xMax, yMax) albo None dla spacji


def layout(face: Face, text: str, cap_px: float, ink_width: float) -> tuple[float, float]:
    """Skala i rozstrzelenie liter tak, żeby tekst miał zadaną wysokość wersalików i szerokość tuszu."""
    scale = cap_px / face.cap
    natural = sum(face.advance(ch) for ch in text) * scale
    first, last = face.bounds(text[0]), face.bounds(text[-1])
    lsb = first[0] * scale
    rsb = (face.advance(text[-1]) - last[2]) * scale
    tracking = (ink_width - (natural - lsb - rsb)) / (len(text) - 1)
    return scale, tracking


def text_path(face: Face, text: str, x_ink: float, baseline: float, cap_px: float, ink_width: float) -> str:
    scale, tracking = layout(face, text, cap_px, ink_width)
    pen = SVGPathPen(face.glyphs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    x = x_ink - face.bounds(text[0])[0] * scale
    for ch in text:
        if ch != " ":
            face.glyphs[face.name(ch)].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        x += face.advance(ch) * scale + tracking
    return pen.getCommands()


def main() -> None:
    bold, medium, regular = Face("Inter-Bold.otf"), Face("Inter-Medium.otf"), Face("Inter-Regular.otf")

    # Logo poziome: układ w pikselach projektu (wersja 2: 638 x 198 px), ramka zaczyna się w (0, 0).
    # Grubości dobrane po powierzchni tuszu: RBN Bold, pierwsza linia Medium, druga Regular.
    frame_size, frame_stroke = 121.5, 5.5
    rbn = text_path(bold, "RBN", 18, 76, 30, 85)
    line1 = text_path(medium, "RANKING BIUR", 160, 50.5, 27.5, 316)
    line2 = text_path(regular, "NIERUCHOMOŚCI", 160, 98.5, 27.5, 369)
    width, height = 529, 122
    inset = frame_stroke / 2
    frame = (
        f'<rect x="{inset}" y="{inset}" width="{frame_size - frame_stroke}" height="{frame_size - frame_stroke}" '
        f'fill="none" stroke="currentColor" stroke-width="{frame_stroke}"/>'
    )
    paths = f'<path d="{rbn}"/><path d="{line1}"/><path d="{line2}"/>'

    (WEB / "public" / "logo.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" '
        f'role="img" aria-label="Ranking Biur Nieruchomości" color="#111111" fill="#111111">'
        f"{frame}{paths}</svg>\n",
        encoding="utf-8",
    )

    (WEB / "lib" / "logo-paths.ts").write_text(
        "// WYGENEROWANE przez scripts/build_logo.py: kształty liter logo (Inter, SIL OFL) jako ścieżki SVG.\n"
        "// Układ w pikselach projektu: ramka 121,5 x 121,5 z kreską 5,5, tekst od x = 160, całość 529 x 122.\n\n"
        f"export const LOGO_FRAME_SIZE = {frame_size};\n"
        f"export const LOGO_FRAME_STROKE = {frame_stroke};\n"
        f"export const LOGO_WIDTH = {width};\n"
        f"export const LOGO_HEIGHT = {height};\n"
        f'export const LOGO_RBN = "{rbn}";\n'
        f'export const LOGO_LINE1 = "{line1}";\n'
        f'export const LOGO_LINE2 = "{line2}";\n',
        encoding="utf-8",
    )

    # Ikona: sama ramka z RBN na białym tle (widoczna także na ciemnym pasku kart), grubsza kreska dla małych rozmiarów.
    icon_rbn = text_path(bold, "RBN", 11, 39.4, 14.8, 42)
    (WEB / "app" / "icon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">'
        '<rect width="64" height="64" fill="#ffffff"/>'
        '<rect x="4.5" y="4.5" width="55" height="55" fill="none" stroke="#111111" stroke-width="5"/>'
        f'<path fill="#111111" d="{icon_rbn}"/></svg>\n',
        encoding="utf-8",
    )
    print("zapisano: public/logo.svg, lib/logo-paths.ts, app/icon.svg")


if __name__ == "__main__":
    main()
