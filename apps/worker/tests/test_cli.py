import json

from test_bundle_validate import make_bundle, valid_result

from katalog_worker.cli import main


def test_queries_command(capsys):
    assert main(["queries", "--city", "Wrocław", "--limit", "3"]) == 0
    queries = json.loads(capsys.readouterr().out)
    assert len(queries) == 3 and all("Wrocław" in q for q in queries)


def test_validate_command_exit_codes(tmp_path, capsys):
    bundle = make_bundle()
    result = valid_result(bundle)
    bundle_path, result_path = tmp_path / "bundle.json", tmp_path / "result.json"
    bundle_path.write_text(json.dumps(bundle, ensure_ascii=False), encoding="utf-8")
    result_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    args = ["validate", "--bundle", str(bundle_path), "--result", str(result_path)]
    assert main(args) == 0
    assert json.loads(capsys.readouterr().out)["ok"] is True

    result["description"]["claims"][0]["fact_ids"] = ["f999"]
    result_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    assert main(args) == 1
    report = json.loads(capsys.readouterr().out)
    assert report["ok"] is False and report["errors"][0]["code"] == "unknown_fact_id"


def test_migrate_and_status_commands(db_url, monkeypatch, capsys):
    monkeypatch.setenv("DATABASE_URL", db_url)
    assert main(["migrate"]) == 0
    assert json.loads(capsys.readouterr().out) == {"applied": []}  # szablon ma już wszystko
    assert main(["status"]) == 0
    status = json.loads(capsys.readouterr().out)
    assert set(status) == {
        "domains_by_status", "domains_by_classification", "listings_by_status", "queue_by_status",
        "descriptions_by_status",
    }


def test_discover_file_provider_argument_errors(tmp_path, capsys):
    # brak --file
    assert main(["discover", "--provider", "file"]) == 2
    assert "--file" in capsys.readouterr().err
    # brak --city dla dostawcy z API
    assert main(["discover", "--provider", "serper"]) == 2
    assert "--city" in capsys.readouterr().err
    # plik z innym miastem niż w opcji
    path = tmp_path / "k.json"
    path.write_text(
        json.dumps({"city": "Wrocław", "queries": [{"query": "q", "results": []}]}, ensure_ascii=False),
        encoding="utf-8",
    )
    assert main(["discover", "--provider", "file", "--file", str(path), "--city", "Kraków"]) == 2
    assert "różni się" in capsys.readouterr().err
    # uszkodzony plik
    bad = tmp_path / "zly.json"
    bad.write_text("{", encoding="utf-8")
    assert main(["discover", "--provider", "file", "--file", str(bad)]) == 2
    assert "JSON" in capsys.readouterr().err
