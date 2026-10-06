from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.loan import LOAN_STATUSES, Loan, LoanParticipant, LoanRepayment
from app.utils.parse import iso_date, money

loans_bp = Blueprint("loans", __name__)



def _today():
    from datetime import date

    return date.today()


def _invalid_commission(value):
    """0 a 100, ou vazio."""
    if value in (None, ""):
        return None
    try:
        rate = Decimal(str(value))
    except InvalidOperation:
        return "commission_rate inválido"
    return None if 0 <= rate <= 100 else "commission_rate deve estar entre 0 e 100"


def _replace_participants(loan, raw_participants):
    """Troca a lista inteira — mais simples e previsível que diff item a item."""
    loan.participants.clear()
    for raw in raw_participants or []:
        name = (raw.get("name") or "").strip()
        if not name:
            continue
        loan.participants.append(
            LoanParticipant(
                name=name,
                contributed=money(raw.get("contributed"), "contributed", allow_zero=True, required=False) or 0,
                to_receive=money(raw.get("to_receive"), "to_receive", allow_zero=True, required=False) or 0,
                is_me=bool(raw.get("is_me")),
            )
        )


@loans_bp.get("")
def list_loans():
    status = request.args.get("status")
    query = Loan.query.options(
        selectinload(Loan.participants), selectinload(Loan.repayments)
    )
    if status:
        query = query.filter_by(status=status)
    loans = query.order_by(Loan.start_date.desc(), Loan.id.desc()).all()
    return jsonify([loan.to_dict() for loan in loans])


@loans_bp.post("")
def create_loan():
    data = request.get_json(silent=True) or {}

    borrower = (data.get("borrower") or "").strip()
    if not borrower:
        return jsonify({"error": "O campo 'borrower' é obrigatório"}), 400

    start_date = data.get("start_date")
    if not start_date:
        return jsonify({"error": "O campo 'start_date' é obrigatório (YYYY-MM-DD)"}), 400

    status = data.get("status", "active")
    if status not in LOAN_STATUSES:
        return jsonify({"error": f"status deve ser um de {LOAN_STATUSES}"}), 400
    erro = _invalid_commission(data.get("commission_rate"))
    if erro:
        return jsonify({"error": erro}), 400

    loan = Loan(
        borrower=borrower,
        amount=money(data.get("amount"), "amount", allow_zero=True, required=False) or 0,
        interest_rate=money(data.get("interest_rate"), "interest_rate", allow_zero=True, required=False),
        commission_rate=data.get("commission_rate"),
        start_date=iso_date(start_date, "start_date"),
        due_date=iso_date(data.get("due_date"), "due_date", required=False),
        status=status,
        notes=(data.get("notes") or "").strip() or None,
    )
    _replace_participants(loan, data.get("participants"))
    db.session.add(loan)
    db.session.commit()
    return jsonify(loan.to_dict()), 201


@loans_bp.put("/<int:loan_id>")
def update_loan(loan_id):
    loan = db.get_or_404(Loan, loan_id)
    data = request.get_json(silent=True) or {}

    if "borrower" in data:
        borrower = (data.get("borrower") or "").strip()
        if not borrower:
            return jsonify({"error": "O campo 'borrower' não pode ser vazio"}), 400
        loan.borrower = borrower
    if "amount" in data:
        loan.amount = money(data["amount"], "amount", allow_zero=True, required=False) or 0
    if "interest_rate" in data:
        loan.interest_rate = money(data["interest_rate"], "interest_rate", allow_zero=True, required=False)
    if "commission_rate" in data:
        erro = _invalid_commission(data["commission_rate"])
        if erro:
            return jsonify({"error": erro}), 400
        loan.commission_rate = data["commission_rate"] if data["commission_rate"] != "" else None
    if "start_date" in data:
        loan.start_date = iso_date(data["start_date"], "start_date")
    if "due_date" in data:
        loan.due_date = iso_date(data["due_date"], "due_date", required=False)
    if "status" in data:
        if data["status"] not in LOAN_STATUSES:
            return jsonify({"error": f"status deve ser um de {LOAN_STATUSES}"}), 400
        loan.status = data["status"]
    if "notes" in data:
        loan.notes = (data.get("notes") or "").strip() or None
    if "participants" in data:
        _replace_participants(loan, data["participants"])

    db.session.commit()
    return jsonify(loan.to_dict())


def _linked_position_id():
    """A posição que espelha os empréstimos, se existir."""
    from app.models.playlist import Playlist

    linked = Playlist.query.filter_by(auto_source="loans").first()
    return linked.id if linked else None


def _partner_expense(repayment, loan, account_id):
    """Lançamento de saída do repasse ao sócio.

    Sem playlist: é dinheiro saindo de verdade da conta. Mas também não é
    despesa sua — por isso vai sem categoria e com descrição explícita.
    """
    from app.models.transaction import Transaction

    return Transaction(
        account_id=account_id,
        playlist_id=None,
        description=f"Repasse a sócios - {loan.borrower}",
        amount=repayment.partners_share,
        type="expense",
        date=repayment.date,
        notes="Parte dos sócios no retorno do empréstimo",
    )


def _register_repayment(loan, data):
    """Cria o recebimento e os lançamentos. Retorna (dict, None) ou (None, (msg, status))."""
    from app.models.account import Account
    from app.models.transaction import Transaction

    account = db.session.get(Account, data.get("account_id"))
    if not account:
        return None, ("Informe a conta que recebeu o dinheiro", 400)

    amount = money(data.get("amount"), "O valor recebido")
    raw_mine = data.get("my_share")
    my_share = amount if raw_mine is None else money(raw_mine, "my_share", allow_zero=True)
    partners_share = money(data.get("partners_share"), "partners_share", allow_zero=True, required=False) or Decimal(0)
    if my_share + partners_share > amount:
        return None, ("A soma das partes não pode passar do valor recebido", 400)

    settled = bool(data.get("partners_settled"))

    repayment = LoanRepayment(
        loan_id=loan.id,
        date=iso_date(data.get("date"), "date", required=False) or _today(),
        amount=amount,
        my_share=my_share,
        partners_share=partners_share,
        account_id=account.id,
        partners_settled=settled,
        notes=(data.get("notes") or "").strip() or None,
    )
    db.session.add(repayment)
    db.session.flush()

    # Entrada do total recebido. Marcada com a posição de empréstimos para
    # contar como movimentação de patrimônio e não inflar "receitas do mês".
    entrada = Transaction(
        account_id=account.id,
        playlist_id=_linked_position_id(),
        description=f"Retorno do empréstimo - {loan.borrower}",
        amount=amount,
        type="income",
        date=repayment.date,
        notes=repayment.notes,
    )
    db.session.add(entrada)
    db.session.flush()
    repayment.transaction_id = entrada.id

    if settled and partners_share > 0:
        saida = _partner_expense(repayment, loan, account.id)
        db.session.add(saida)
        db.session.flush()
        repayment.partner_transaction_id = saida.id

    # Quitou tudo o que era meu? Fecha o empréstimo.
    if loan.mine_is_back:
        loan.status = "paid"

    db.session.commit()
    return loan.to_dict(), None


@loans_bp.post("/<int:loan_id>/repayments")
def create_repayment(loan_id):
    """Registra uma parcela que voltou.

    `amount` é tudo o que caiu na conta; `my_share` é a parte minha e
    `partners_share` a dos sócios. Enquanto o repasse não é feito, a parte
    deles fica no caixa mas não conta como patrimônio meu.
    """
    loan = db.get_or_404(Loan, loan_id)
    result, error = _register_repayment(loan, request.get_json(silent=True) or {})
    if error:
        db.session.rollback()
        return jsonify({"error": error[0]}), error[1]
    return jsonify(result), 201


@loans_bp.post("/<int:loan_id>/repayments/<int:repayment_id>/settle-partners")
def settle_partners(loan_id, repayment_id):
    """Marca que o dinheiro dos sócios foi repassado e tira do caixa."""
    loan = db.get_or_404(Loan, loan_id)
    repayment = LoanRepayment.query.filter_by(id=repayment_id, loan_id=loan.id).first_or_404()

    if repayment.partners_settled:
        return jsonify({"error": "Esse repasse já foi feito"}), 400
    if Decimal(repayment.partners_share or 0) <= 0:
        return jsonify({"error": "Não há parte de sócios nesse recebimento"}), 400

    data = request.get_json(silent=True) or {}
    account_id = data.get("account_id") or repayment.account_id
    if not account_id:
        return jsonify({"error": "Informe a conta de onde saiu o repasse"}), 400

    saida = _partner_expense(repayment, loan, account_id)
    db.session.add(saida)
    db.session.flush()

    repayment.partner_transaction_id = saida.id
    repayment.partners_settled = True
    db.session.commit()

    return jsonify(loan.to_dict())


def _drop_repayment_transactions(repayment):
    """Apaga os lançamentos de caixa que um recebimento criou.

    O cascade do ORM só alcança as parcelas; as transações são apontadas por
    elas, então precisam ser removidas na mão — senão o dinheiro fica na conta
    sem nenhum recebimento por trás.
    """
    from app.models.transaction import Transaction

    tx_ids = [tx_id for tx_id in (repayment.transaction_id, repayment.partner_transaction_id) if tx_id]
    # Solta a referência antes: apagar o lançamento ainda apontado quebra a chave estrangeira.
    repayment.transaction_id = repayment.partner_transaction_id = None
    db.session.flush()
    for tx_id in tx_ids:
        transaction = db.session.get(Transaction, tx_id)
        if transaction:
            db.session.delete(transaction)


@loans_bp.delete("/<int:loan_id>/repayments/<int:repayment_id>")
def delete_repayment(loan_id, repayment_id):
    """Desfaz um recebimento, apagando junto os lançamentos que ele gerou."""
    loan = db.get_or_404(Loan, loan_id)
    repayment = LoanRepayment.query.filter_by(id=repayment_id, loan_id=loan.id).first_or_404()

    _drop_repayment_transactions(repayment)
    db.session.delete(repayment)
    db.session.flush()

    # Reabre o empréstimo se voltou a ter saldo.
    if loan.status == "paid" and not loan.mine_is_back:
        loan.status = "active"

    db.session.commit()
    return jsonify(loan.to_dict())


@loans_bp.delete("/<int:loan_id>")
def delete_loan(loan_id):
    """Apaga o empréstimo e desfaz tudo que ele moveu no caixa."""
    loan = db.get_or_404(Loan, loan_id)
    for repayment in loan.repayments:
        _drop_repayment_transactions(repayment)
    db.session.delete(loan)
    db.session.commit()
    return "", 204
