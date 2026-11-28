from datetime import datetime, timezone

from katalog_worker.api_usage import add, days_left, limit_of, month_key, reserve, run_budget


def test_month_and_days_left_in_utc():
    now = datetime(2026, 11, 22, 23, 30, tzinfo=timezone.utc)
    assert month_key(now) == "2026-11"
    assert days_left(now) == 9
    assert days_left(datetime(2026, 2, 28, tzinfo=timezone.utc)) == 1


def test_no_default_limits_and_settings_set_them():
    # Google Places jest wyłączone, LiteScrape ma przedpłacone saldo: domyślnie bez limitu.
    assert limit_of({}, "google_places") is None
    assert limit_of({}, "litescrape") is None
    assert limit_of({"limits": {"google_places": 500}}, "google_places") == 500
    assert limit_of({"limits": {"google_places": 0}}, "google_places") == 0
    assert limit_of({}, "serper") is None


def test_reserve_stops_exactly_at_limit_and_resets_next_month():
    value = {"limits": {"google_places": 3}}
    allowed = []
    for _ in range(5):
        ok, value, used, limit = reserve(value, "2026-11", "google_places")
        allowed.append(ok)
    assert allowed == [True, True, True, False, False]
    assert value["months"]["2026-11"]["google_places"] == 3
    ok, value, used, _ = reserve(value, "2026-12", "google_places")
    assert ok and used == 1


def test_add_counts_without_limit_check():
    value = add({"limits": {"litescrape": 1}}, "2026-11", {"litescrape": 5, "litescrape:fetch": 5, "x": 0})
    value = add(value, "2026-11", {"litescrape": 2})
    assert value["months"]["2026-11"] == {"litescrape": 7, "litescrape:fetch": 5}


def test_reserve_uses_seed_when_month_has_no_counter():
    ok, value, used, limit = reserve({"limits": {"google_places": 950}}, "2026-11", "google_places", seed=2045)
    assert not ok and used == 2045 and limit == 950
    assert value["months"]["2026-11"]["google_places"] == 2045


def test_old_months_are_trimmed():
    value = {"months": {f"2025-{m:02d}": {"google_places": 1} for m in range(1, 13)}}
    _, value, _, _ = reserve(value, "2026-01", "google_places")
    assert len(value["months"]) == 12 and "2025-01" not in value["months"]


def test_run_budget_spreads_remaining_limit_over_days():
    assert run_budget(0, 950, 30, 100) == 32
    assert run_budget(940, 950, 9, 100) == 2
    assert run_budget(950, 950, 9, 100) == 0
    assert run_budget(2045, 950, 9, 100) == 0
    assert run_budget(0, None, 9, 100) == 100


def test_repo_reserve_counts_in_settings_and_seeds_from_google_places(db):
    from katalog_worker.repo import Repo

    repo = Repo(db)
    brand = db.execute("insert into brands (name, slug) values ('Alfa', 'alfa') returning id").fetchone()["id"]
    db.execute("insert into google_places (brand_id, status) values (%s, 'ok')", (brand,))
    db.execute("""insert into settings (key, value) values ('api_usage', '{"limits": {"google_places": 3}}'::jsonb)""")
    db.commit()
    assert repo.api_usage_status("google_places") == (1, 3)  # szacunek: 1 firma pobrana w tym miesiącu
    results = [repo.api_usage_reserve("google_places")[0] for _ in range(3)]
    assert results == [True, True, False]
    assert repo.api_usage_status("google_places") == (3, 3)
    repo.api_usage_add({"litescrape": 4, "litescrape:maps": 4})
    repo.api_usage_add({"litescrape": 1})
    assert repo.api_usage_status("litescrape") == (5, None)
    value = db.execute("select value from settings where key = 'api_usage'").fetchone()["value"]
    assert value["limits"] == {"google_places": 3}
    assert list(value["months"].values())[0]["litescrape:maps"] == 4


def test_google_reviews_stage_without_key_does_nothing(db):
    from katalog_worker import pipeline
    from katalog_worker.litescrape import LiteScrapeConfig
    from katalog_worker.repo import Repo

    class Ctx:
        pass

    ctx = Ctx()
    ctx.repo = Repo(db)
    out = pipeline.stage_google_reviews(ctx, None, LiteScrapeConfig(), limit=100)
    assert out["skipped"].startswith("brak klucza LiteScrape")


def test_not_found_keeps_previous_rating(db):
    from katalog_worker.google_maps import PlaceResult
    from katalog_worker.repo import Repo

    repo = Repo(db)
    brand = str(db.execute("insert into brands (name, slug) values ('Beta', 'beta') returning id").fetchone()["id"])
    repo.save_google_place(brand, PlaceResult(place_id="p", rating=4.5, rating_count=10, reviews=[{"author": "A", "rating": 5, "text": "Dobrze"}]))
    repo.save_google_place(brand, PlaceResult(status="not_found"))
    row = db.execute("select status, rating, jsonb_array_length(reviews) as n from google_places where brand_id = %s", (brand,)).fetchone()
    assert (row["status"], float(row["rating"]), row["n"]) == ("ok", 4.5, 1)
    other = str(db.execute("insert into brands (name, slug) values ('Gamma', 'gamma') returning id").fetchone()["id"])
    repo.save_google_place(other, PlaceResult(status="not_found"))
    assert db.execute("select status from google_places where brand_id = %s", (other,)).fetchone()["status"] == "not_found"
