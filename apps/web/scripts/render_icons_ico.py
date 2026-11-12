"""Tworzy app/favicon.ico (16, 32 i 48 px) z podglądu scripts/icon-256.png (najpierw: node scripts/render_icons.cjs)."""

from pathlib import Path

from PIL import Image

WEB = Path(__file__).resolve().parents[1]
source = Image.open(WEB / "scripts" / "icon-256.png").convert("RGBA")
source.save(WEB / "app" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
(WEB / "scripts" / "icon-256.png").unlink()
print("zapisano: app/favicon.ico")
