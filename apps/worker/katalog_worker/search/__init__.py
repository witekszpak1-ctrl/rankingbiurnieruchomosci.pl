from __future__ import annotations

from ..config import Settings
from .base import SearchError, SearchProvider, SearchResult
from .brave import BraveSearch
from .serper import SerperSearch

__all__ = ["BraveSearch", "SearchError", "SearchProvider", "SearchResult", "SerperSearch", "make_provider"]


def make_provider(name: str, settings: Settings | None = None) -> SearchProvider:
    """Tworzy dostawcę po nazwie ('brave' lub 'serper') z kluczem ze środowiska."""
    settings = settings or Settings()
    if name == "brave":
        return BraveSearch(settings.brave_api_key or "")
    if name == "serper":
        return SerperSearch(settings.serper_api_key or "")
    raise SearchError(f"Nieznany dostawca wyszukiwania: {name!r}")
