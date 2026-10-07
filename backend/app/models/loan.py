from decimal import Decimal

from app.extensions import db, utcnow
from app.tenancy import Owned

LOAN_STATUSES = ("active", "paid", "late")


class Loan(Owned, db.Model):
    """Registro de um empréstimo feito a alguém.

    Todos os valores são digitados à mão — o app não calcula juros nem
    rateio; ele só guarda e mostra organizado.
    """

    __tablename__ = "loans"

    id = db.Column(db.Integer, primary_key=True)
    borrower = db.Column(db.String(120), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    interest_rate = db.Column(db.Numeric(6, 2), nullable=True)
    # Quando você empresta dinheiro de outros e fica com uma parte do lucro.
    # Em % do lucro total (o que volta a mais do que saiu).
    commission_rate = db.Column(db.Numeric(5, 2), nullable=True)
    start_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="active")
    notes = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    participants = db.relationship(
        "LoanParticipant", backref="loan", cascade="all, delete-orphan"
    )
    repayments = db.relationship(
        "LoanRepayment",
        backref="loan",
        cascade="all, delete-orphan",
        order_by="LoanRepayment.date",
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
            return sum((Decimal(p.contributed or 0) for p in mine), Decimal(0))
        if self.participants:
            return Decimal(0)
        return Decimal(self.amount or 0)

    @property
    def my_repaid(self) -> Decimal:
        return sum((Decimal(r.my_share or 0) for r in self.repayments), Decimal(0))

    @property
    def my_outstanding(self) -> Decimal:
        """Quanto do meu dinheiro ainda está na rua."""
        return max(self.my_principal - self.my_repaid, Decimal(0))

    @property
    def profit(self) -> Decimal:
        """O que a pessoa devolve a mais do que pegou, pelo digitado nos participantes."""
        received = sum((Decimal(p.to_receive or 0) for p in self.participants), Decimal(0))
        contributed = sum((Decimal(p.contributed or 0) for p in self.participants), Decimal(0))
        return max(received - contributed, Decimal(0))

    @property
    def commission(self) -> Decimal:
        if not self.commission_rate:
            return Decimal(0)
        return (self.profit * Decimal(self.commission_rate) / 100).quantize(Decimal("0.01"))

    @property
    def mine_is_back(self) -> bool:
        """O que era meu já voltou? Com dinheiro meu, é o principal. Só com
        comissão (entrei com zero), é o que eu tenho a receber."""
        if self.my_principal > 0:
            return self.my_outstanding <= 0
        my_to_receive = sum(
            (Decimal(p.to_receive or 0) for p in self.participants if p.is_me), Decimal(0)
        )
        return self.my_repaid >= my_to_receive

    @property
    def pending_to_partners(self) -> Decimal:
        """Dinheiro dos sócios que já voltou para mim e ainda não repassei.

        Fica no meu caixa mas não é meu — é passivo até o repasse.
        """
        return sum(
            (Decimal(r.partners_share or 0) for r in self.repayments if not r.partners_settled),
            Decimal(0),
        )

    def to_dict(self):
        participants = sorted(self.participants, key=lambda p: (not p.is_me, p.id))
        contributed = sum(float(p.contributed or 0) for p in participants)
        to_receive = sum(float(p.to_receive or 0) for p in participants)
        mine = next((p for p in participants if p.is_me), None)
        return {
            "id": self.id,
            "borrower": self.borrower,
            "amount": float(self.amount or 0),
            "interest_rate": float(self.interest_rate) if self.interest_rate is not None else None,
            "commission_rate": float(self.commission_rate) if self.commission_rate is not None else None,
            "commission": float(self.commission),
            "profit": float(self.profit),
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "status": self.status,
            "notes": self.notes,
            "participants": [p.to_dict() for p in participants],
            "repayments": [r.to_dict() for r in self.repayments],
            # Somatórios apenas para conferência visual — não substituem os
            # valores digitados, servem para o usuário notar divergências.
            "total_contributed": contributed,
            "total_to_receive": to_receive,
            "my_contributed": float(mine.contributed or 0) if mine else None,
            "my_to_receive": float(mine.to_receive or 0) if mine else None,
            "my_principal": float(self.my_principal),
            "my_repaid": float(self.my_repaid),
            "my_outstanding": float(self.my_outstanding),
            "total_repaid": float(
                sum((Decimal(r.amount or 0) for r in self.repayments), Decimal(0))
            ),
            "pending_to_partners": float(self.pending_to_partners),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class LoanParticipant(Owned, db.Model):
    """Quem entrou com dinheiro nesse empréstimo e quanto recebe de volta."""

    __tablename__ = "loan_participants"

    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.Integer, db.ForeignKey("loans.id"), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    contributed = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    to_receive = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    is_me = db.Column(db.Boolean, nullable=False, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "loan_id": self.loan_id,
            "name": self.name,
            "contributed": float(self.contributed or 0),
            "to_receive": float(self.to_receive or 0),
            "is_me": self.is_me,
        }


class LoanRepayment(Owned, db.Model):
    """Uma parcela que voltou.

    `amount` é tudo o que entrou na conta; `my_share` é a parte que é minha e
    `partners_share` a que pertence aos sócios. Enquanto `partners_settled`
    for falso, a parte deles está no meu caixa mas não é patrimônio meu.
    """

    __tablename__ = "loan_repayments"

    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.Integer, db.ForeignKey("loans.id"), nullable=False)
    date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    my_share = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    partners_share = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    partners_settled = db.Column(db.Boolean, nullable=False, default=False)
    notes = db.Column(db.String(300), nullable=True)
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
            "date": self.date.isoformat() if self.date else None,
            "amount": float(self.amount or 0),
            "my_share": float(self.my_share or 0),
            "partners_share": float(self.partners_share or 0),
            "account_id": self.account_id,
            "partners_settled": self.partners_settled,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
