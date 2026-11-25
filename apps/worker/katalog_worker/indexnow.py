"""Zgłaszanie nowych i zmienionych stron przez IndexNow (Bing, a przez niego wyszukiwanie w ChatGPT; także Yandex,
Seznam, Naver). Google IndexNow nie obsługuje: tam wystarcza mapa strony w Search Console.

Źródłem adresów jest mapa strony serwisu (/sitemap.xml i trzy mapy z indeksu), więc robot zgłasza dokładnie te
strony, które mają być w indeksie. Zapamiętujemy najnowszą datę lastmod z ostatniego zgłoszenia (settings.indexnow)
i za każdym razem wysyłamy tylko adresy z nowszą datą. Pierwsze uruchomienie (albo --all) zgłasza wszystko.

Klucz nie jest tajny: leży jawnie w pliku /<klucz>.txt na stronie (apps/web/public), tak wymaga protokół.
Usługa jest bezpłatna.
"""

from __future__ import annotations

import os
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from urllib.parse import urlsplit

import httpx

INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
DEFAULT_KEY = "a6eccd683f49bc8d042caccd0b8dda78"
DEFAULT_SITE_URL = "https://rankingbiurnieruchomosci.pl"
SETTINGS_KEY = "indexnow"
BATCH = 10_000  # limit protokołu na jedno zgłoszenie

_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def _parse_date(text: str | None) -> datetime | None:
    if not text:
        return None
    try:
        value = datetime.fromisoformat(text.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def parse_sitemap(xml: str) -> tuple[str, list[tuple[str, datetime | None]]]:
    """Zwraca rodzaj pliku ("index" albo "urlset") i listę (adres, lastmod)."""
    root = ET.fromstring(xml)
    kind = "index" if root.tag == f"{_NS}sitemapindex" else "urlset"
    item = "sitemap" if kind == "index" else "url"
    out = []
    for node in root.iter(f"{_NS}{item}"):
        loc = node.findtext(f"{_NS}loc")
        if loc and loc.strip():
            out.append((loc.strip(), _parse_date(node.findtext(f"{_NS}lastmod"))))
    return kind, out


def collect_urls(client: httpx.Client, sitemap_url: str) -> list[tuple[str, datetime | None]]:
    """Adresy z mapy strony; indeks map rozwija na pliki, które wskazuje (bez dalszego zagłębiania)."""
    response = client.get(sitemap_url)
    response.raise_for_status()
    kind, items = parse_sitemap(response.text)
    if kind == "urlset":
        return items
    urls: list[tuple[str, datetime | None]] = []
    for child, _ in items:
        r = client.get(child)
        r.raise_for_status()
        child_kind, child_items = parse_sitemap(r.text)
        if child_kind == "urlset":
            urls.extend(child_items)
    return urls


def select_changed(urls: list[tuple[str, datetime | None]], since: datetime | None) -> list[str]:
    """Adresy do zgłoszenia: wszystkie, gdy nie było jeszcze zgłoszenia, inaczej te z lastmod nowszym niż since."""
    seen: set[str] = set()
    out = []
    for url, modified in urls:
        if url in seen:
            continue
        seen.add(url)
        if since is None or (modified is not None and modified > since):
            out.append(url)
    return out


def submit(client: httpx.Client, site_url: str, key: str, urls: list[str]) -> int:
    """Wysyła adresy partiami. Zwraca liczbę zgłoszonych; błąd HTTP (np. 403 przy złym kluczu) przerywa."""
    host = urlsplit(site_url).netloc
    sent = 0
    for start in range(0, len(urls), BATCH):
        batch = urls[start:start + BATCH]
        response = client.post(
            INDEXNOW_ENDPOINT,
            json={"host": host, "key": key, "keyLocation": f"{site_url}/{key}.txt", "urlList": batch},
            headers={"Content-Type": "application/json; charset=utf-8"},
        )
        if response.status_code not in (200, 202):
            raise RuntimeError(f"IndexNow: HTTP {response.status_code}: {response.text[:200]}")
        sent += len(batch)
    return sent


def stage_indexnow(repo, client: httpx.Client, *, site_url: str | None = None, key: str | None = None,
                   all_urls: bool = False, dry_run: bool = False) -> dict:
    site_url = (site_url or os.environ.get("SITE_URL") or DEFAULT_SITE_URL).rstrip("/")
    key = key or os.environ.get("INDEXNOW_KEY") or DEFAULT_KEY
    state = repo.setting(SETTINGS_KEY, {}) or {}
    since = None if all_urls else _parse_date(state.get("last_lastmod"))
    urls = collect_urls(client, f"{site_url}/sitemap.xml")
    changed = select_changed(urls, since)
    newest = max((m for _, m in urls if m is not None), default=None)
    counts = {"in_sitemap": len(urls), "to_submit": len(changed)}
    if dry_run or not changed:
        return counts
    counts["submitted"] = submit(client, site_url, key, changed)
    repo.set_setting(SETTINGS_KEY, {
        "last_lastmod": (newest or datetime.now(timezone.utc)).isoformat(),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "last_count": counts["submitted"],
    })
    repo.conn.commit()
    return counts
