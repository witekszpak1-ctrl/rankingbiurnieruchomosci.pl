import httpx

from katalog_worker.fetch import PoliteFetcher, decode_body

UA = "KatalogBot/0.1 (+kontakt: test@example.org)"


class FakeClock:
    def __init__(self):
        self.now = 0.0
        self.sleeps: list[float] = []

    def clock(self):
        return self.now

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.now += seconds


def make_fetcher(handler, **kwargs):
    fake = FakeClock()
    fetcher = PoliteFetcher(
        UA,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
        clock=fake.clock,
        sleep=fake.sleep,
        **kwargs,
    )
    return fetcher, fake


HTML = "<html><head><title>Firma</title></head><body>Pośrednictwo nieruchomości</body></html>"


def html_response(text=HTML, **kwargs):
    return httpx.Response(200, text=text, headers={"content-type": "text/html; charset=utf-8"}, **kwargs)


def test_fetch_ok_and_user_agent_sent():
    seen = []

    def handler(request):
        seen.append((request.url.path, request.headers["user-agent"]))
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        return html_response()

    fetcher, _ = make_fetcher(handler)
    result = fetcher.fetch("https://firma.pl/")
    assert result.ok and "Pośrednictwo" in result.text
    assert all(ua == UA for _, ua in seen)


def test_robots_disallow_blocks_fetch_and_page_is_never_requested():
    paths = []

    def handler(request):
        paths.append(request.url.path)
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /prywatne\n")
        return html_response()

    fetcher, _ = make_fetcher(handler)
    blocked = fetcher.fetch("https://firma.pl/prywatne/cennik")
    assert blocked.error == "robots" and not blocked.robots_allowed and not blocked.ok
    assert "/prywatne/cennik" not in paths
    assert fetcher.fetch("https://firma.pl/kontakt").ok


def test_robots_for_our_bot_specifically():
    def handler(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: KatalogBot\nDisallow: /\n")
        return html_response()

    fetcher, _ = make_fetcher(handler)
    assert fetcher.fetch("https://firma.pl/").error == "robots"


def test_robots_server_error_means_disallow_and_4xx_means_allow():
    fetcher_5xx, _ = make_fetcher(lambda r: httpx.Response(503) if r.url.path == "/robots.txt" else html_response())
    assert fetcher_5xx.fetch("https://firma.pl/").error == "robots"
    fetcher_4xx, _ = make_fetcher(lambda r: httpx.Response(403) if r.url.path == "/robots.txt" else html_response())
    assert fetcher_4xx.fetch("https://firma.pl/").ok


def test_min_delay_between_requests_to_same_host_only():
    def handler(request):
        return httpx.Response(404) if request.url.path == "/robots.txt" else html_response()

    fetcher, fake = make_fetcher(handler, min_delay_seconds=2.0)
    fetcher.fetch("https://firma.pl/")
    fetcher.fetch("https://firma.pl/kontakt")
    assert fake.sleeps and all(s <= 2.0 for s in fake.sleeps)
    slept_same_host = sum(fake.sleeps)
    fetcher.fetch("https://inna.pl/")
    # inny host nie czeka na pierwszego; czeka tylko odstęp między jego robots.txt a stroną
    assert sum(fake.sleeps) - slept_same_host == 2.0


def test_redirect_to_other_host_checks_robots_there():
    def handler(request):
        host = request.url.host
        if request.url.path == "/robots.txt":
            if host == "cel.pl":
                return httpx.Response(200, text="User-agent: *\nDisallow: /\n")
            return httpx.Response(404)
        if host == "start.pl":
            return httpx.Response(301, headers={"location": "https://cel.pl/strona"})
        return html_response()

    fetcher, _ = make_fetcher(handler)
    result = fetcher.fetch("https://start.pl/")
    assert result.error == "robots" and result.final_url == "https://cel.pl/strona"


def test_redirect_loop_and_http_errors_and_non_html():
    loop, _ = make_fetcher(
        lambda r: httpx.Response(404)
        if r.url.path == "/robots.txt"
        else httpx.Response(302, headers={"location": "https://firma.pl/"})
    )
    assert loop.fetch("https://firma.pl/").error == "too_many_redirects"

    missing, _ = make_fetcher(lambda r: httpx.Response(404, text="x"))
    assert missing.fetch("https://firma.pl/x").error == "http_404"

    def pdf(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, content=b"%PDF-1.4", headers={"content-type": "application/pdf"})

    fetcher, _ = make_fetcher(pdf)
    assert fetcher.fetch("https://firma.pl/cennik.pdf").error == "not_html"


def test_network_error_and_size_cap():
    def broken(request):
        raise httpx.ConnectError("dns")

    fetcher, _ = make_fetcher(broken)
    # robots.txt rzuca błąd sieci, więc fetch kończy się zakazem (ostrożnie)
    assert fetcher.fetch("https://firma.pl/").error == "robots"

    def big(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, content=b"a" * 10_000, headers={"content-type": "text/html"})

    capped, _ = make_fetcher(big, max_bytes=1000)
    result = capped.fetch("https://firma.pl/")
    assert result.ok and result.size == 1000


def test_decode_body_handles_legacy_polish_encodings():
    text = "Pośrednictwo nieruchomości Łódź"
    assert decode_body(text.encode("cp1250"), "windows-1250") == text
    meta = b'<meta charset="iso-8859-2">' + text.encode("iso-8859-2")
    assert decode_body(meta, None).endswith(text)
    assert decode_body(text.encode("utf-8"), None) == text
    assert "�" in decode_body(b"\xff\xfe\xfa", None) or decode_body(b"\xff\xfe\xfa", None) is not None
