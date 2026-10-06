"""Moeda por posição, metas e avisos."""

from datetime import date, timedelta

import pytest

from app.models.recurring import RecurringTransaction
from app.services import rates


@pytest.fixture
def dolar_a_5(monkeypatch, tmp_path, app):
    """Cotação fixa e sem internet: US$ 1 = R$ 5."""
    monkeypatch.setattr(rates, "_fetch", lambda: {"USD": {"rate": "5", "updated_at": "agora"}})
    monkeypatch.setattr(rates, "_cache", {"at": float("-inf"), "rates": {}})
    app.instance_path = str(tmp_path)


def _usd_position(client, valor):
    response = client.post(
        "/api/playlists",
        json={"name": "Cripto", "kind": "asset", "currency": "USD", "opening_value": valor},
    )
    assert response.status_code == 201, response.get_data(as_text=True)
    return response.get_json()


def test_posicao_em_dolar_entra_no_patrimonio_em_reais(client, dolar_a_5, make_account, summary):
    make_account(initial=1000)
    cripto = _usd_position(client, 200)

    assert cripto["native_value"] == 200
    assert cripto["opening_value"] == 1000  # US$ 200 × 5
    assert summary()["net_worth"] == 2000


def test_registro_guarda_dolar_e_historico_em_reais(client, dolar_a_5):
    cripto = _usd_position(client, 0)
    response = client.post(
        "/api/snapshots",
        json={"date": "2026-10-01", "entries": [{"playlist_id": cripto["id"], "value": 300}]},
    )
    snap = response.get_json()
    assert snap["positions"][str(cripto["id"])] == 1500
    assert snap["native"][str(cripto["id"])] == 300


def test_aporte_em_reais_vira_dolar_na_posicao(client, dolar_a_5, make_account):
    conta = make_account(initial=1000)
    cripto = _usd_position(client, 100)

    response = client.post(
        "/api/snapshots/invest",
        json={"to": {"type": "playlist", "id": cripto["id"]}, "from_account_id": conta.id, "amount": 500},
    )
    assert response.status_code == 201, response.get_data(as_text=True)
    atual = client.get(f"/api/playlists/{cripto['id']}").get_json()
    assert atual["native_value"] == 200  # 100 + R$500/5


def test_sem_cotacao_nao_inventa_valor(client, monkeypatch, tmp_path, app):
    def offline():
        raise OSError("sem internet")

    monkeypatch.setattr(rates, "_fetch", offline)
    monkeypatch.setattr(rates, "_cache", {"at": float("-inf"), "rates": {}})
    app.instance_path = str(tmp_path)

    cripto = _usd_position(client, 200)
    assert cripto["rate"] is None
    assert cripto["opening_value"] == 0


def test_meta_acompanha_patrimonio_e_calcula_quanto_guardar(client, make_account):
    make_account(initial=4000)
    deadline = date.today().replace(day=1) + timedelta(days=95)  # ~3 meses à frente
    response = client.post(
        "/api/goals", json={"name": "Reserva", "target_amount": 10000, "deadline": deadline.isoformat()}
    )
    goal = response.get_json()
    assert goal["current"] == 4000
    assert goal["remaining"] == 6000
    assert goal["progress"] == 0.4
    assert goal["monthly_needed"] == pytest.approx(6000 / goal["months_left"])


def test_meta_ligada_a_uma_posicao(client, make_position):
    obra = make_position(name="obra", opening=2500)
    goal = client.post(
        "/api/goals", json={"name": "Terminar obra", "target_amount": 5000, "playlist_id": obra.id}
    ).get_json()
    assert goal["current"] == 2500
    assert goal["playlist"]["name"] == "obra"


def test_avisos_recorrente_manual_vencida(db, make_account, summary):
    conta = make_account()
    db.session.add(
        RecurringTransaction(
            description="Luz", amount=200, type="expense", account_id=conta.id,
            frequency="monthly", next_due_date=date.today() - timedelta(days=2), auto=False,
        )
    )
    db.session.commit()

    alerts = summary()["alerts"]
    assert alerts[0]["level"] == "danger"
    assert alerts[0]["title"] == "Lançar Luz"
