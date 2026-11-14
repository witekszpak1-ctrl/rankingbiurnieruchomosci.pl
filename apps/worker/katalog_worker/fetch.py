"""Uprzejmy fetcher: robots.txt, odstęp między zapytaniami do jednego hosta, limit rozmiaru, ręczne przekierowania.

Zasady:
- przed każdym pobraniem sprawdzamy robots.txt hosta (także po przekierowaniu na inny host),
- robots.txt: 4xx = brak ograniczeń, błąd serwera lub sieci = zakaz (ostrożnie, zgodnie z RFC 9309); taki zakaz
  jest tymczasowy (błąd "robots_unreachable"), więc stronę można sprawdzić ponownie później,
- własny User-Agent z adresem kontaktowym, odstęp min_delay_seconds między zapytaniami do tego samego hosta,
- nie omijamy zabezpieczeń: odpowiedź inna niż HTML kończy się błędem, a nie próbą obejścia,
- adres bez "www" (tak zapisujemy domeny), który nie daje się połączyć (certyfikat tylko dla www, brak rekordu DNS
  dla domeny bez www), próbujemy jeszcze z "www"; stronę bez HTTPS przez http. Brak HTTPS to odrzucone połączenie na
  porcie 443 albo certyfikat wystawiony na inną nazwę (domyślny certyfikat hostingu), tak jak otworzy ją przeglądarka.
  Certyfikatu wygasłego, samopodpisanego ani z niepełnym łańcuchem nie omijamy przez http.
"""

from __future__ import annotations

import re
import time
from collections.abc import Callable
from dataclasses import dataclass, replace
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import httpx

_META_CHARSET = re.compile(rb"""charset\s*=\s*["']?([\w\-]+)""", re.I)
_ALLOW_ALL = object()
_DISALLOW_ALL = object()
_UNREACHABLE = object()  # robots.txt niedostępny (sieć, 5xx): nie pobieramy, ale to nie jest zakaz właściciela


@dataclass
class FetchResult:
    url: str
    final_url: str
    status: int | None
    content_type: str
    text: str
    size: int
    robots_allowed: bool
    error: str | None = None  # robots | robots_unreachable | network:<Typ> | http_<kod> | not_html | too_many_redirects
    detail: str | None = None  # szczegół błędu do diagnozy (np. przyczyna niedostępnego robots.txt)

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
        self._robots_problem: dict[str, str] = {}  # origin -> przyczyna niedostępnego robots.txt (do diagnozy)
        self._origin_alias: dict[str, str] = {}  # origin bez www, który nie działa -> działający (www albo http)

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
        except httpx.HTTPError as exc:
            self._robots_problem[origin] = f"{type(exc).__name__}: {str(exc)[:120]}"
            return _UNREACHABLE
        if response.status_code >= 500:
            self._robots_problem[origin] = f"http_{response.status_code}"
            return _UNREACHABLE
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
        if rules is _DISALLOW_ALL or rules is _UNREACHABLE:
            return False
        return rules.can_fetch(self._ua, url)  # type: ignore[union-attr]

    def robots_problem(self, url: str) -> str | None:
        """Przyczyna niedostępnego robots.txt hosta (np. "ConnectError: ..." albo "http_503"), jeśli była."""
        parts = urlsplit(url)
        return self._robots_problem.get(f"{parts.scheme}://{parts.netloc}")

    def robots_unreachable(self, url: str) -> bool:
        """Czy zakaz dla adresu wynika tylko z niedostępnego robots.txt (a nie z reguł właściciela strony)."""
        parts = urlsplit(url)
        return self._robots.get(f"{parts.scheme}://{parts.netloc}") is _UNREACHABLE

    # ------------------------------------------------------------------ pobieranie

    def fetch(self, url: str) -> FetchResult:
        """Pobiera adres; gdy host bez www nie daje się połączyć, próbuje wersji z www (a bez HTTPS przez http)."""
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        alias = self._origin_alias.get(origin)
        if alias:
            return replace(self._fetch_once(alias + url[len(origin):]), url=url)
        result = self._fetch_once(url)
        for alternative in _alternative_origins(parts, result):
            retry = self._fetch_once(alternative + url[len(origin):])
            if retry.status is not None or retry.error == "robots":
                # tamten adres odpowiada (także zakazem w robots.txt, który szanujemy): odtąd używamy go dla hosta
                self._origin_alias[origin] = alternative
                return replace(retry, url=url)
        return result

    def _fetch_once(self, url: str) -> FetchResult:
        current = url
        headers = {"User-Agent": self._ua, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5"}
        for _ in range(self._max_redirects + 1):
            if not self.allowed(current):
                if self.robots_unreachable(current):
                    return FetchResult(url, current, None, "", "", 0, False, "robots_unreachable", self.robots_problem(current))
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
                return FetchResult(
                    url, current, None, "", "", 0, True, f"network:{type(exc).__name__}", f"{type(exc).__name__}: {str(exc)[:120]}"
                )
        return FetchResult(url, current, None, "", "", 0, True, "too_many_redirects")


def _alternative_origins(parts, result: FetchResult) -> list[str]:
    """Inne adresy hosta do sprawdzenia, gdy połączenie się nie udało (nie przy odpowiedzi serwera ani przekroczeniu
    czasu): z www, gdy host jest bez www, oraz http, gdy strona nie ma HTTPS (port 443 odrzuca połączenie albo
    certyfikat jest na inną nazwę)."""
    detail = result.detail or ""
    connect_failed = (result.error == "robots_unreachable" and detail.startswith("ConnectError")) or (
        result.error == "network:ConnectError"
    )
    host = parts.hostname or ""
    if not connect_failed or not host:
        return []
    out: list[str] = []
    if not host.startswith("www."):
        out.append(urlunsplit((parts.scheme, "www." + parts.netloc, "", "", "")))
    if parts.scheme == "https" and ("Connection refused" in detail or "Hostname mismatch" in detail):
        # strona bez własnego HTTPS (port zamknięty albo domyślny certyfikat hostingu na inną nazwę)
        out.append(urlunsplit(("http", parts.netloc, "", "", "")))
    return out
