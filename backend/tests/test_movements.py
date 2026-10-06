"""Transferência e liquidação: o dinheiro precisa sempre ter para onde ir."""


def _post(client, url, payload):
    response = client.post(url, json=payload)
    return response.status_code, response.get_json()


def test_transferencia_preserva_o_patrimonio(client, make_account, make_position, summary):
    make_account(initial=1_000)
    origem = make_position(name="obra", opening=50_000)
    destino = make_position(name="cripto", opening=0)

    antes = summary()["net_worth"]
    status, _ = _post(
        client,
        "/api/snapshots/transfer",
        {
            "from": {"type": "playlist", "id": origem.id},
            "to": {"type": "playlist", "id": destino.id},
            "amount": 20_000,
            "date": "2026-08-27",
        },
    )
    assert status == 201

    depois = summary()
    assert depois["net_worth"] == antes  # só mudou de lugar
    valores = {p["name"]: p["opening_value"] for p in depois["playlists_summary"]}
    assert valores["obra"] == 30_000
    assert valores["cripto"] == 20_000


def test_transferencia_cria_linha_na_planilha(client, make_account, make_position):
    make_account(initial=100)
    origem = make_position(name="obra", opening=1_000)
    destino = make_position(name="cripto", opening=0)

    assert client.get("/api/snapshots").get_json()["total"] == 0
    _post(
        client,
        "/api/snapshots/transfer",
        {
            "from": {"type": "playlist", "id": origem.id},
            "to": {"type": "playlist", "id": destino.id},
            "amount": 500,
            "date": "2026-08-27",
        },
    )
    assert client.get("/api/snapshots").get_json()["total"] == 1


def test_transferencia_recusa_origem_igual_ao_destino(client, make_position):
    posicao = make_position(name="obra", opening=1_000)
    status, body = _post(
        client,
        "/api/snapshots/transfer",
        {
            "from": {"type": "playlist", "id": posicao.id},
            "to": {"type": "playlist", "id": posicao.id},
            "amount": 100,
            "date": "2026-08-27",
        },
    )
    assert status == 400
    assert "diferentes" in body["error"]


def test_venda_acima_do_valor_gera_lucro(client, make_account, make_position, summary):
    """A obra sai dos livros por 50.848 e entra 60.000 na conta."""
    conta = make_account(initial=0)
    obra = make_position(name="obra", opening=50_848)

    status, body = _post(
        client,
        "/api/snapshots/settle",
        {
            "from": {"type": "playlist", "id": obra.id},
            "to_account_id": conta.id,
            "received": 60_000,
            "date": "2026-08-27",
        },
    )
    assert status == 201
    assert body["realized_gain"] == 9_152

    depois = summary()
    assert depois["total_balance"] == 60_000
    assert depois["parked_in_assets"] == 0
    assert depois["net_worth"] == 60_000  # 50.848 + 9.152 de lucro


def test_venda_abaixo_do_valor_gera_prejuizo(client, make_account, make_position, summary):
    conta = make_account(initial=0)
    moto = make_position(name="moto", opening=36_700)

    _, body = _post(
        client,
        "/api/snapshots/settle",
        {
            "from": {"type": "playlist", "id": moto.id},
            "to_account_id": conta.id,
            "received": 30_000,
            "date": "2026-08-27",
        },
    )
    assert body["realized_gain"] == -6_700
    assert summary()["net_worth"] == 30_000


def test_venda_parcial_deixa_o_resto_na_posicao(client, make_account, make_position, summary):
    conta = make_account(initial=0)
    cripto = make_position(name="cripto", opening=10_000)

    _post(
        client,
        "/api/snapshots/settle",
        {
            "from": {"type": "playlist", "id": cripto.id},
            "to_account_id": conta.id,
            "received": 6_000,
            "reduce_by": 5_000,
            "date": "2026-08-27",
        },
    )

    depois = summary()
    assert depois["parked_in_assets"] == 5_000
    assert depois["total_balance"] == 6_000
    assert depois["net_worth"] == 11_000


def test_nao_liquida_posicao_derivada(client, make_account, make_position):
    conta = make_account(initial=0)
    posicao = make_position(name="empréstimo", opening=0, auto_source="loans")

    status, body = _post(
        client,
        "/api/snapshots/settle",
        {
            "from": {"type": "playlist", "id": posicao.id},
            "to_account_id": conta.id,
            "received": 100,
            "date": "2026-08-27",
        },
    )
    assert status == 400
    assert "Empréstimos" in body["error"]
