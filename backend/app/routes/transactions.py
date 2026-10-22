from datetime import date

from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.account import Account
from app.models.category import Category
from app.models.transaction import TRANSACTION_TYPES, Transaction
from app.utils.pagination import paginate
from app.utils.parse import find, iso_date, money, text

transactions_bp = Blueprint("transactions", __name__)

# O que mexe no dinheiro. Num lançamento gerado por outra tela, mudar isso
# desencontra o caixa do registro de origem; descrição, categoria e nota podem.
_MONEY_FIELDS = ("account_id", "amount", "type", "date", "playlist_id")


_KEEP = "Descrição, categoria e observação dá para mudar aqui mesmo."


def _generated_by(transaction_id):
    """Se o lançamento foi criado por outra tela, a explicação de onde mudar. None se foi digitado."""
    from app.models.loan import Loan, LoanRepayment
    from app.models.market import MarketTrade

    repayment = LoanRepayment.query.filter(
        (LoanRepayment.transaction_id == transaction_id)
        | (LoanRepayment.partner_transaction_id == transaction_id)
    ).first()
    if repayment:
        who = repayment.loan.borrower
        return (
            f"Esse lançamento é o recebimento do empréstimo de {who}: mudar só aqui deixaria o empréstimo "
            f"com outro valor. Para corrigir o valor ou apagar, vá em Empréstimos, no card de {who}, em "
            "Histórico, clique em \"desfazer\" nesse recebimento e registre de novo com o valor certo "
            f"(se houver passos depois dele, desfaça do mais recente para trás). {_KEEP}"
        )
    trade = MarketTrade.query.filter_by(transaction_id=transaction_id).first()
    if trade:
        return (
            f"Esse lançamento é a {'compra' if trade.side == 'buy' else 'venda'} de {trade.symbol.code} no Mercado. "
            f"Para corrigir ou apagar, vá em Mercado, abra {trade.symbol.code}, apague o registro e lance de novo. {_KEEP}"
        )
    loan = Loan.query.filter_by(transaction_id=transaction_id).first()
    if loan:
        return (
            f"Esse lançamento é a saída do empréstimo de {loan.borrower}. Para mudar o valor ou a conta, edite o "
            f"empréstimo em Empréstimos (\"O dinheiro saiu de qual conta\"). {_KEEP}"
        )
    return None


def _transfer_lock(transaction):
    if transaction.transfer_group is None:
        return None
    return (
        "Esse lançamento é parte de um Aportei/Vendi/Transferir da planilha: mudar o valor só aqui "
        f"desencontraria as duas pontas. Para corrigir, apague (as duas pontas saem juntas) e lance de novo. {_KEEP}"
    )


def _mark_origins(items):
    """Marca os lançamentos criados por outra tela: a tela mostra de onde vieram e manda corrigir por lá.

    Três consultas para a página inteira, não uma por linha.
    """
    from app.models.loan import Loan, LoanRepayment
    from app.models.market import MarketTrade

    ids = [item["id"] for item in items]
    origins = {}
    for repayment in LoanRepayment.query.filter(
        LoanRepayment.transaction_id.in_(ids) | LoanRepayment.partner_transaction_id.in_(ids)
    ):
        origin = {"kind": "loan", "label": f"do empréstimo de {repayment.loan.borrower}", "link": "/emprestimos"}
        origins[repayment.transaction_id] = origins[repayment.partner_transaction_id] = origin
    for loan in Loan.query.filter(Loan.transaction_id.in_(ids)):
        origins[loan.transaction_id] = {"kind": "loan", "label": f"saída do empréstimo de {loan.borrower}", "link": "/emprestimos"}
    for trade in MarketTrade.query.filter(MarketTrade.transaction_id.in_(ids)):
        origins[trade.transaction_id] = {"kind": "market", "label": f"do Mercado ({trade.symbol.code})", "link": "/mercado"}
    for item in items:
        item["origin"] = origins.get(item["id"])


def _eager():
    """to_dict() lê categoria, conta e playlist — sem isso são 3 queries por linha."""
    return (
        joinedload(Transaction.category),
        joinedload(Transaction.account),
        joinedload(Transaction.playlist),
    )


def _apply_filters(query):
    account_id = request.args.get("account_id", type=int)
    if account_id:
        query = query.filter(Transaction.account_id == account_id)

    category_id = request.args.get("category_id", type=int)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)

    playlist_id = request.args.get("playlist_id", type=int)
    if playlist_id:
        query = query.filter(Transaction.playlist_id == playlist_id)

    tx_type = request.args.get("type")
    if tx_type:
        query = query.filter(Transaction.type == tx_type)

    start_date = request.args.get("start_date")
    if start_date:
        query = query.filter(Transaction.date >= date.fromisoformat(start_date))

    end_date = request.args.get("end_date")
    if end_date:
        query = query.filter(Transaction.date <= date.fromisoformat(end_date))

    search = request.args.get("search")
    if search:
        query = query.filter(Transaction.description.ilike(f"%{search}%"))

    # "caixa" = gasto/receita de verdade. "transfers" = movimentação de
    # patrimônio (marcada com playlist/ativo), que não é ganho nem perda.
    scope = request.args.get("scope")
    if scope == "cash":
        query = query.filter(Transaction.playlist_id.is_(None), Transaction.transfer_group.is_(None))
    elif scope == "transfers":
        query = query.filter(or_(Transaction.playlist_id.isnot(None), Transaction.transfer_group.isnot(None)))

    return query


@transactions_bp.get("")
def list_transactions():
    query = _apply_filters(Transaction.query).options(*_eager())
    query = query.order_by(Transaction.date.desc(), Transaction.id.desc())

    result = paginate(query, lambda t: t.to_dict())
    _mark_origins(result["items"])

    # Totais de TODAS as linhas do filtro, não só da página — senão o resumo
    # da tela mudaria conforme você navega.
    totals = dict(
        _apply_filters(db.session.query(Transaction.type, func.sum(Transaction.amount)))
        .group_by(Transaction.type)
        .all()
    )
    result["totals"] = {
        "income": float(totals.get("income") or 0),
        "expense": float(totals.get("expense") or 0),
    }

    # Gasto por categoria dentro do filtro atual — permite ver "quanto foi em
    # alimentação neste período" sem precisar somar à mão.
    rows = (
        _apply_filters(
            db.session.query(
                Category.id,
                Category.name,
                Category.icon,
                Category.color,
                func.sum(Transaction.amount).label("total"),
                func.count(Transaction.id).label("count"),
            ).outerjoin(Category, Transaction.category_id == Category.id)
        )
        .filter(Transaction.type == "expense")
        .group_by(Category.id, Category.name, Category.icon, Category.color)
        .order_by(func.sum(Transaction.amount).desc())
        .all()
    )
    result["by_category"] = [
        {
            "category_id": r.id,
            "name": r.name or "Sem categoria",
            "icon": r.icon or "—",
            "color": r.color or "#64748b",
            "total": float(r.total or 0),
            "count": r.count,
        }
        for r in rows
    ]
    return jsonify(result)


@transactions_bp.post("")
def create_transaction():
    data = request.get_json(silent=True) or {}

    description = text(data.get("description"), "description")
    if not description:
        return jsonify({"error": "O campo 'description' é obrigatório"}), 400

    account_id = data.get("account_id")
    if not account_id or not find(Account, account_id):
        return jsonify({"error": "account_id inválido"}), 400

    tx_type = data.get("type")
    if tx_type not in TRANSACTION_TYPES:
        return jsonify({"error": f"type deve ser um de {TRANSACTION_TYPES}"}), 400

    amount = money(data.get("amount"), "amount")
    when = iso_date(data.get("date"), "date")

    transaction = Transaction(
        description=description,
        account_id=account_id,
        category_id=data.get("category_id"),
        playlist_id=data.get("playlist_id"),
        amount=amount,
        type=tx_type,
        date=when,
        notes=data.get("notes"),
    )
    db.session.add(transaction)
    db.session.commit()
    return jsonify(transaction.to_dict()), 201


@transactions_bp.put("/<int:transaction_id>")
def update_transaction(transaction_id):
    transaction = db.get_or_404(Transaction, transaction_id)
    data = request.get_json(silent=True) or {}
    before = [getattr(transaction, field) for field in _MONEY_FIELDS]

    if "description" in data:
        description = text(data.get("description"), "description")
        if not description:
            return jsonify({"error": "O campo 'description' não pode ser vazio"}), 400
        transaction.description = description
    # A saída forçada da planilha não tem conta: editar a descrição não obriga a escolher uma.
    if "account_id" in data and data["account_id"] != transaction.account_id:
        if not find(Account, data["account_id"]):
            return jsonify({"error": "account_id inválido"}), 400
        transaction.account_id = data["account_id"]
    if "category_id" in data:
        transaction.category_id = data["category_id"]
    if "playlist_id" in data:
        transaction.playlist_id = data["playlist_id"]
    if "type" in data:
        if data["type"] not in TRANSACTION_TYPES:
            return jsonify({"error": f"type deve ser um de {TRANSACTION_TYPES}"}), 400
        transaction.type = data["type"]
    if "amount" in data:
        transaction.amount = money(data["amount"], "amount")
    if "date" in data:
        transaction.date = iso_date(data["date"], "date")
    if "notes" in data:
        transaction.notes = data["notes"]

    if [getattr(transaction, field) for field in _MONEY_FIELDS] != before:
        origin = _generated_by(transaction_id) or _transfer_lock(transaction)
        if origin:
            db.session.rollback()
            return jsonify({"error": origin}), 400

    db.session.commit()
    return jsonify(transaction.to_dict())


@transactions_bp.delete("/<int:transaction_id>")
def delete_transaction(transaction_id):
    transaction = db.get_or_404(Transaction, transaction_id)

    # Apagar solto tiraria o dinheiro do caixa e o registro de origem
    # continuaria contando, e o valor sumiria sem rastro.
    origin = _generated_by(transaction_id)
    if origin:
        return jsonify({"error": origin}), 400

    # Uma ponta sozinha deixaria o dinheiro sumir de um lado e aparecer no outro.
    if transaction.transfer_group is not None:
        Transaction.query.filter_by(transfer_group=transaction.transfer_group).delete()
    else:
        db.session.delete(transaction)
    db.session.commit()
    return "", 204
