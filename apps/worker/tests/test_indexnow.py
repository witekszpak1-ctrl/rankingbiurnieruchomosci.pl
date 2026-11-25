"""IndexNow: adresy z mapy strony (indeks i trzy pliki), zgłaszanie tylko zmienionych, zapis stanu."""

import json

import httpx
import pytest

from katalog_worker.indexnow import parse_sitemap, select_changed, stage_indexnow

SITE = "https://przyklad.pl"
NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'

INDEX = f"""<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex {NS}>
<sitemap><loc>{SITE}/sitemaps/strony.xml</loc></sitemap>
<sitemap><loc>{SITE}/sitemaps/firmy.xml</loc><lastmod>2026-11-20T10:00:00.000Z</lastmod></sitemap>
</sitemapindex>"""

STRONY = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset {NS}>
<url><loc>{SITE}/</loc><lastmod>2026-11-20T10:00:00.000Z</lastmod></url>
<url><loc>{SITE}/bot</loc><lastmod>2026-11-11T00:00:00.000Z</lastmod></url>
</urlset>"""

FIRMY = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset {NS}>
<url><loc>{SITE}/warszawa/stara</loc><lastmod>2026-11-12T00:00:00.000Z</lastmod></url>
<url><loc>{SITE}/warszawa/nowa</loc><lastmod>2026-11-20T09:00:00.000Z</lastmod></url>
<url><loc>{SITE}/krakow/bez-daty</loc></url>
</urlset>"""


class FakeRepo:
    def __init__(self, state=None):
        self.state = state
        self.conn = self

    def setting(self, key, default):
        return self.state if self.state is not None else default

    def set_setting(self, key, value):
        self.state = value

    def commit(self):
        pass


def client(posts: list, status: int = 202) -> httpx.Client:
    pages = {"/sitemap.xml": INDEX, "/sitemaps/strony.xml": STRONY, "/sitemaps/firmy.xml": FIRMY}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            posts.append(json.loads(request.content))
            return httpx.Response(status, text="" if status < 400 else "zly klucz")
        return httpx.Response(200, text=pages[request.url.path])

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_parse_sitemap_index_and_urlset():
    kind, items = parse_sitemap(INDEX)
    assert kind == "index" and [u for u, _ in items] == [f"{SITE}/sitemaps/strony.xml", f"{SITE}/sitemaps/firmy.xml"]
    kind, items = parse_sitemap(FIRMY)
    assert kind == "urlset" and items[2] == (f"{SITE}/krakow/bez-daty", None)


def test_first_run_submits_everything_then_only_newer_pages():
    posts: list = []
    repo = FakeRepo()
    counts = stage_indexnow(repo, client(posts), site_url=SITE, key="k123")
    assert counts == {"in_sitemap": 5, "to_submit": 5, "submitted": 5}
    assert posts[0]["host"] == "przyklad.pl" and posts[0]["key"] == "k123"
    assert posts[0]["keyLocation"] == f"{SITE}/k123.txt"
    assert repo.state["last_lastmod"].startswith("2026-11-20T10:00:00")

    # kolejny przebieg bez zmian w mapie: nic nie wysyłamy
    posts.clear()
    assert stage_indexnow(repo, client(posts), site_url=SITE, key="k123") == {"in_sitemap": 5, "to_submit": 0}
    assert posts == []

    # stan sprzed nowej strony: zgłaszamy tylko adresy z nowszą datą (bez stron bez daty)
    repo.state = {"last_lastmod": "2026-11-15T00:00:00+00:00"}
    counts = stage_indexnow(repo, client(posts), site_url=SITE, key="k123")
    assert counts["submitted"] == 2
    assert sorted(posts[0]["urlList"]) == [f"{SITE}/", f"{SITE}/warszawa/nowa"]


def test_dry_run_and_rejected_key():
    posts: list = []
    repo = FakeRepo()
    assert stage_indexnow(repo, client(posts), site_url=SITE, key="k", dry_run=True) == {"in_sitemap": 5, "to_submit": 5}
    assert posts == [] and repo.state is None
    with pytest.raises(RuntimeError, match="HTTP 403"):
        stage_indexnow(repo, client(posts, status=403), site_url=SITE, key="k")
    assert repo.state is None  # nieudane zgłoszenie nie przesuwa daty


def test_select_changed_skips_duplicates():
    from datetime import datetime, timezone

    d = datetime(2026, 11, 20, tzinfo=timezone.utc)
    assert select_changed([("a", d), ("a", d), ("b", None)], None) == ["a", "b"]
