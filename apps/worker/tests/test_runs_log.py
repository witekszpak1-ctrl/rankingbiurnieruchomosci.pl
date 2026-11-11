"""Przebiegi widoczne w panelu: raporty sesji Claude i zapis każdego polecenia CLI."""

import json

from katalog_worker import cli
from katalog_worker.pipeline import Context, import_sessions
from katalog_worker.repo import Repo
from katalog_worker.verticals import load_vertical


def test_import_sessions_saves_each_report_once(db, tmp_path):
    ctx = Context(Repo(db), load_vertical("nieruchomosci"), tmp_path / "snap", tmp_path / "queue")
    folder = tmp_path / "queue" / "results" / "sessions"
    folder.mkdir(parents=True)
    (folder / "2026-11-11T0641.json").write_text(json.dumps({
        "started_at": "2026-11-11T05:41:00Z",
        "finished_at": "2026-11-11T06:30:00Z",
        "described": 42,
        "skipped": 3,
        "cities": [{"name": "Kraków", "deep": True, "domains": 120}, {"name": "Tarnów", "domains": 15}],
    }), encoding="utf-8")
    (folder / "broken.json").write_text("{nie json", encoding="utf-8")

    assert import_sessions(ctx) == 1
    assert import_sessions(ctx) == 0
    row = db.execute("select status, counts, finished_at - started_at as took from pipeline_runs where stage = 'claude_session'").fetchone()
    assert row["status"] == "ok"
    assert row["counts"]["described"] == 42
    assert row["counts"]["new_domains"] == 135
    assert row["counts"]["city_list"] == "Kraków (dokładnie), Tarnów"
    assert row["took"].total_seconds() == 49 * 60


def test_cli_logs_start_and_result_of_command(db, db_url, monkeypatch, tmp_path):
    monkeypatch.setenv("DATABASE_URL", db_url)
    monkeypatch.setenv("QUEUE_DIR", str(tmp_path / "queue"))
    monkeypatch.setenv("SNAPSHOTS_DIR", str(tmp_path / "snap"))
    assert cli.main(["publish-ready"]) == 0
    db.commit()
    row = db.execute("select stage, status, finished_at from pipeline_runs where stage = 'publish'").fetchone()
    assert row["status"] == "ok" and row["finished_at"] is not None


def test_cli_marks_failed_command(db, db_url, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", db_url)

    def boom(args):
        raise RuntimeError("awaria")

    monkeypatch.setattr(cli, "cmd_bundle", boom)
    parser_main = cli.build_parser
    monkeypatch.setattr(cli, "build_parser", lambda: _with_func(parser_main(), "bundle", boom))
    try:
        cli.main(["bundle"])
    except RuntimeError:
        pass
    db.commit()
    row = db.execute("select status, errors from pipeline_runs where stage = 'bundle'").fetchone()
    assert row["status"] == "failed"
    assert row["errors"][0]["message"] == "awaria"


def _with_func(parser, name, func):
    for action in parser._subparsers._group_actions:
        action.choices[name].set_defaults(func=func)
    return parser
