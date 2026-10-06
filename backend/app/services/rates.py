"""Cotações em reais para posições em outra moeda (ex: Cripto acompanhada em dólar).

Busca na AwesomeAPI no máximo uma vez por minuto e guarda a última cotação em
`instance/rates.json`: sem internet, o app segue com o último valor conhecido.
"""

import json
import time
import urllib.request
from decimal import Decimal
from pathlib import Path

from flask import current_app

CURRENCIES = ("BRL", "USD", "EUR", "BTC")
_URL = "https://economia.awesomeapi.com.br/json/last/" + ",".join(
    f"{c}-BRL" for c in CURRENCIES if c != "BRL"
)
_TTL_SECONDS = 60
_cache = {"at": float("-inf"), "rates": {}}  # {"USD": {"rate": "4.99", "updated_at": "..."}}


def _file() -> Path:
    return Path(current_app.instance_path) / "rates.json"


def _fetch() -> dict:
    request = urllib.request.Request(_URL, headers={"User-Agent": "smaug"})
    with urllib.request.urlopen(request, timeout=4) as response:
        data = json.load(response)
    return {v["code"]: {"rate": v["bid"], "updated_at": v["create_date"]} for v in data.values()}


def get_rates() -> dict:
    """{moeda: {"rate": Decimal, "updated_at": str | None}}. BRL vale sempre 1."""
    if time.monotonic() - _cache["at"] > _TTL_SECONDS:
        # Marca antes de buscar: sem internet, tenta de novo só no próximo minuto.
        _cache["at"] = time.monotonic()
        try:
            _cache["rates"] = _fetch()
            _file().parent.mkdir(parents=True, exist_ok=True)
            _file().write_text(json.dumps(_cache["rates"]))
        except (OSError, ValueError, KeyError):
            if not _cache["rates"] and _file().exists():
                _cache["rates"] = json.loads(_file().read_text())

    rates = {"BRL": {"rate": Decimal(1), "updated_at": None}}
    for code, entry in _cache["rates"].items():
        rates[code] = {"rate": Decimal(entry["rate"]), "updated_at": entry["updated_at"]}
    return rates


def rate(currency: str | None) -> Decimal | None:
    """Quantos reais vale 1 unidade da moeda. None se nunca houve cotação."""
    if currency in (None, "BRL"):
        return Decimal(1)
    entry = get_rates().get(currency)
    return entry["rate"] if entry else None
