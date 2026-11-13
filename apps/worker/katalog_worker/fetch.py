"""Uprzejmy fetcher: robots.txt, odstęp między zapytaniami do jednego hosta, limit rozmiaru, ręczne przekierowania.

Zasady:
- przed każdym pobraniem sprawdzamy robots.txt hosta (także po przekierowaniu na inny host),
- robots.txt: 4xx = brak ograniczeń, błąd serwera lub sieci = zakaz (ostrożnie, zgodnie z RFC 9309),
- własny User-Agent z adresem kontaktowym, odstęp min_delay_seconds między zapytaniami do tego samego hosta,
- nie omijamy zabezpieczeń: odpowiedź inna niż HTML kończy się błędem, a nie próbą obejścia.
"""

from __future__ import annotations

import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import httpx

_META_CHARSET = re.compile(rb"""charset\s*=\s*["']?([\w\-]+)""", re.I)
_ALLOW_ALL = object()
_DISALLOW_ALL = object()


@dataclass
class FetchResult:
    url: str
    final_url: str
    status: int | None
    content_type: str
    text: str
    size: int
    robots_allowed: bool
    error: str | None = None  # robots | network:<Typ> | http_<kod> | not_html | too_many_redirects

    @property
    def ok(self) -> bool:
        return self.error is None and self.status == 200


def decode_body(content: bytes, header_charset: str | None) -> str:
    """Dekoduje treść: charset z nagłówka, potem z meta, potem UTF-8, na końcu UTF-8 z zastępowaniem."""
    candidates: list[str] = []
    if header_charset:
        candidates.append(header_charset)
    meta = _META_CHARSET.search(content[:4096])
    if meta:
        candidates.append(meta.group(1).decode("ascii", "ignore"))
    candidates.append("utf-8")
    for name in candidates:
        try:
            return content.decode(name)
        except (UnicodeDecodeError, LookupError):
            continue
    return content.decode("utf-8", errors="replace")


class PoliteFetcher:
    def __init__(
        self,
        user_agent: str,
        *,
        min_delay_seconds: float = 2.0,
        max_bytes: int = 2_000_000,
        max_redirects: int = 5,
        timeout: float = 20.0,
        client: httpx.Client | None = None,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._ua = user_agent
        self._min_delay = min_delay_seconds
        self._max_bytes = max_bytes
        self._max_redirects = max_redirects
        self._client = client or httpx.Client(timeout=timeout)
        self._clock = clock
        self._sleep = sleep
        self._last_request: dict[str, float] = {}
        self._robots: dict[str, object] = {}

    def clone(self) -> "PoliteFetcher":
        """Nowy fetcher z tymi samymi ustawieniami i własnym klientem HTTP (do pracy w osobnym wątku).

        Każdy wątek obsługuje inne domeny, więc odstęp między zapytaniami do jednego hosta nadal obowiązuje.
        """
        return PoliteFetcher(
            self._ua, min_delay_seconds=self._min_delay, max_bytes=self._max_bytes,
            max_redirects=self._max_redirects, timeout=self._client.timeout,
        )

    # ------------------------------------------------------------------ robots

    def _wait(self, host: str) -> None:
        last = self._last_request.get(host)
        if last is not None:
            remaining = self._min_delay - (self._clock() - last)
            if remaining > 0:
                self._sleep(remaining)
        self._last_request[host] = self._clock()

    def _load_robots(self, origin: str, host: str) -> object:
        self._wait(host)
        try:
            response = self._client.get(
                f"{origin}/robots.txt", headers={"User-Agent": self._ua}, follow_redirects=True
            )
        except httpx.HTTPError:
            return _DISALLOW_ALL
        if response.status_code >= 500:
            return _DISALLOW_ALL
        if response.status_code != 200:
            return _ALLOW_ALL
        parser = RobotFileParser()
        parser.parse(decode_body(response.content[: 512 * 1024], response.charset_encoding).splitlines())
        return parser

    def allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in self._robots:
            self._robots[origin] = self._load_robots(origin, parts.netloc)
        rules = self._robots[origin]
        if rules is _ALLOW_ALL:
            return True
        if rules is _DISALLOW_ALL:
            return False
        return rules.can_fetch(self._ua, url)  # type: ignore[union-attr]

    # ------------------------------------------------------------------ pobieranie

    def fetch(self, url: str) -> FetchResult:
        current = url
        headers = {"User-Agent": self._ua, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5"}
        for _ in range(self._max_redirects + 1):
            if not self.allowed(current):
                return FetchResult(url, current, None, "", "", 0, False, "robots")
            self._wait(urlsplit(current).netloc)
            try:
                with self._client.stream("GET", current, headers=headers, follow_redirects=False) as response:
                    if response.status_code in (301, 302, 303, 307, 308) and response.headers.get("location"):
                        current = urljoin(current, response.headers["location"])
                        continue
                    ctype = response.headers.get("content-type", "").lower()
                    if response.status_code != 200:
                        return FetchResult(url, current, response.status_code, ctype, "", 0, True, f"http_{response.status_code}")
                    if not (ctype.startswith("text/") or "html" in ctype or "xml" in ctype):
                        return FetchResult(url, current, 200, ctype, "", 0, True, "not_html")
                    chunks: list[bytes] = []
                    size = 0
                    for chunk in response.iter_bytes():
                        chunks.append(chunk)
                        size += len(chunk)
                        if size >= self._max_bytes:
                            break
                    content = b"".join(chunks)[: self._max_bytes]
                    text = decode_body(content, response.charset_encoding)
                    return FetchResult(url, current, 200, ctype, text, len(content), True)
            except httpx.HTTPError as exc:
                return FetchResult(url, current, None, "", "", 0, True, f"network:{type(exc).__name__}")
        return FetchResult(url, current, None, "", "", 0, True, "too_many_redirects")
