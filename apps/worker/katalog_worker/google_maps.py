"""Ocena i opinie firmy z Map Google przez LiteScrape (zastępuje Google Places API, które było za drogie).

Dwa zapytania na firmę: wyszukanie miejsca w Mapach (nazwa, "biuro nieruchomości", miasto; wynik to lista
local_results albo, gdy Google od razu otwiera jedno miejsce, place_results) i opinie tego miejsca
(do 100 w jednym zapytaniu, zapisujemy treść, ocenę, datę, autora i odpowiedź firmy). Wynik przyjmujemy tylko wtedy,
gdy strona firmy w Mapach wskazuje tę samą domenę co firma albo nazwa jest wyraźnie podobna.
Lepiej nie pokazać opinii, niż pokazać cudze.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import quote

from .litescrape import LiteScrapeClient, LiteScrapeError, LiteScrapeUnavailable
from .urls import registrable_domain


@dataclass
class PlaceResult:
    place_id: str | None = None
    rating: float | None = None
    rating_count: int | None = None
    maps_url: str | None = None
    reviews: list[dict] = field(default_factory=list)
    status: str = "ok"  # ok | not_found | error
    http_status: int | None = None
    unavailable: bool = False  # klucz odrzucony albo brak salda: nie wysyłamy kolejnych zapytań


def _text(raw: dict | None) -> str | None:
    if not isinstance(raw, dict):
        return None
    extracted = raw.get("extracted_snippet") if isinstance(raw.get("extracted_snippet"), dict) else {}
    text = extracted.get("original") or raw.get("snippet") or extracted.get("translated")
    return text.strip() if isinstance(text, str) and text.strip() else None


def review_from(raw: dict) -> dict | None:
    """Opinia w formacie zapisywanym w google_places.reviews. Opinie bez treści pomijamy."""
    text = _text(raw)
    rating = raw.get("rating")
    if not text or not isinstance(rating, (int, float)) or not 1 <= rating <= 5:
        return None
    user = raw.get("user") if isinstance(raw.get("user"), dict) else {}
    out = {
        "author": (user.get("name") or "Użytkownik Google")[:80],
        "rating": int(round(rating)),
        "text": text[:1500],
        "relative_time": raw.get("date") if isinstance(raw.get("date"), str) else None,
        "published_at": raw.get("iso_date") if isinstance(raw.get("iso_date"), str) else None,
    }
    reply = _text(raw.get("response"))
    if reply:
        out["reply"] = reply[:1500]
        response = raw["response"]
        if isinstance(response.get("iso_date"), str):
            out["reply_at"] = response["iso_date"]
    return out


def pick_place(places: list[dict], domain: str | None, name_ok) -> dict | None:
    """Pierwsze miejsce z tą samą domeną strony, a gdy żadne jej nie ma, pierwsze o pasującej nazwie bez strony."""
    open_places = [p for p in places if isinstance(p, dict) and not p.get("permanently_closed") and p.get("place_id")]
    for place in open_places:
        site = place.get("website")
        if domain and site and registrable_domain(site) == domain:
            return place
    for place in open_places:
        if name_ok(place.get("title") or "") and not place.get("website"):
            return place
    return None


def maps_url(title: str, place_id: str) -> str:
    """Oficjalny format linku do miejsca w Mapach Google (Maps URLs)."""
    return f"https://www.google.com/maps/search/?api=1&query={quote(title or 'miejsce')}&query_place_id={quote(place_id)}"


def _rating(value) -> float | None:
    return round(float(value), 1) if isinstance(value, (int, float)) and 1 <= value <= 5 else None


def fetch_place(client: LiteScrapeClient, name: str, city: str, website: str | None, name_ok,
                reviews_per_place: int = 50) -> PlaceResult:
    try:
        data = client.maps_search(f"{name} biuro nieruchomości {city}")
    except LiteScrapeError as exc:
        return PlaceResult(status="error", http_status=exc.status, unavailable=isinstance(exc, LiteScrapeUnavailable))
    places = data.get("local_results") if isinstance(data.get("local_results"), list) else []
    # Jednoznaczne zapytanie: Google od razu otwiera jedno miejsce (place_results zamiast listy).
    if isinstance(data.get("place_results"), dict):
        places = [data["place_results"], *places]
    domain = registrable_domain(website) if website else None
    place = pick_place(places, domain, name_ok)
    if not place:
        return PlaceResult(status="not_found")
    result = PlaceResult(
        place_id=place["place_id"],
        rating=_rating(place.get("rating")),
        rating_count=place.get("reviews") if isinstance(place.get("reviews"), int) else None,
        maps_url=maps_url(place.get("title") or name, place["place_id"]),
    )
    if not result.rating_count:
        return result  # miejsce bez opinii: nie płacimy za drugie zapytanie
    try:
        reviews = client.reviews(place["place_id"], num=reviews_per_place)
    except LiteScrapeError as exc:
        # Ocena z wyszukiwania jest pewna, opinie dociągniemy przy następnym odświeżeniu.
        result.unavailable = isinstance(exc, LiteScrapeUnavailable)
        return result
    info = reviews.get("place_info") if isinstance(reviews.get("place_info"), dict) else {}
    result.rating = result.rating or _rating(info.get("rating"))
    if not result.rating_count and isinstance(info.get("reviews"), int):
        result.rating_count = info["reviews"]
    items = reviews.get("reviews") if isinstance(reviews.get("reviews"), list) else []
    result.reviews = [r for r in (review_from(x) for x in items if isinstance(x, dict)) if r][:100]
    return result
