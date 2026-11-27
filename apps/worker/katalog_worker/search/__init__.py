from __future__ import annotations

from ..config import Settings
from .base import SearchError, SearchProvider, SearchResult
from .brave import BraveSearch
from .file import FileSearch
from .litescrape import FallbackSearch, LiteScrapeSearch
from .serper import SerperSearch

__all__ = [
    "BraveSearch", "FallbackSearch", "FileSearch", "LiteScrapeSearch", "SearchError", "SearchProvider", "SearchResult",
    "SerperSearch", "make_provider",
]


def make_provider(name: str, settings: Settings | None = None, litescrape=None) -> SearchProvider:
    """Tworzy dostawcę po nazwie: litescrape, serper, brave albo auto (LiteScrape, a w zapasie Serper).

    litescrape: klient LiteScrape z kluczem z panelu (katalog_worker.litescrape.open_client) albo None.
    """
    settings = settings or Settings()
    if name == "brave":
        return BraveSearch(settings.brave_api_key or "")
    if name == "serper":
        return SerperSearch(settings.serper_api_key or "")
    if name == "litescrape":
        if litescrape is None:
            raise SearchError("Brak klucza LiteScrape (panel: /admin/koszty).")
        return LiteScrapeSearch(litescrape)
    if name == "auto":
        backup = SerperSearch(settings.serper_api_key) if settings.serper_api_key else None
        if litescrape is None:
            if backup is None:
                raise SearchError("Brak klucza LiteScrape i SERPER_API_KEY: nie ma czym szukać.")
            return backup
        return FallbackSearch(LiteScrapeSearch(litescrape), backup)
    raise SearchError(f"Nieznany dostawca wyszukiwania: {name!r}")
