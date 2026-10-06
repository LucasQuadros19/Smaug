"""Tipos de ativo: o que um lançamento faz com o valor da posição."""

import pytest


@pytest.fixture
def lancar(client):
    def _lancar(conta, posicao, tipo, valor, quando="2026-08-01"):
        response = client.post(
            "/api/transactions",
            json={
                "description": "lançamento",
                "account_id": conta.id,
                "playlist_id": posicao.id,
                "amount": valor,
                "type": tipo,
                "date": quando,
            },
        )
        assert response.status_code == 201, response.get_data(as_text=True)

    return _lancar


def _posicao(client, nome):
    itens = client.get("/api/playlists?kind=asset").get_json()
    itens = itens["items"] if isinstance(itens, dict) else itens
    return next(p for p in itens if p["name"] == nome)


# --- valor declarado (veículo, imóvel): gasto não vira valor -----------------


def test_gasto_no_veiculo_nao_aumenta_o_valor(client, make_account, make_position, lancar):
    """O bug relatado: lançar despesa na moto fazia a moto valer mais."""
    conta = make_account(initial=10_000)
    moto = make_position(name="moto", opening=36_700, asset_type="vehicle")

    lancar(conta, moto, "expense", 500)

    assert _posicao(client, "moto")["outstanding"] == 36_700


def test_gasto_no_veiculo_sai_do_caixa_e_conta_como_despesa(
    make_account, make_position, lancar, summary
):
    """Gasolina é dinheiro que foi embora: sai da conta e conta no mês."""
    conta = make_account(initial=10_000)
    moto = make_position(name="moto", opening=36_700, asset_type="vehicle")

    lancar(conta, moto, "expense", 500)

    s = summary(month="2026-08")
    assert s["total_balance"] == 9_500
    assert s["month_expense"] == 500


def test_veiculo_nao_infla_o_patrimonio_com_gastos(
    make_account, make_position, lancar, summary
):
    """Patrimônio cai o que foi gasto — a moto continua valendo a FIPE."""
    conta = make_account(initial=10_000)
    moto = make_position(name="moto", opening=36_700, asset_type="vehicle")
    assert summary()["net_worth"] == 46_700

    lancar(conta, moto, "expense", 500)

    assert summary()["net_worth"] == 46_200


def test_valor_do_veiculo_muda_editando(client, make_account, make_position):
    """A FIPE caiu: quem muda o valor é você, não os lançamentos."""
    make_account(initial=0)
    moto = make_position(name="moto", opening=36_700, asset_type="vehicle")

    client.put(f"/api/playlists/{moto.id}", json={"opening_value": 34_000})

    assert _posicao(client, "moto")["outstanding"] == 34_000


# --- capital (empréstimo, investimento, obra): aporte vira valor -------------


def test_aporte_em_investimento_continua_virando_valor(
    client, make_account, make_position, lancar, summary
):
    """O outro lado: na obra, colocar dinheiro é aporte e não é gasto do mês."""
    conta = make_account(initial=10_000)
    obra = make_position(name="obra", opening=1_000, asset_type="construction")

    lancar(conta, obra, "expense", 5_000)

    assert _posicao(client, "obra")["outstanding"] == 6_000
    s = summary()
    assert s["total_balance"] == 5_000
    assert s["month_expense"] == 0  # patrimônio mudando de forma, não gasto
    assert s["net_worth"] == 11_000  # inalterado: o dinheiro só trocou de lugar


def test_retorno_do_investimento_baixa_a_posicao(client, make_account, make_position, lancar):
    conta = make_account(initial=0)
    obra = make_position(name="obra", opening=5_000, asset_type="construction")

    lancar(conta, obra, "income", 2_000)

    assert _posicao(client, "obra")["outstanding"] == 3_000


def test_tipo_padrao_e_capital(client, make_account, make_position, lancar):
    """Compatibilidade: quem já existia mantém o comportamento de antes."""
    conta = make_account(initial=10_000)
    pos = make_position(name="antiga", opening=1_000)

    assert _posicao(client, "antiga")["asset_type"] == "investment"
    lancar(conta, pos, "expense", 500)
    assert _posicao(client, "antiga")["outstanding"] == 1_500


# --- validação ---------------------------------------------------------------


def test_tipo_invalido_e_recusado(client):
    response = client.post(
        "/api/playlists",
        json={"name": "x", "kind": "asset", "asset_type": "foguete"},
    )
    assert response.status_code == 400
    assert "asset_type" in response.get_json()["error"]


def test_trocar_o_tipo_muda_o_calculo(client, make_account, make_position, lancar):
    """Marcar como veículo depois conserta um ativo que estava inflado."""
    conta = make_account(initial=10_000)
    moto = make_position(name="moto", opening=36_700)

    lancar(conta, moto, "expense", 500)
    assert _posicao(client, "moto")["outstanding"] == 37_200  # inflado

    client.put(f"/api/playlists/{moto.id}", json={"asset_type": "vehicle"})
    assert _posicao(client, "moto")["outstanding"] == 36_700  # corrigido
