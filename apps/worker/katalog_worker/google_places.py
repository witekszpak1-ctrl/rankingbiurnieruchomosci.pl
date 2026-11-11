"""Ocena i opinie firmy z Google przez oficjalne Places API (New), bez pobierania stron Google Maps.

Wymaga klucza w zmiennej GOOGLE_PLACES_API_KEY. Bez klucza etap jest pomijany.
Szukamy miejsca po nazwie firmy i mieście, a wynik przyjmujemy tylko wtedy, gdy adres strony w Google
wskazuje tę samą domenę co firma albo nazwa jest wyraźnie podobna. Lepiej nie pokazać opinii, niż pokazać cudze.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

import httpx

from .urls import registrable_domain

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
FIELDS = ",".join([
    "places.id", "places.displayName", "places.formattedAddress", "places.websiteUri", "places.rating",
    "places.userRatingCount", "places.googleMapsUri", "places.reviews", "places.types",
])


@dataclass
class PlaceResult:
    place_id: str | None = None
    rating: float | None = None
    rating_count: int | None = None
    maps_url: str | None = None
    reviews: list[dict] = field(default_factory=list)
    status: str = "ok"  # ok | not_found | error


def _review(raw: dict) -> dict | None:
    text = (raw.get("originalText") or raw.get("text") or {}).get("text")
    rating = raw.get("rating")
    author = (raw.get("authorAttribution") or {})
    if not text or not isinstance(rating, (int, float)):
        return None
    return {
        "author": (author.get("displayName") or "Użytkownik Google")[:80],
        "author_url": author.get("uri"),
        "rating": int(rating),
        "text": text[:1500],
        "relative_time": raw.get("relativePublishTimeDescription"),
        "published_at": raw.get("publishTime"),
    }


def pick_place(places: list[dict], domain: str | None, name_ok) -> dict | None:
    """Pierwsze miejsce z tą samą domeną strony, a gdy żadne jej nie ma, pierwsze o pasującej nazwie."""
    for place in places:
        site = place.get("websiteUri")
        if domain and site and registrable_domain(site) == domain:
            return place
    for place in places:
        if name_ok((place.get("displayName") or {}).get("text", "")) and not place.get("websiteUri"):
            return place
    return None


def fetch_place(name: str, city: str, website: str | None, name_ok, client: httpx.Client | None = None,
                api_key: str | None = None) -> PlaceResult:
    key = api_key or os.environ.get("GOOGLE_PLACES_API_KEY", "")
    if not key:
        raise RuntimeError("Brak GOOGLE_PLACES_API_KEY")
    own = client is None
    client = client or httpx.Client(timeout=20.0)
    try:
        response = client.post(
            SEARCH_URL,
            headers={"X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS, "Content-Type": "application/json"},
            json={"textQuery": f"{name} biuro nieruchomości {city}", "languageCode": "pl", "regionCode": "PL",
                  "pageSize": 5},
        )
        if response.status_code != 200:
            return PlaceResult(status="error")
        places = response.json().get("places") or []
    except (httpx.HTTPError, ValueError):
        return PlaceResult(status="error")
    finally:
        if own:
            client.close()
    domain = registrable_domain(website) if website else None
    place = pick_place(places, domain, name_ok)
    if not place:
        return PlaceResult(status="not_found")
    reviews = [r for r in (_review(x) for x in place.get("reviews") or []) if r]
    return PlaceResult(
        place_id=place.get("id"),
        rating=place.get("rating"),
        rating_count=place.get("userRatingCount"),
        maps_url=place.get("googleMapsUri"),
        reviews=reviews[:5],
    )
