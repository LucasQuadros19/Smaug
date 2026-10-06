"""Cotações e histórico do Mercado.

Ações: Yahoo Finance (sem chave; API não oficial — se mudar, só este arquivo muda).
Cripto: CoinGecko (sem chave; histórico limitado a 1 ano no plano público).

Nada roda em segundo plano: só busca quando alguém abre a tela, e guarda em
memória — cotação por 1 minuto, gráfico de 5 minutos a 1 hora.
"""

import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

_HEADERS = {"User-Agent": "Mozilla/5.0"}  # o Yahoo recusa pedido sem cara de navegador
_QUOTE_TTL = 60
_cache: dict = {}  # chave -> (expira_em, valor)

# range -> (range Yahoo, intervalo Yahoo, dias CoinGecko). Cripto não tem 5 anos.
RANGES = {
    "1d": ("1d", "5m", 1),
    "5d": ("5d", "30m", 5),
    "1mo": ("1mo", "1d", 30),
    "6mo": ("6mo", "1d", 180),
    "1y": ("1y", "1d", 365),
    "5y": ("5y", "1wk", None),
}

_NETWORK_ERRORS = (OSError, ValueError, KeyError, TypeError, IndexError)


class MarketError(Exception):
    """Erro para mostrar na tela (código não encontrado, fonte fora do ar...)."""


def _get_json(url: str):
    request = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(request, timeout=6) as response:
        return json.load(response)


def _cached(key, ttl: int, fetch):
    """Guarda por `ttl` segundos. Se a fonte falhar, devolve o último valor bom."""
    now = time.monotonic()
    hit = _cache.get(key)
    if hit and hit[0] > now:
        return hit[1]
    try:
        value = fetch()
    except _NETWORK_ERRORS as error:
        if hit:
            return hit[1]
        raise MarketError("Fonte de cotação indisponível agora") from error
    _cache[key] = (now + ttl, value)
    return value


def _positive(value):
    """O Yahoo manda 0 quando não tem o dado (mínima do dia com mercado fechado)."""
    return value if value else None


# --------------------------------------------------------------- descobrir código


def resolve(code: str, kind: str) -> dict:
    """Confere se o código existe e descobre nome, moeda e como a fonte o chama."""
    code = str(code).strip().upper()
    if not re.fullmatch(r"[A-Z0-9^][A-Z0-9.\-^=]{0,19}", code):
        raise MarketError("Código inválido")

    if kind == "crypto":
        data = _get_json(
            "https://api.coingecko.com/api/v3/search?query=" + urllib.parse.quote(code, safe="")
        )
        matches = [c for c in data.get("coins", []) if c["symbol"].upper() == code]
        # Vários tokens usam o mesmo símbolo: fica o de maior capitalização.
        matches.sort(key=lambda c: c.get("market_cap_rank") or 10**9)
        if not matches:
            raise MarketError(f"Cripto {code} não encontrada")
        coin = matches[0]
        return {"code": code, "provider_id": coin["id"], "name": coin["name"], "currency": "USD"}

    # Ação: código da B3 (4 letras + número) ganha o ".SA" que o Yahoo usa.
    candidates = [code] if "." in code else (
        [f"{code}.SA", code] if re.fullmatch(r"[A-Z]{4}\d{1,2}F?", code) else [code]
    )
    for candidate in candidates:
        try:
            meta = _stock_meta(candidate)
        except MarketError:
            continue
        return {
            "code": code,
            "provider_id": meta["symbol"],
            "name": meta.get("longName") or (meta.get("shortName") or code).strip(),
            "currency": meta.get("currency") or "USD",
        }
    raise MarketError(f"Ação {code} não encontrada")


# --------------------------------------------------------------------- cotações


def _stock_chart(provider_id: str, range_: str, interval: str) -> dict:
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(provider_id, safe='')}"
        f"?range={range_}&interval={interval}"
    )
    try:
        result = _get_json(url)["chart"]["result"]
    except _NETWORK_ERRORS as error:
        raise MarketError("Fonte de ações indisponível agora") from error
    if not result:
        raise MarketError(f"{provider_id} não encontrado")
    return result[0]


def _stock_meta(provider_id: str) -> dict:
    return _stock_chart(provider_id, "1d", "1d")["meta"]


def _stock_quote(provider_id: str) -> dict:
    meta = _stock_meta(provider_id)
    price = meta["regularMarketPrice"]
    previous = _positive(meta.get("chartPreviousClose"))
    return {
        "price": price,
        "previous_close": previous,
        "change_pct": (price / previous - 1) * 100 if previous else None,
        "day_high": _positive(meta.get("regularMarketDayHigh")),
        "day_low": _positive(meta.get("regularMarketDayLow")),
        "year_high": _positive(meta.get("fiftyTwoWeekHigh")),
        "year_low": _positive(meta.get("fiftyTwoWeekLow")),
        "updated_at": datetime.fromtimestamp(meta["regularMarketTime"], tz=timezone.utc).isoformat(),
    }


def _crypto_quotes(ids: list) -> dict:
    """Uma chamada só para todas as cripto vencidas no cache."""
    now = time.monotonic()
    expired = [i for i in ids if not (_cache.get(("quote", i)) or (0,))[0] > now]
    if expired:
        try:
            rows = _get_json(
                "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids="
                + ",".join(urllib.parse.quote(i, safe="") for i in expired)
            )
            for row in rows:
                price = row["current_price"]
                pct = row.get("price_change_percentage_24h")
                _cache[("quote", row["id"])] = (
                    now + _QUOTE_TTL,
                    {
                        "price": price,
                        "previous_close": price / (1 + pct / 100) if pct is not None else None,
                        "change_pct": pct,
                        "day_high": row.get("high_24h"),
                        "day_low": row.get("low_24h"),
                        "year_high": None,
                        "year_low": None,
                        "updated_at": row.get("last_updated"),
                    },
                )
        except _NETWORK_ERRORS:
            pass  # fica com a última cotação boa, se houver
    return {i: (_cache.get(("quote", i)) or (0, None))[1] for i in ids}


def quotes(symbols) -> dict:
    """{symbol.id: cotação ou None}. Ações em paralelo; cripto numa chamada só."""
    crypto = [s for s in symbols if s.kind == "crypto"]
    stocks = [s for s in symbols if s.kind == "stock"]

    by_provider = _crypto_quotes([s.provider_id for s in crypto]) if crypto else {}

    def stock(symbol):
        try:
            return _cached(("quote", symbol.provider_id), _QUOTE_TTL, lambda: _stock_quote(symbol.provider_id))
        except MarketError:
            return None

    with ThreadPoolExecutor(max_workers=8) as pool:
        stock_quotes = dict(zip((s.id for s in stocks), pool.map(stock, stocks)))

    return {**{s.id: by_provider.get(s.provider_id) for s in crypto}, **stock_quotes}


# -------------------------------------------------------------------- histórico


def history(symbol, range_: str) -> list:
    """[{"t": ms, "v": preço}] na moeda do código."""
    if range_ not in RANGES:
        raise MarketError("Período inválido")
    yahoo_range, interval, days = RANGES[range_]
    ttl = 300 if range_ in ("1d", "5d") else 3600

    if symbol.kind == "crypto":
        if days is None:
            raise MarketError("Cripto só tem histórico de até 1 ano")

        def fetch():
            data = _get_json(
                f"https://api.coingecko.com/api/v3/coins/{urllib.parse.quote(symbol.provider_id, safe='')}/market_chart"
                f"?vs_currency=usd&days={days}"
            )
            return [{"t": int(t), "v": v} for t, v in data["prices"]]

    else:

        def fetch():
            chart = _stock_chart(symbol.provider_id, yahoo_range, interval)
            closes = chart["indicators"]["quote"][0]["close"]
            return [
                {"t": ts * 1000, "v": v}
                for ts, v in zip(chart.get("timestamp") or [], closes)
                if v is not None
            ]

    return _cached(("history", symbol.provider_id, range_), ttl, fetch)


def daily_closes(symbol, range_: str) -> dict:
    """{data: último preço daquele dia} — base do gráfico da carteira."""
    by_day = {}
    for point in history(symbol, range_):
        by_day[datetime.fromtimestamp(point["t"] / 1000, tz=timezone.utc).date()] = point["v"]
    return by_day


def days_between(start: date, end: date):
    while start <= end:
        yield start
        start += timedelta(days=1)
