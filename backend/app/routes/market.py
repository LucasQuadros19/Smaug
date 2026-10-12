"""Mercado: acompanhar ações/cripto e registrar compras.

Tudo o que você tem aqui entra no patrimônio pela posição "Mercado", pela
cotação de agora. Compra e venda pagas por uma conta são patrimônio mudando de
forma (dinheiro vira ação e vice-versa), não gasto nem receita.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal

from flask import Blueprint, g, jsonify, request
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.account import Account
from app.models.market import MARKET_KINDS, TRADE_SIDES, MarketSymbol, MarketTrade, holding
from app.models.transaction import Transaction
from app.services import market_service
from app.services.auto_value_service import market_position
from app.services.market_service import MarketError
from app.services.rates import rate
from app.user_settings import merged as merged_settings
from app.utils.parse import find, iso_date, money, text

market_bp = Blueprint("market", __name__)


def _symbols():
    return MarketSymbol.query.options(selectinload(MarketSymbol.trades)).order_by(MarketSymbol.created_at).all()


def _symbol_dict(symbol, quote):
    fx = rate(symbol.currency)  # reais por unidade da moeda da cotação
    pos = holding(symbol.trades)
    qty = pos["quantity"]
    price = Decimal(str(quote["price"])) if quote else None

    held = None
    if qty > 0 or symbol.trades:
        value_brl = qty * price * fx if price is not None and fx is not None else None
        previous = quote.get("previous_close") if quote else None
        held = {
            "quantity": float(qty),
            "average_price": float(pos["average_price"]),
            "cost_brl": float(pos["cost_brl"]),
            "realized_brl": float(pos["realized_brl"]),
            "value_brl": float(value_brl) if value_brl is not None else None,
            "gain_brl": float(value_brl - pos["cost_brl"]) if value_brl is not None else None,
            "gain_pct": (
                float((value_brl / pos["cost_brl"] - 1) * 100)
                if value_brl is not None and pos["cost_brl"] > 0
                else None
            ),
            "day_change_brl": (
                float(qty * (price - Decimal(str(previous))) * fx)
                if previous and price is not None and fx is not None
                else None
            ),
        }

    return {
        "id": symbol.id,
        "code": symbol.code,
        "kind": symbol.kind,
        "name": symbol.name,
        "currency": symbol.currency,
        "rate": float(fx) if fx is not None else None,
        "quote": quote,
        "holding": held,
        "trades": [t.to_dict() for t in sorted(symbol.trades, key=lambda t: (t.date, t.id), reverse=True)],
    }


def _is_b3(symbol):
    return symbol.kind == "stock" and (symbol.provider_id.endswith(".SA") or symbol.currency == "BRL")


def tax_estimate(symbols, settings, month=None):
    """IR estimado do mês sobre o lucro realizado, com a isenção por volume de vendas.

    Só ações da B3 (operação comum) e cripto. Não compensa prejuízo de meses
    anteriores nem trata day trade — é uma estimativa para não ser pego de surpresa.
    """
    month = month or date.today().strftime("%Y-%m")
    result = {}
    for kind, members in (("stock", [s for s in symbols if _is_b3(s)]), ("crypto", [s for s in symbols if s.kind == "crypto"])):
        sales = Decimal(0)
        realized = Decimal(0)
        for symbol in members:
            entry = holding(symbol.trades)["by_month"].get(month)
            if entry:
                sales += entry["sales"]
                realized += entry["realized"]
        exempt = Decimal(str(settings[f"{kind}_exempt"]))
        rate_pct = Decimal(str(settings[f"{kind}_tax"]))
        tax = max(realized, Decimal(0)) * rate_pct / 100 if sales > exempt else Decimal(0)
        result[kind] = {
            "sales": float(sales),
            "realized": float(realized),
            "exempt_until": float(exempt),
            "rate": float(rate_pct),
            "tax": float(tax.quantize(Decimal("0.01"))),
        }
    return {"month": month, **result}


def market_overview():
    """Lista + totais da carteira em reais. Usado pela tela e pelos Cálculos."""
    symbols = _symbols()
    quotes = market_service.quotes(symbols)
    items = [_symbol_dict(s, quotes.get(s.id)) for s in symbols]

    held = [i["holding"] for i in items if i["holding"] and i["holding"]["quantity"] > 0]
    value = sum(h["value_brl"] or 0 for h in held)
    cost = sum(h["cost_brl"] for h in held)
    day = sum(h["day_change_brl"] or 0 for h in held)
    return {
        "symbols": items,
        "portfolio": {
            "value_brl": value,
            "cost_brl": cost,
            "gain_brl": value - cost,
            "gain_pct": (value / cost - 1) * 100 if cost > 0 else None,
            "day_change_brl": day,
            "day_change_pct": day / (value - day) * 100 if value - day > 0 else None,
            "missing_quotes": any(h["value_brl"] is None for h in held),
        },
        "tax": tax_estimate(symbols, merged_settings(g.user.settings)),
    }


@market_bp.get("")
def overview():
    return jsonify(market_overview())


@market_bp.post("/symbols")
def add_symbol():
    data = request.get_json(silent=True) or {}
    kind = data.get("kind")
    if kind not in MARKET_KINDS:
        return jsonify({"error": f"kind deve ser um de {MARKET_KINDS}"}), 400
    try:
        found = market_service.resolve(data.get("code") or "", kind)
    except MarketError as error:
        return jsonify({"error": str(error)}), 400
    except market_service._NETWORK_ERRORS:
        return jsonify({"error": "Fonte de cotação indisponível agora"}), 503

    if MarketSymbol.query.filter_by(kind=kind, provider_id=found["provider_id"]).first():
        return jsonify({"error": f"{found['code']} já está na lista"}), 400

    symbol = MarketSymbol(kind=kind, **found)
    db.session.add(symbol)
    market_position()
    db.session.commit()
    return jsonify({"id": symbol.id, "code": symbol.code, "name": symbol.name}), 201


def _drop_transactions(trades):
    tx_ids = [t.transaction_id for t in trades if t.transaction_id]
    for trade in trades:
        trade.transaction_id = None
    db.session.flush()
    for tx_id in tx_ids:
        transaction = db.session.get(Transaction, tx_id)
        if transaction:
            db.session.delete(transaction)


@market_bp.delete("/symbols/<int:symbol_id>")
def delete_symbol(symbol_id):
    """Tira da lista. Compras que mexeram numa conta são desfeitas junto."""
    symbol = db.get_or_404(MarketSymbol, symbol_id)
    _drop_transactions(symbol.trades)
    db.session.delete(symbol)
    db.session.commit()
    return "", 204


@market_bp.post("/trades")
def add_trade():
    data = request.get_json(silent=True) or {}
    symbol = find(MarketSymbol, data.get("symbol_id"))
    if not symbol:
        return jsonify({"error": "Código não encontrado"}), 400
    side = data.get("side")
    if side not in TRADE_SIDES:
        return jsonify({"error": "side deve ser 'buy' ou 'sell'"}), 400
    quantity = money(data.get("quantity"), "Quantidade")
    price = money(data.get("price"), "Preço")
    fees = money(data.get("fees"), "Taxas", allow_zero=True, required=False) or Decimal(0)
    when = iso_date(data.get("date"), "date", required=False) or date.today()
    # Só dá para vender o que já tinha naquela data — senão a posição fica negativa no meio do caminho.
    if side == "sell" and quantity > holding([t for t in symbol.trades if t.date <= when])["quantity"]:
        return jsonify({"error": f"Em {when.strftime('%d/%m/%Y')} você não tinha {quantity.normalize():f} {symbol.code} para vender"}), 400

    fx = rate(symbol.currency)
    if fx is None:
        return jsonify({"error": f"Sem cotação de {symbol.currency} agora — confira a internet"}), 400

    trade = MarketTrade(
        symbol_id=symbol.id,
        side=side,
        date=when,
        quantity=quantity,
        price=price,
        fx_rate=fx,
        fees=fees,
        notes=text(data.get("notes"), "notes") or None,
    )

    # Tudo o que está no Mercado entra no patrimônio por esta posição.
    position = market_position()
    # Conta é opcional: sem ela, a compra só fica registrada aqui.
    if data.get("account_id"):
        account = find(Account, data["account_id"])
        if not account:
            return jsonify({"error": "Conta não encontrada"}), 400
        verb = "Compra" if side == "buy" else "Venda"
        gross = quantity * price * fx
        transaction = Transaction(
            account_id=account.id,
            # O dinheiro só muda de forma (vira ação): não é gasto nem receita.
            playlist_id=position.id,
            description=f"{verb} {quantity.normalize():f} {symbol.code}",
            amount=(gross + fees if side == "buy" else gross - fees).quantize(Decimal("0.01")),
            type="expense" if side == "buy" else "income",
            date=when,
            notes="Mercado",
        )
        db.session.add(transaction)
        db.session.flush()
        trade.account_id = account.id
        trade.transaction_id = transaction.id

    db.session.add(trade)
    db.session.commit()
    return jsonify(trade.to_dict()), 201


@market_bp.delete("/trades/<int:trade_id>")
def delete_trade(trade_id):
    trade = db.get_or_404(MarketTrade, trade_id)
    # Sem esta compra, alguma venda depois dela ficaria vendendo o que não existia.
    if trade.side == "buy":
        running = Decimal(0)
        for other in sorted(trade.symbol.trades, key=lambda t: (t.date, t.id)):
            if other.id != trade.id:
                running += other.quantity if other.side == "buy" else -other.quantity
                if running < 0:
                    return jsonify({"error": "Uma venda depois desta compra ficaria sem o que vender. Apague a venda antes."}), 400
    _drop_transactions([trade])
    db.session.delete(trade)
    db.session.commit()
    return "", 204


@market_bp.get("/symbols/<int:symbol_id>/history")
def symbol_history(symbol_id):
    symbol = db.get_or_404(MarketSymbol, symbol_id)
    try:
        return jsonify(market_service.history(symbol, request.args.get("range", "1mo")))
    except MarketError as error:
        return jsonify({"error": str(error)}), 400


@market_bp.get("/portfolio/history")
def portfolio_history():
    """Quanto valia tudo que eu tinha em cada dia, e quanto eu tinha investido.

    Usa a cotação de moeda de hoje para o valor do passado. Para cripto o
    histórico vai até 1 ano (limite da fonte gratuita).
    """
    # ponytail: valor passado de ativo em dólar usa o dólar de hoje; histórico de câmbio se a diferença incomodar
    range_ = request.args.get("range", "6mo")
    if range_ not in ("1mo", "6mo", "1y", "5y"):
        return jsonify({"error": "Período inválido"}), 400

    symbols = [s for s in _symbols() if s.trades]
    if not symbols:
        return jsonify([])

    def closes_for(symbol):
        crypto_cap = "1y" if symbol.kind == "crypto" and range_ == "5y" else range_
        try:
            return market_service.daily_closes(symbol, crypto_cap)
        except MarketError:
            return {}

    # Um histórico por código: em paralelo, para não somar o tempo de cada um.
    with ThreadPoolExecutor(max_workers=8) as pool:
        closes = dict(zip((s.id for s in symbols), pool.map(closes_for, symbols)))

    # A posição só muda em dia de compra/venda: calcula uma vez por data de operação.
    changes = {}
    for symbol in symbols:
        trades = sorted(symbol.trades, key=lambda t: (t.date, t.id))
        changes[symbol.id] = [
            (trade.date, holding(trades[: i + 1]))
            for i, trade in enumerate(trades)
            if i + 1 == len(trades) or trades[i + 1].date != trade.date
        ]
    fx = {s.id: rate(s.currency) or Decimal(0) for s in symbols}

    first_trade = min(t.date for s in symbols for t in s.trades)
    first_close = min((d for c in closes.values() for d in c), default=date.today())
    points = []
    last_price = {}
    position = {}
    cursor = dict.fromkeys(changes, 0)
    for day in market_service.days_between(max(first_trade, first_close), date.today()):
        value = Decimal(0)
        invested = Decimal(0)
        for symbol in symbols:
            steps = changes[symbol.id]
            while cursor[symbol.id] < len(steps) and steps[cursor[symbol.id]][0] <= day:
                position[symbol.id] = steps[cursor[symbol.id]][1]
                cursor[symbol.id] += 1
            if day in closes[symbol.id]:
                last_price[symbol.id] = Decimal(str(closes[symbol.id][day]))
            pos = position.get(symbol.id)
            if pos:
                value += pos["quantity"] * last_price.get(symbol.id, Decimal(0)) * fx[symbol.id]
                invested += pos["cost_brl"]
        points.append({"date": day.isoformat(), "value": float(value), "invested": float(invested)})
    return jsonify(points)
