"""Próbny pomiar odpowiedzi AI w Google przez LiteScrape (zgoda właściciela z 28.11.2026, najwyżej 15 zapytań).

Cel: sprawdzić, czy posiadany LiteScrape daje tanio odpowiedzi AI (Google AI Mode / AI Overview) z cytowanymi
źródłami, zanim platforma GeoTrace kupi droższego dostawcę. Kroki:
1. specyfikacja API LiteScrape (openapi.json, bez klucza) -> lista endpointów związanych z AI,
2. dla endpointu AI Mode: pytania testowe, z odpowiedzi zapisujemy tylko kształt, początek tekstu i linki,
3. dwa zwykłe wyszukiwania Google: czy wynik zawiera blok odpowiedzi AI.
Raport trafia do queue/results/reports/ (repozytorium kolejki), klucz nigdy nie jest wypisywany.
"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

OPENAPI_URL = "https://litescrape.com/api/openapi.json"
AI_RE = re.compile(r"ai[_-]?mode|ai[_-]?overview|overview|chatgpt|gemini|perplexity|llm|copilot|\bai\b", re.I)

PROMPTS = [
    "jakie biuro nieruchomości polecacie w Katowicach",
    "najlepsze biuro nieruchomości we Wrocławiu",
    "godne polecenia biuro nieruchomości Kraków",
    "ile kosztuje pośrednik nieruchomości w Warszawie",
    "biuro rachunkowe Gdańsk polecane",
    "jaka firma od fotowoltaiki jest godna polecenia w Poznaniu",
    "dobry dentysta Łódź",
    "agencja nieruchomości Gdynia opinie",
    "który pośrednik nieruchomości w Lublinie ma najniższą prowizję",
    "polecane biuro nieruchomości Szczecin",
]


def ai_endpoints(spec: dict) -> list[dict]:
    """Endpointy, których ścieżka, opis lub nazwa wskazują na odpowiedzi AI, z nazwami parametrów."""
    out = []
    for path, methods in (spec.get("paths") or {}).items():
        for method, op in (methods or {}).items():
            if not isinstance(op, dict):
                continue
            text = " ".join(str(op.get(k, "")) for k in ("summary", "description", "operationId")) + " " + path
            if not AI_RE.search(text):
                continue
            params = [
                {"name": p.get("name"), "required": bool(p.get("required")), "in": p.get("in")}
                for p in op.get("parameters", []) if isinstance(p, dict)
            ]
            out.append({"path": path, "method": method.upper(), "summary": str(op.get("summary", ""))[:200], "params": params})
    return out


def query_param(params: list[dict]) -> str | None:
    names = [p["name"] for p in params if p.get("in") in (None, "query")]
    for candidate in ("q", "query", "prompt", "question", "keyword"):
        if candidate in names:
            return candidate
    required = [p["name"] for p in params if p.get("required") and p.get("in") in (None, "query")]
    return required[0] if required else None


def _walk(value, found_urls: list[str], texts: list[str], depth: int = 0) -> None:
    if depth > 8:
        return
    if isinstance(value, dict):
        for k, v in value.items():
            if isinstance(v, str):
                if v.startswith("http") and len(found_urls) < 30:
                    found_urls.append(v)
                elif k.lower() in ("text", "snippet", "answer", "content", "markdown", "response") and len(v) > 40:
                    texts.append(v)
            else:
                _walk(v, found_urls, texts, depth + 1)
    elif isinstance(value, list):
        for v in value[:50]:
            if isinstance(v, str):
                if v.startswith("http") and len(found_urls) < 30:
                    found_urls.append(v)
            else:
                _walk(v, found_urls, texts, depth + 1)


def summarize(data: dict) -> dict:
    urls: list[str] = []
    texts: list[str] = []
    _walk(data, urls, texts)
    domains = sorted({re.sub(r"^www\.", "", httpx.URL(u).host or "") for u in urls if httpx.URL(u).host})
    return {
        "keys": sorted(data.keys())[:30],
        "text_excerpt": (texts[0][:600] if texts else None),
        "text_chars": sum(len(t) for t in texts),
        "urls": urls[:15],
        "domains": domains[:20],
    }


def run(client, out_dir: Path, *, max_calls: int = 15, http: httpx.Client | None = None) -> dict:
    http = http or httpx.Client(timeout=30.0)
    report: dict = {"date": datetime.now(timezone.utc).isoformat(timespec="seconds"), "max_calls": max_calls}
    try:
        spec = http.get(OPENAPI_URL).json()
        report["endpoints_ai"] = ai_endpoints(spec)
        report["all_paths"] = sorted((spec.get("paths") or {}).keys())
    except Exception as exc:  # noqa: BLE001
        report["openapi_error"] = f"{type(exc).__name__}: {str(exc)[:200]}"
        report["endpoints_ai"] = []

    calls = 0
    tests = []
    gets = [e for e in report["endpoints_ai"] if e["method"] == "GET" and query_param(e["params"])]
    gets.sort(key=lambda e: (0 if re.search(r"ai[_-]?mode", e["path"], re.I) else 1, e["path"]))
    endpoint = gets[0] if gets else None
    report["endpoint_used"] = endpoint["path"] if endpoint else None
    if endpoint:
        qp = query_param(endpoint["params"])
        names = {p["name"] for p in endpoint["params"]}
        for prompt in PROMPTS:
            if calls >= max_calls - 2:
                break
            params = {qp: prompt}
            if "gl" in names:
                params["gl"] = "pl"
            if "hl" in names:
                params["hl"] = "pl"
            started = time.monotonic()
            try:
                data = client._get("ai", endpoint["path"], params, retries=1, timeout=120.0)
                tests.append({"prompt": prompt, "ok": True, "seconds": round(time.monotonic() - started, 1), **summarize(data)})
            except Exception as exc:  # noqa: BLE001
                tests.append({"prompt": prompt, "ok": False, "seconds": round(time.monotonic() - started, 1), "error": str(exc)[:300]})
            calls += 1
            if not client.available:
                break
    report["ai_tests"] = tests

    overview = []
    for prompt in PROMPTS[:2]:
        if calls >= max_calls or not client.available:
            break
        try:
            data = client.search(prompt, gl="pl", hl="pl")
            ai_keys = [k for k in data.keys() if AI_RE.search(k)]
            overview.append({"prompt": prompt, "ai_keys": ai_keys, **({"ai_block": summarize({k: data[k] for k in ai_keys})} if ai_keys else {})})
        except Exception as exc:  # noqa: BLE001
            overview.append({"prompt": prompt, "error": str(exc)[:300]})
        calls += 1
    report["search_ai_overview"] = overview
    report["calls"] = client.usage()

    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"ai-check-{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H%M')}.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    report["saved"] = str(path)
    return report
