from datetime import date
from decimal import Decimal

from flask import Blueprint, jsonify, request
from sqlalchemy.orm import selectinload
from werkzeug.exceptions import BadRequest

from app.extensions import db
from app.models.loan import LOAN_SCHEDULES, LOAN_STATUSES, REPAYMENT_KINDS, Loan, LoanEvent, LoanParticipant, LoanRepayment
from app.utils.parse import find, iso_date, money, text

loans_bp = Blueprint("loans", __name__)



def _replace_participants(loan, raw_participants):
    """Troca a lista inteira — mais simples e previsível que diff item a item."""
    raw_participants = raw_participants or []
    if not isinstance(raw_participants, list) or not all(isinstance(raw, dict) for raw in raw_participants):
        raise BadRequest("participants deve ser uma lista de participantes")
    loan.participants.clear()
    for raw in raw_participants:
        name = text(raw.get("name"), "name")
        if not name:
            continue
        contributed = money(raw.get("contributed"), "contributed", allow_zero=True, required=False) or Decimal(0)
        if "gain" in raw:
            gain = money(raw.get("gain"), "gain", allow_zero=True, required=False) or Decimal(0)
        else:
            # Formato antigo: o total a receber em um mês.
            received = money(raw.get("to_receive"), "to_receive", allow_zero=True, required=False)
            gain = max((received or contributed) - contributed, Decimal(0))
        loan.participants.append(
            LoanParticipant(
                name=name,
                contributed=contributed,
                gain=gain,
                commission=money(raw.get("commission"), "commission", allow_zero=True, required=False) or 0,
                is_me=bool(raw.get("is_me")),
            )
        )


def _apply_plan(loan, data):
    """Quantos meses e como o principal volta."""
    if "months" in data or loan.months is None:
        months = data.get("months", 1)
        if isinstance(months, bool) or not isinstance(months, int) or not 1 <= months <= 600:
            raise BadRequest("months deve ser um número de 1 a 600")
        loan.months = months
    if "schedule" in data or loan.schedule is None:
        schedule = data.get("schedule", "interest_only")
        if schedule not in LOAN_SCHEDULES:
            raise BadRequest(f"schedule deve ser um de {LOAN_SCHEDULES}")
        loan.schedule = schedule


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

    borrower = text(data.get("borrower"), "borrower")
    if not borrower:
        return jsonify({"error": "O campo 'borrower' é obrigatório"}), 400

    start_date = data.get("start_date")
    if not start_date:
        return jsonify({"error": "O campo 'start_date' é obrigatório (YYYY-MM-DD)"}), 400

    status = data.get("status", "active")
    if status not in LOAN_STATUSES:
        return jsonify({"error": f"status deve ser um de {LOAN_STATUSES}"}), 400

    loan = Loan(
        borrower=borrower,
        amount=money(data.get("amount"), "amount", allow_zero=True, required=False) or 0,
        interest_rate=money(data.get("interest_rate"), "interest_rate", allow_zero=True, required=False),
        start_date=iso_date(start_date, "start_date"),
        due_date=iso_date(data.get("due_date"), "due_date", required=False),
        status=status,
        notes=text(data.get("notes"), "notes") or None,
    )
    _replace_participants(loan, data.get("participants"))
    _apply_plan(loan, data)
    db.session.add(loan)
    if data.get("outflow"):
        _set_outflow(loan, data["outflow"])
    db.session.commit()
    return jsonify(loan.to_dict()), 201


def _set_outflow(loan, raw):
    """A saída da minha conta quando emprestei: cria, muda ou (com None) apaga.

    Vai marcada com a posição ligada aos Empréstimos, se houver: aí é patrimônio
    mudando de forma, não gasto. Sem posição ligada, conta como gasto do mês.
    """
    from app.models.account import Account
    from app.models.transaction import Transaction

    if raw is None:
        old = loan.outflow
        if old is not None:
            loan.outflow = None
            db.session.flush()
            db.session.delete(old)
        return
    if not isinstance(raw, dict):
        raise BadRequest("outflow deve ter account_id e amount")
    account = find(Account, raw.get("account_id"))
    if not account:
        raise BadRequest("Informe a conta de onde saiu o dinheiro")
    amount = money(raw.get("amount"), "O valor que saiu")
    when = iso_date(raw.get("date"), "date", required=False) or loan.start_date
    transaction = loan.outflow or Transaction(type="expense")
    transaction.account_id = account.id
    transaction.playlist_id = _linked_position_id()
    transaction.description = f"Empréstimo para {loan.borrower}"
    transaction.amount = amount
    transaction.date = when
    transaction.notes = "Saída do empréstimo"
    loan.outflow = transaction


@loans_bp.put("/<int:loan_id>")
def update_loan(loan_id):
    loan = db.get_or_404(Loan, loan_id)
    data = request.get_json(silent=True) or {}

    if "borrower" in data:
        borrower = text(data.get("borrower"), "borrower")
        if not borrower:
            return jsonify({"error": "O campo 'borrower' não pode ser vazio"}), 400
        loan.borrower = borrower
    if "amount" in data:
        loan.amount = money(data["amount"], "amount", allow_zero=True, required=False) or 0
    if "interest_rate" in data:
        loan.interest_rate = money(data["interest_rate"], "interest_rate", allow_zero=True, required=False)
    if "start_date" in data:
        loan.start_date = iso_date(data["start_date"], "start_date")
    if "due_date" in data:
        loan.due_date = iso_date(data["due_date"], "due_date", required=False)
    if "status" in data:
        if data["status"] not in LOAN_STATUSES:
            return jsonify({"error": f"status deve ser um de {LOAN_STATUSES}"}), 400
        loan.status = data["status"]
    if "notes" in data:
        loan.notes = text(data.get("notes"), "notes") or None
    if "participants" in data:
        _replace_participants(loan, data["participants"])
    _apply_plan(loan, data)
    if "outflow" in data:
        _set_outflow(loan, data["outflow"])

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


_DESCRIPTIONS = {"principal": "Retorno", "interest": "Juros", "fee": "Multa/atraso"}


def _add_part(loan, account, part, shared):
    """Um recebimento (principal, juros ou multa) e os lançamentos dele no caixa."""
    from app.models.transaction import Transaction

    kind = part.get("kind", "principal")
    if kind not in REPAYMENT_KINDS:
        raise BadRequest(f"kind deve ser um de {REPAYMENT_KINDS}")
    amount = money(part.get("amount"), "O valor recebido")
    raw_mine = part.get("my_share")
    my_share = amount if raw_mine is None else money(raw_mine, "my_share", allow_zero=True)
    partners_share = money(part.get("partners_share"), "partners_share", allow_zero=True, required=False) or Decimal(0)
    if my_share + partners_share > amount:
        raise BadRequest("A soma das partes não pode passar do valor recebido")

    repayment = LoanRepayment(
        kind=kind,
        date=shared["date"],
        amount=amount,
        my_share=my_share,
        partners_share=partners_share,
        account_id=account.id,
        partners_settled=shared["settled"],
        notes=shared["notes"],
    )
    # Pela lista do empréstimo (e não session.add): assim ela já conta este recebimento.
    loan.repayments.append(repayment)
    repayment.event = shared["event"]

    # Principal volta da posição de empréstimos: movimentação de patrimônio,
    # não receita. Juros são ganho de verdade e entram como receita.
    entrada = Transaction(
        account_id=account.id,
        playlist_id=_linked_position_id() if kind == "principal" else None,
        description=f"{_DESCRIPTIONS[kind]} do empréstimo - {loan.borrower}",
        amount=amount,
        type="income",
        date=repayment.date,
        notes=repayment.notes,
    )
    db.session.add(entrada)
    db.session.flush()
    repayment.transaction_id = entrada.id

    if shared["settled"] and partners_share > 0:
        saida = _partner_expense(repayment, loan, account.id)
        db.session.add(saida)
        db.session.flush()
        repayment.partner_transaction_id = saida.id


def _new_event(loan, kind, when, notes):
    event = LoanEvent(
        kind=kind,
        date=when,
        due_before=loan.due_date,
        months_before=loan.months,
        status_before=loan.status,
        notes=notes,
    )
    loan.events.append(event)
    return event


def _close_month(loan, event, next_due):
    """Venceu mais um mês de juros e o empréstimo continua até `next_due`."""
    event.charged = True
    event.due_after = next_due
    loan.months_charged += 1
    loan.due_date = next_due
    # Continuou além do combinado: conta mais um mês de juros.
    loan.months = max(loan.months, loan.months_charged + 1)


def _register_repayment(loan, data):
    """Cria o recebimento (um passo, com uma ou mais partes) e os lançamentos.

    Aceita uma parte só (`amount`, `my_share`, `partners_share`, `kind`) ou
    várias em `parts` — principal, juros e multa juntos, por exemplo.
    - Com `next_due_date`: fecha o mês e continua até a nova data.
    - Voltou todo o principal: quita.
    - Senão: pagamento parcial; o vencimento não muda e o que faltar fica pendente.
    """
    from app.models.account import Account

    account = find(Account, data.get("account_id"))
    if not account:
        return None, ("Informe a conta que recebeu o dinheiro", 400)

    parts = data["parts"] if "parts" in data else [data]
    if not isinstance(parts, list) or not parts or not all(isinstance(p, dict) for p in parts):
        return None, ("parts deve ser uma lista de recebimentos", 400)
    when = iso_date(data.get("date"), "date", required=False) or date.today()
    notes = text(data.get("notes"), "notes") or None
    event = _new_event(loan, "receipt", when, notes)
    shared = {"date": when, "settled": bool(data.get("partners_settled")), "notes": notes, "event": event}
    for part in parts:
        _add_part(loan, account, part, shared)

    next_due = iso_date(data.get("next_due_date"), "next_due_date", required=False)
    if next_due:
        _close_month(loan, event, next_due)
    elif loan.principal_outstanding <= 0:
        # Quitou: o mês dos juros recebidos agora conta, e acaba aí.
        if any(p.get("kind") == "interest" for p in parts):
            event.charged = True
            loan.months_charged += 1
        loan.months = max(loan.months_charged, 1)
        loan.status = "paid"

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
    if repayment.event_id is not None:
        return jsonify({"error": "Esse recebimento é desfeito inteiro, pelo histórico do empréstimo"}), 400

    _drop_repayment_transactions(repayment)
    loan.repayments.remove(repayment)
    db.session.flush()

    # Reabre o empréstimo se voltou a ter saldo.
    if loan.status == "paid" and not loan.mine_is_back:
        loan.status = "active"

    db.session.commit()
    return jsonify(loan.to_dict())


@loans_bp.post("/<int:loan_id>/postpone")
def postpone(loan_id):
    """Adia o vencimento sem receber nada.

    `charge_interest` (padrão sim): o mês vence mesmo assim e os juros dele
    ficam pendentes para o próximo recebimento. Sem ele é carência: só muda a data.
    """
    loan = db.get_or_404(Loan, loan_id)
    data = request.get_json(silent=True) or {}
    if loan.status == "paid":
        return jsonify({"error": "Esse empréstimo já foi quitado"}), 400
    new_due = iso_date(data.get("due_date"), "due_date")
    if loan.due_date and new_due <= loan.due_date:
        return jsonify({"error": "A nova data precisa ser depois do vencimento atual"}), 400

    event = _new_event(loan, "postpone", date.today(), text(data.get("notes"), "notes") or None)
    if data.get("charge_interest", True):
        _close_month(loan, event, new_due)
    else:
        event.due_after = new_due
        loan.due_date = new_due
    if loan.status == "late":
        loan.status = "active"
    db.session.commit()
    return jsonify(loan.to_dict()), 201


@loans_bp.delete("/<int:loan_id>/events/<int:event_id>")
def undo_event(loan_id, event_id):
    """Desfaz o último passo (recebimento ou adiamento) e volta tudo ao que era antes."""
    loan = db.get_or_404(Loan, loan_id)
    event = LoanEvent.query.filter_by(id=event_id, loan_id=loan.id).first_or_404()
    if loan.events and loan.events[-1].id != event.id:
        return jsonify({"error": "Desfaça primeiro o passo mais recente"}), 400

    for repayment in list(event.parts):
        _drop_repayment_transactions(repayment)
        loan.repayments.remove(repayment)
    if event.charged:
        loan.months_charged -= 1
    loan.due_date = event.due_before
    loan.months = event.months_before
    loan.status = event.status_before
    loan.events.remove(event)
    db.session.commit()
    return jsonify(loan.to_dict())


@loans_bp.delete("/<int:loan_id>")
def delete_loan(loan_id):
    """Apaga o empréstimo.

    `?keep_cash=1`: os lançamentos que ele fez (saída e recebimentos) ficam no
    caixa como lançamentos comuns — o saldo das contas não muda. Sem isso, eles
    saem junto e o caixa volta ao que era antes do empréstimo.
    """
    loan = db.get_or_404(Loan, loan_id)
    keep_cash = request.args.get("keep_cash") in ("1", "true")
    for repayment in loan.repayments:
        if keep_cash:
            repayment.transaction_id = repayment.partner_transaction_id = None
        else:
            _drop_repayment_transactions(repayment)
    if keep_cash:
        loan.outflow = None
    else:
        _set_outflow(loan, None)
    db.session.flush()
    db.session.delete(loan)
    db.session.commit()
    return "", 204
