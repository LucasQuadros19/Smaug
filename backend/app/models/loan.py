from decimal import Decimal

from app.extensions import db, utcnow
from app.tenancy import Owned

LOAN_STATUSES = ("active", "paid", "late")
# Só juros: todo mês voltam os juros e o principal volta no fim.
# Parcelas: todo mês volta um pedaço do principal mais os juros.
LOAN_SCHEDULES = ("interest_only", "installments")
# fee = multa ou juros de atraso: lucro a mais, fora dos juros do mês.
REPAYMENT_KINDS = ("principal", "interest", "fee")
EVENT_KINDS = ("receipt", "postpone")

CENT = Decimal("0.01")


def _sum(values):
    return sum((Decimal(v or 0) for v in values), Decimal(0))


class Loan(Owned, db.Model):
    """Registro de um empréstimo feito a alguém.

    O ganho e a comissão de cada pessoa são por mês. Os recebimentos dizem se
    são juros ou principal: só o principal tira o dinheiro da rua.
    """

    __tablename__ = "loans"

    id = db.Column(db.Integer, primary_key=True)
    borrower = db.Column(db.String(120), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    # % ao mês, só para referência: o que vale é o ganho digitado de cada um.
    interest_rate = db.Column(db.Numeric(6, 2), nullable=True)
    start_date = db.Column(db.Date, nullable=False)
    # Próximo vencimento. Receber só os juros e continuar empurra um mês.
    due_date = db.Column(db.Date, nullable=True)
    months = db.Column(db.Integer, nullable=False, default=1, server_default="1")
    # Meses cujos juros já venceram (recebidos ou não): cada recebimento que
    # fecha o mês e cada adiamento com juros soma 1.
    months_charged = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    schedule = db.Column(db.String(20), nullable=False, default="interest_only", server_default="interest_only")
    status = db.Column(db.String(20), nullable=False, default="active")
    notes = db.Column(db.String(500), nullable=True)
    # A saída de dinheiro da minha conta quando emprestei (opcional).
    transaction_id = db.Column(
        db.Integer, db.ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True
    )
    created_at = db.Column(db.DateTime, default=utcnow)

    outflow = db.relationship("Transaction", foreign_keys=[transaction_id])
    participants = db.relationship(
        "LoanParticipant", backref="loan", cascade="all, delete-orphan"
    )
    repayments = db.relationship(
        "LoanRepayment",
        backref="loan",
        cascade="all, delete-orphan",
        order_by="LoanRepayment.date",
    )
    events = db.relationship(
        "LoanEvent", backref="loan", cascade="all, delete-orphan", order_by="LoanEvent.id"
    )

    # -------------------------------------------------------------- cálculos

    @property
    def my_principal(self) -> Decimal:
        """Quanto desse empréstimo é dinheiro meu.

        Com participantes, é a parte marcada como "eu"; sem participantes, o
        empréstimo inteiro é meu. Com sócios mas nenhum "eu" marcado, zero —
        melhor do que chutar.
        """
        mine = [p for p in self.participants if p.is_me]
        if mine:
            return _sum(p.contributed for p in mine)
        if self.participants:
            return Decimal(0)
        return Decimal(self.amount or 0)

    @property
    def total_principal(self) -> Decimal:
        return _sum(p.contributed for p in self.participants) if self.participants else Decimal(self.amount or 0)

    def _received(self, kind, field="amount"):
        return _sum(getattr(r, field) for r in self.repayments if r.kind == kind)

    @property
    def my_repaid(self) -> Decimal:
        """Do meu principal, quanto já voltou. Juros não contam: são lucro."""
        return self._received("principal", "my_share")

    @property
    def my_outstanding(self) -> Decimal:
        """Quanto do meu dinheiro ainda está na rua."""
        return max(self.my_principal - self.my_repaid, Decimal(0))

    @property
    def principal_outstanding(self) -> Decimal:
        return max(self.total_principal - self._received("principal"), Decimal(0))

    @property
    def interest_pending(self) -> Decimal:
        """Juros de meses que já venceram e não voltaram: adiamento com juros ou pagamento parcial."""
        return max(self.monthly_interest * self.months_charged - self._received("interest"), Decimal(0))


    @property
    def monthly_interest(self) -> Decimal:
        """Juros de um mês: o ganho de cada um mais as comissões."""
        return _sum(p.monthly for p in self.participants)

    @property
    def my_monthly(self) -> Decimal:
        return _sum(p.monthly for p in self.participants if p.is_me)

    @property
    def commission(self) -> Decimal:
        """Comissão por mês, de quem ela for."""
        return _sum(p.commission for p in self.participants)

    @property
    def profit(self) -> Decimal:
        """Juros de todos os meses."""
        return self.monthly_interest * self.months

    @property
    def total_to_receive(self) -> Decimal:
        return self.total_principal + self.profit

    @property
    def my_to_receive(self) -> Decimal:
        return _sum(p.contributed for p in self.participants if p.is_me) + self.my_monthly * self.months

    @property
    def mine_is_back(self) -> bool:
        """Já voltou tudo o que é meu: principal e juros de todos os meses.

        Os sócios acertam à parte. Sem linha "eu" (só administro), vale o total.
        """
        counted = [r for r in self.repayments if r.kind != "fee"]
        if not any(p.is_me for p in self.participants):
            return _sum(r.amount for r in counted) >= self.total_to_receive
        return _sum(r.my_share for r in counted) >= self.my_to_receive

    def next_payment(self):
        """Sugestão do próximo recebimento, separando principal e juros, meu e dos sócios.

        Só juros: no último mês volta o principal todo. Parcelas: o que falta do
        principal dividido pelos meses que faltam.
        """
        remaining = max(self.months - self.months_charged, 1)
        partners_principal = max(
            self.total_principal - self.my_principal - self._received("principal", "partners_share"), Decimal(0)
        )
        if self.schedule == "installments":
            mine = (self.my_outstanding / remaining).quantize(CENT)
            partners = (partners_principal / remaining).quantize(CENT)
        elif remaining == 1:
            mine, partners = self.my_outstanding, partners_principal
        else:
            mine = partners = Decimal(0)
        return {
            "month": min(self.months_charged + 1, self.months),
            "principal": float(mine + partners),
            "my_principal": float(mine),
            # Os juros até o mês atual menos o que já voltou: soma o que ficou para
            # trás e desconta o que foi pago adiantado.
            "interest": float(max(self.monthly_interest * (self.months_charged + 1) - self._received("interest"), Decimal(0))),
            "my_interest": float(
                max(self.my_monthly * (self.months_charged + 1) - self._received("interest", "my_share"), Decimal(0))
            ),
        }

    @property
    def pending_to_partners(self) -> Decimal:
        """Dinheiro dos sócios que já voltou para mim e ainda não repassei.

        Fica no meu caixa mas não é meu — é passivo até o repasse.
        """
        return _sum(r.partners_share for r in self.repayments if not r.partners_settled)

    def to_dict(self):
        participants = sorted(self.participants, key=lambda p: (not p.is_me, p.id))
        mine = next((p for p in participants if p.is_me), None)
        return {
            "id": self.id,
            "borrower": self.borrower,
            "amount": float(self.amount or 0),
            "interest_rate": float(self.interest_rate) if self.interest_rate is not None else None,
            "months": self.months,
            "schedule": self.schedule,
            "months_charged": self.months_charged,
            "interest_pending": float(self.interest_pending),
            "monthly_interest": float(self.monthly_interest),
            "my_monthly": float(self.my_monthly),
            "commission": float(self.commission),
            "profit": float(self.profit),
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "status": self.status,
            "notes": self.notes,
            "participants": [p.to_dict(self.months) for p in participants],
            "repayments": [r.to_dict() for r in self.repayments],
            "events": [e.to_dict() for e in self.events],
            "total_contributed": float(self.total_principal),
            "total_to_receive": float(self.total_to_receive),
            "my_contributed": float(mine.contributed or 0) if mine else None,
            "my_to_receive": float(self.my_to_receive) if mine else None,
            "my_principal": float(self.my_principal),
            "my_repaid": float(self.my_repaid),
            "my_outstanding": float(self.my_outstanding),
            "my_interest_received": float(self._received("interest", "my_share")),
            "principal_outstanding": float(self.principal_outstanding),
            "total_repaid": float(_sum(r.amount for r in self.repayments)),
            "next_payment": self.next_payment(),
            "pending_to_partners": float(self.pending_to_partners),
            "outflow": (
                {
                    "account_id": self.outflow.account_id,
                    "amount": float(self.outflow.amount),
                    "date": self.outflow.date.isoformat(),
                }
                if self.outflow
                else None
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class LoanParticipant(Owned, db.Model):
    """Quem entrou com dinheiro nesse empréstimo e quanto ganha por mês."""

    __tablename__ = "loan_participants"

    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.Integer, db.ForeignKey("loans.id"), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    contributed = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    # Por mês: o que a pessoa ganha de juros e a comissão por cima. Digitados à mão.
    gain = db.Column(db.Numeric(12, 2), nullable=False, default=0, server_default="0")
    commission = db.Column(db.Numeric(12, 2), nullable=False, default=0, server_default="0")
    is_me = db.Column(db.Boolean, nullable=False, default=False)

    @property
    def monthly(self) -> Decimal:
        return Decimal(self.gain or 0) + Decimal(self.commission or 0)

    def to_dict(self, months=1):
        return {
            "id": self.id,
            "loan_id": self.loan_id,
            "name": self.name,
            "contributed": float(self.contributed or 0),
            "gain": float(self.gain or 0),
            "commission": float(self.commission or 0),
            # Principal mais o ganho de todos os meses (sem a comissão).
            "to_receive": float(Decimal(self.contributed or 0) + Decimal(self.gain or 0) * months),
            "is_me": self.is_me,
        }


class LoanRepayment(Owned, db.Model):
    """Um recebimento.

    `kind` diz se é principal (tira dinheiro da rua) ou juros (lucro).
    `amount` é tudo o que entrou na conta; `my_share` é a parte que é minha e
    `partners_share` a que pertence aos sócios. Enquanto `partners_settled`
    for falso, a parte deles está no meu caixa mas não é patrimônio meu.
    """

    __tablename__ = "loan_repayments"

    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.Integer, db.ForeignKey("loans.id"), nullable=False)
    kind = db.Column(db.String(10), nullable=False, default="principal", server_default="principal")
    date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    my_share = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    partners_share = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    partners_settled = db.Column(db.Boolean, nullable=False, default=False)
    notes = db.Column(db.String(300), nullable=True)
    # O recebimento do qual esta parte faz parte (juros + principal juntos).
    event_id = db.Column(db.Integer, db.ForeignKey("loan_events.id"), nullable=True, index=True)
    # Lançamentos gerados, para conseguir desfazer sem deixar lixo no caixa.
    transaction_id = db.Column(db.Integer, db.ForeignKey("transactions.id"), nullable=True)
    partner_transaction_id = db.Column(
        db.Integer, db.ForeignKey("transactions.id"), nullable=True
    )
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "loan_id": self.loan_id,
            "kind": self.kind,
            "event_id": self.event_id,
            "date": self.date.isoformat() if self.date else None,
            "amount": float(self.amount or 0),
            "my_share": float(self.my_share or 0),
            "partners_share": float(self.partners_share or 0),
            "account_id": self.account_id,
            "partners_settled": self.partners_settled,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class LoanEvent(Owned, db.Model):
    """Um passo na vida do empréstimo: um recebimento ou um adiamento.

    Guarda como estava antes (vencimento, meses, situação) para dar para
    desfazer o último passo e voltar tudo ao que era.
    """

    __tablename__ = "loan_events"

    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.Integer, db.ForeignKey("loans.id"), nullable=False, index=True)
    kind = db.Column(db.String(10), nullable=False)
    date = db.Column(db.Date, nullable=False)
    due_before = db.Column(db.Date, nullable=True)
    due_after = db.Column(db.Date, nullable=True)
    # Este passo fechou um mês de juros (venceu, recebido ou não).
    charged = db.Column(db.Boolean, nullable=False, default=False)
    months_before = db.Column(db.Integer, nullable=False)
    status_before = db.Column(db.String(20), nullable=False)
    notes = db.Column(db.String(300), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    parts = db.relationship("LoanRepayment", backref="event", order_by="LoanRepayment.id")

    def to_dict(self):
        return {
            "id": self.id,
            "kind": self.kind,
            "date": self.date.isoformat(),
            "due_before": self.due_before.isoformat() if self.due_before else None,
            "due_after": self.due_after.isoformat() if self.due_after else None,
            "charged": self.charged,
            "notes": self.notes,
            "parts": [r.to_dict() for r in self.parts],
            "total": float(_sum(r.amount for r in self.parts)),
        }
