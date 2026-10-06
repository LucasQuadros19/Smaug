"""Adiamento de recorrente: vale para automática e manual, só na ocorrência atual."""

from datetime import date, timedelta

import pytest

from app.models.recurring import RecurringTransaction
from app.models.transaction import Transaction
from app.services.recurring_service import next_due_after


@pytest.fixture
def recorrente(db, make_account):
    def _make(auto, due):
        item = RecurringTransaction(
            description="Aluguel", amount=1000, type="expense", account_id=make_account().id,
            frequency="monthly", next_due_date=due, auto=auto,
        )
        db.session.add(item)
        db.session.commit()
        return item

    return _make


def test_automatica_adiada_so_gera_na_nova_data(client, recorrente):
    hoje = date.today()
    item = recorrente(auto=True, due=hoje - timedelta(days=1))
    adiada = client.post(f"/api/recurring/{item.id}/postpone", json={"until": (hoje + timedelta(days=5)).isoformat()})
    assert adiada.status_code == 200, adiada.get_data(as_text=True)

    assert client.post("/api/recurring/generate", json={}).get_json()["generated"] == 0


def test_ao_gerar_adiada_volta_ao_calendario_normal(client, db, recorrente):
    hoje = date.today()
    original = hoje - timedelta(days=10)
    item = recorrente(auto=True, due=original)
    adiamento = hoje - timedelta(days=2)  # adiada para uma data que também já chegou
    client.post(f"/api/recurring/{item.id}/postpone", json={"until": adiamento.isoformat()})

    client.post("/api/recurring/generate", json={})

    tx = Transaction.query.order_by(Transaction.date).first()
    assert tx.date == adiamento
    db.session.refresh(item)
    assert item.postponed_until is None
    # A próxima segue o calendário original (um mês depois de `original`), não o adiamento.
    assert item.next_due_date == next_due_after(original, "monthly")


def test_manual_adiada_lanca_na_data_adiada_e_some_dos_avisos(client, recorrente, summary):
    hoje = date.today()
    item = recorrente(auto=False, due=hoje - timedelta(days=1))
    assert summary()["alerts"][0]["title"] == "Lançar Aluguel"

    client.post(f"/api/recurring/{item.id}/postpone", json={"until": (hoje + timedelta(days=10)).isoformat()})
    assert summary()["alerts"] == []

    lancada = client.post(f"/api/recurring/{item.id}/launch", json={}).get_json()
    assert lancada["transaction"]["date"] == (hoje + timedelta(days=10)).isoformat()
    assert lancada["recurring"]["postponed_until"] is None


def test_desfazer_adiamento(client, recorrente):
    item = recorrente(auto=False, due=date.today())
    client.post(f"/api/recurring/{item.id}/postpone", json={"until": (date.today() + timedelta(days=3)).isoformat()})
    desfeito = client.post(f"/api/recurring/{item.id}/postpone", json={"until": None}).get_json()
    assert desfeito["due_date"] == date.today().isoformat()


def test_nao_adia_para_antes_do_vencimento(client, recorrente):
    item = recorrente(auto=True, due=date.today())
    response = client.post(f"/api/recurring/{item.id}/postpone", json={"until": date.today().isoformat()})
    assert response.status_code == 400
