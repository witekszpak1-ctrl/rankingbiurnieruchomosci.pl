import json
from datetime import date

import httpx
import pytest
from conftest import fixture_text

from katalog_worker.ids import is_valid_nip
from katalog_worker.registry import (
    KrsClient,
    MemoryCache,
    MfVatClient,
    QuotaExceeded,
    RegistryBlocked,
    RegistryError,
)
from katalog_worker.registry.base import looks_blocked, normalize_website, parse_address_string, parse_date
from katalog_worker.registry.krs import entity_from_summary, pkd_code, summarize_odpis
from katalog_worker.registry.mf_vat import BATCH_SIZE, _KEEP_FIELDS, entity_from_subject, parse_entries

ORLEN = "7740001454"
PKO = "5250007738"


def make_valid_nips(count: int) -> list[str]:
    nips = []
    n = 100000000
    weights = (6, 5, 7, 2, 3, 4, 5, 6, 7)
    while len(nips) < count:
        digits = str(n)
        check = sum(w * int(d) for w, d in zip(weights, digits)) % 11
        if check != 10:
            nips.append(digits + str(check))
        n += 1
    return nips


def client_for(handler, **kwargs):
    return httpx.Client(transport=httpx.MockTransport(handler))


# ------------------------------------------------------------------ pomocnicze


def test_parse_address_string():
    assert parse_address_string("CHEMIKÓW 7, 09-411 PŁOCK") == ("CHEMIKÓW 7", "09-411", "PŁOCK")
    assert parse_address_string("00-001 WARSZAWA") == (None, "00-001", "WARSZAWA")
    assert parse_address_string("bez kodu") == ("bez kodu", None, None)
    assert parse_address_string(None) == (None, None, None)


def test_parse_date_formats():
    assert parse_date("2001-07-19") == date(2001, 7, 19)
    assert parse_date("19.07.2001") == date(2001, 7, 19)
    assert parse_date("") is None
    assert parse_date("nie data") is None


def test_normalize_website_and_blocked_detection():
    assert normalize_website("WWW.ORLEN.PL") == "https://orlen.pl/"
    assert normalize_website("https://www.firma.pl/kontakt?utm_source=x") == "https://firma.pl/kontakt"
    assert normalize_website("brak") is None
    assert normalize_website("") is None
    assert looks_blocked("application/json", '<html style="height:100%">')
    assert looks_blocked("text/html; charset=utf-8", "{}")
    assert not looks_blocked("application/json", '{"result": {}}')


# ------------------------------------------------------------------ biała lista VAT: parsowanie


def test_parse_real_batch_fixture():
    results = parse_entries(json.loads(fixture_text("registry/mf_batch.json")))
    assert [r.nip for r in results] == [ORLEN, PKO]
    orlen = results[0].entity
    assert orlen.name == "ORLEN SPÓŁKA AKCYJNA"
    assert orlen.vat_status == "Czynny" and orlen.status_active is True
    assert orlen.krs == "0000028860" and orlen.regon == "610188201"
    assert (orlen.street, orlen.postcode, orlen.city) == ("CHEMIKÓW 7", "09-411", "PŁOCK")
    assert orlen.start_date == date(1993, 7, 5)
    assert orlen.to_view().nip == ORLEN


def test_parse_real_error_entry():
    results = parse_entries(json.loads(fixture_text("registry/mf_bad_nip.json")))
    assert len(results) == 1
    assert (results[0].nip, results[0].entity, results[0].error) == ("7740001455", None, "WL-115")


def test_missing_subject_is_none_without_error():
    payload = {"result": {"entries": [{"identifier": ORLEN, "subjects": []}]}}
    [result] = parse_entries(payload)
    assert result.entity is None and result.error is None


def test_sole_proprietor_home_address_keeps_only_city_and_postcode():
    subject = {
        "name": "JAN KOWALSKI", "nip": ORLEN, "statusVat": "Czynny", "krs": None,
        "workingAddress": None, "residenceAddress": "UL. PRYWATNA 5/2, 50-001 WROCŁAW",
        "registrationLegalDate": "2015-01-02",
    }
    entity = entity_from_subject(subject)
    assert entity.street is None
    assert (entity.postcode, entity.city) == ("50-001", "WROCŁAW")


def test_working_address_is_preferred_and_full():
    subject = {
        "name": "JAN KOWALSKI", "nip": ORLEN, "statusVat": "Zwolniony", "krs": None,
        "workingAddress": "UL. BIUROWA 1, 50-100 WROCŁAW", "residenceAddress": "UL. PRYWATNA 5/2, 50-001 WROCŁAW",
    }
    entity = entity_from_subject(subject)
    assert (entity.street, entity.postcode, entity.city) == ("UL. BIUROWA 1", "50-100", "WROCŁAW")
    assert entity.status_active is True


def test_unregistered_or_removed_vat_status_is_unknown_not_inactive():
    base = {"name": "X", "nip": ORLEN, "krs": None, "workingAddress": "A 1, 00-001 X"}
    assert entity_from_subject({**base, "statusVat": "Niezarejestrowany"}).status_active is None
    assert entity_from_subject({**base, "statusVat": "Czynny", "removalDate": "2020-01-01"}).status_active is None


# ------------------------------------------------------------------ biała lista VAT: klient


def test_client_lookup_uses_batch_endpoint_and_caches_sanitized_data():
    requests: list[httpx.Request] = []
    body = fixture_text("registry/mf_batch.json")

    def handler(request):
        requests.append(request)
        return httpx.Response(200, text=body, headers={"content-type": "application/json"})

    cache = MemoryCache()
    mf = MfVatClient(client=client_for(handler), cache=cache, today=lambda: date(2026, 11, 10))
    results = mf.lookup([ORLEN, PKO, ORLEN])
    assert len(requests) == 1
    assert requests[0].url.path == f"/api/search/nips/{ORLEN},{PKO}"
    assert requests[0].url.params["date"] == "2026-11-10"
    assert results[ORLEN].entity.name == "ORLEN SPÓŁKA AKCYJNA"

    cached = cache.get("mf_vat", ORLEN, 7)
    assert set(cached["subject"]) <= set(_KEEP_FIELDS)
    assert "accountNumbers" not in json.dumps(cached) and "representatives" not in json.dumps(cached)

    mf.lookup([ORLEN, PKO])
    assert len(requests) == 1  # drugi raz z cache, bez zapytań


def test_client_invalid_nips_make_no_requests():
    calls = []
    mf = MfVatClient(client=client_for(lambda r: calls.append(r) or httpx.Response(200, json={})))
    results = mf.lookup(["123", "7740001455"])
    assert {r.error for r in results.values()} == {"invalid_nip"}
    assert calls == []


def test_client_splits_into_batches_of_30():
    sizes: list[int] = []

    def handler(request):
        nips = request.url.path.rsplit("/", 1)[1].split(",")
        sizes.append(len(nips))
        entries = [{"identifier": n, "subjects": []} for n in nips]
        return httpx.Response(200, json={"result": {"entries": entries}})

    nips = make_valid_nips(35)
    assert all(is_valid_nip(n) for n in nips)
    mf = MfVatClient(client=client_for(handler), max_requests_per_day=10)
    results = mf.lookup(nips)
    assert sizes == [BATCH_SIZE, 5]
    assert len(results) == 35


def test_client_retries_on_bot_protection_page_then_succeeds():
    html = fixture_text("registry/mf_incapsula.html")
    body = fixture_text("registry/mf_batch.json")
    calls = {"n": 0}
    sleeps: list[float] = []

    def handler(request):
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(200, text=html, headers={"content-type": "text/html"})
        return httpx.Response(200, text=body, headers={"content-type": "application/json"})

    mf = MfVatClient(client=client_for(handler), sleep=sleeps.append)
    assert mf.lookup([ORLEN])[ORLEN].entity is not None
    assert sleeps == [2.0] and mf.requests_made == 2


def test_client_gives_up_with_registry_blocked():
    html = fixture_text("registry/mf_incapsula.html")
    sleeps: list[float] = []
    mf = MfVatClient(
        client=client_for(lambda r: httpx.Response(200, text=html, headers={"content-type": "text/html"})),
        sleep=sleeps.append,
    )
    with pytest.raises(RegistryBlocked):
        mf.lookup([ORLEN])
    assert mf.requests_made == 3 and sleeps == [2.0, 4.0]


def test_client_daily_quota():
    body = fixture_text("registry/mf_batch.json")
    mf = MfVatClient(
        client=client_for(lambda r: httpx.Response(200, text=body, headers={"content-type": "application/json"})),
        max_requests_per_day=1,
    )
    mf.lookup([ORLEN])
    with pytest.raises(QuotaExceeded):
        mf.lookup(["1234563218"])


def test_client_http_errors():
    mf = MfVatClient(client=client_for(lambda r: httpx.Response(500, text="boom")), sleep=lambda s: None)
    with pytest.raises(RegistryError):
        mf.lookup([ORLEN])
    limited = MfVatClient(client=client_for(lambda r: httpx.Response(429, text="limit")), sleep=lambda s: None)
    with pytest.raises(QuotaExceeded):
        limited.lookup([ORLEN])


# ------------------------------------------------------------------ KRS


def _krs_payload() -> dict:
    return json.loads(fixture_text("registry/krs_orlen.json"))


def test_pkd_code_building():
    assert pkd_code({"kodDzial": "68", "kodKlasa": "31", "kodPodklasa": "Z"}) == "68.31.Z"
    assert pkd_code({"kodDzial": "20", "kodKlasa": "1"}) == "20.1"
    assert pkd_code({"kodDzial": "20"}) is None


def test_krs_entity_from_real_fixture():
    summary = summarize_odpis(_krs_payload())
    entity = entity_from_summary(summary)
    assert entity.name == "ORLEN SPÓŁKA AKCYJNA"
    assert entity.legal_form == "SPÓŁKA AKCYJNA"
    assert entity.nip == ORLEN and entity.regon == "61018820100000"
    assert entity.krs == "0000028860"
    assert entity.start_date == date(2001, 7, 19)
    assert entity.website == "https://orlen.pl/"
    assert (entity.street, entity.postcode, entity.city) == ("CHEMIKÓW 7", "09-411", "PŁOCK")
    assert entity.pkd_codes[0] == "19.20.Z"
    assert "06.20.Z" in entity.pkd_codes and "20.1" in entity.pkd_codes
    assert entity.status_active is None  # nie zgadujemy statusu z odpisu


def test_krs_summary_does_not_contain_persons_or_extra_sections():
    summary = summarize_odpis(_krs_payload())
    assert set(summary) == {
        "numerKRS", "dataRejestracjiWKRS", "nazwa", "formaPrawna", "nip", "regon", "adres", "www",
        "pkdPrzewazajace", "pkdPozostale",
    }


def test_real_estate_pkd_is_visible_in_view():
    payload = _krs_payload()
    payload["odpis"]["dane"]["dzial3"]["przedmiotDzialalnosci"]["przedmiotPrzewazajacejDzialalnosci"] = [
        {"opis": "POŚREDNICTWO", "kodDzial": "68", "kodKlasa": "31", "kodPodklasa": "Z"}
    ]
    view = entity_from_summary(summarize_odpis(payload)).to_view()
    assert "68.31.Z" in view.pkd_codes


def test_krs_client_fetch_cache_and_negative_cache():
    body = fixture_text("registry/krs_orlen.json")
    seen = []

    def handler(request):
        seen.append(request)
        if request.url.path.endswith("0000028860"):
            return httpx.Response(200, text=body, headers={"content-type": "application/json"})
        return httpx.Response(404, text="")

    krs = KrsClient(client=client_for(handler))
    entity = krs.fetch("28860")  # numer bez zer wiodących jest uzupełniany
    assert entity.nip == ORLEN
    assert seen[0].url.path == "/api/krs/OdpisAktualny/0000028860"
    assert dict(seen[0].url.params) == {"rejestr": "P", "format": "json"}
    krs.fetch("0000028860")
    assert len(seen) == 1  # z cache

    assert krs.fetch("0000000001") is None
    assert krs.fetch("0000000001") is None
    assert len(seen) == 2  # brak w rejestrze też z cache


def test_krs_client_errors():
    html = fixture_text("registry/mf_incapsula.html")
    blocked = KrsClient(
        client=client_for(lambda r: httpx.Response(200, text=html, headers={"content-type": "text/html"})),
        sleep=lambda s: None,
    )
    with pytest.raises(RegistryBlocked):
        blocked.fetch("0000028860")
    failing = KrsClient(client=client_for(lambda r: httpx.Response(500, text="boom")), sleep=lambda s: None)
    with pytest.raises(RegistryError):
        failing.fetch("0000028860")
    with pytest.raises(RegistryError):
        KrsClient(client=client_for(lambda r: httpx.Response(200, json={}))).fetch("abc")
