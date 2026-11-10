from katalog_worker.ids import (
    find_krs,
    find_nips,
    find_regons,
    is_valid_nip,
    is_valid_regon,
    normalize_krs,
    normalize_nip,
)


def test_valid_nip_checksum():
    assert is_valid_nip("7740001454")
    assert is_valid_nip("1234563218")
    assert not is_valid_nip("7740001455")
    assert not is_valid_nip("123")
    assert not is_valid_nip(None)


def test_nip_with_check_value_10_is_invalid():
    # suma kontrolna 10 nigdy nie jest poprawna
    assert not is_valid_nip("1000000010")


def test_normalize_nip_variants():
    assert normalize_nip("PL 774-000-14-54") == "7740001454"
    assert normalize_nip("774 00 01 454") == "7740001454"
    assert normalize_nip("123") is None
    assert normalize_nip(None) is None


def test_regon_checksum():
    assert is_valid_regon("610188201")
    assert is_valid_regon("123456785")
    assert not is_valid_regon("610188202")
    assert not is_valid_regon("12345")


def test_normalize_krs_pads_zeros():
    assert normalize_krs("123456") == "0000123456"
    assert normalize_krs("") is None
    assert normalize_krs("12345678901") is None


def test_find_nips_needs_keyword_and_valid_checksum():
    text = "Firma X. NIP: 774-000-14-54. Tel. 7740001454. NIP 7740001455 (błędny). Numer VAT UE: PL1234563218."
    values = {hit.value for hit in find_nips(text)}
    assert values == {"7740001454", "1234563218"}


def test_find_nips_ignores_bare_numbers():
    assert find_nips("Zadzwoń 7740001454 po ofertę") == []


def test_find_regons_and_krs():
    text = "REGON: 123456785, KRS 0000123456"
    assert [h.value for h in find_regons(text)] == ["123456785"]
    assert [h.value for h in find_krs(text)] == ["0000123456"]


import pytest as _pytest  # noqa: E402


@_pytest.mark.parametrize(
    "text",
    [
        "NIP/REGON: 1234563218 / 123456785",
        "NIP / REGON 123-456-32-18 / 123456785",
        "NIP, KRS: 1234563218, 0000123456",
        "NIP i REGON: 1234563218 i 123456785",
        "N.I.P. 123-456-32-18",
        "N.I.P: 1234563218",
        "REGON/NIP: 123456785 / 1234563218",
        "KRS/NIP: 0000123456 / 123-456-32-18",
    ],
)
def test_find_nips_handles_combined_and_dotted_labels(text):
    from katalog_worker.ids import find_nips

    assert [h.value for h in find_nips(text)] == ["1234563218"]


@_pytest.mark.parametrize(
    "text", ["tel. 123 456 32 18", "NIP 1234563219", "NIPOWY 1234563218", "REGON: 123456785"]
)
def test_find_nips_still_rejects_phones_bad_checksums_and_other_ids(text):
    from katalog_worker.ids import find_nips

    assert find_nips(text) == []
