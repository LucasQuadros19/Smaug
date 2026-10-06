"""Aporte, histórico por posição e exportação."""


def test_aportar_tira_do_caixa_e_poe_na_posicao(client, make_account, make_position, summary):
    conta = make_account(initial=20_000)
    obra = make_position(name="obra", opening=10_000)

    antes = summary()["net_worth"]
    response = client.post(
        "/api/snapshots/invest",
        json={
            "to": {"type": "playlist", "id": obra.id},
            "from_account_id": conta.id,
            "amount": 5_000,
            "date": "2026-08-27",
        },
    )
    assert response.status_code == 201

    depois = summary()
    assert depois["total_balance"] == 15_000
    assert depois["parked_in_assets"] == 15_000
    assert depois["net_worth"] == antes  # só mudou de lugar


def test_nao_aporta_em_posicao_derivada(client, make_account, make_position):
    conta = make_account(initial=1_000)
    posicao = make_position(name="empréstimo", opening=0, auto_source="loans")

    response = client.post(
        "/api/snapshots/invest",
        json={
            "to": {"type": "playlist", "id": posicao.id},
            "from_account_id": conta.id,
            "amount": 100,
            "date": "2026-08-27",
        },
    )
    assert response.status_code == 400
    assert "Empréstimos" in response.get_json()["error"]


def test_historico_da_posicao_traz_a_serie(client, make_account, make_position):
    conta = make_account(initial=30_000)
    obra = make_position(name="obra", opening=0)

    for valor, dia in ((10_000, "2026-01-15"), (5_000, "2026-02-20")):
        client.post(
            "/api/snapshots/invest",
            json={
                "to": {"type": "playlist", "id": obra.id},
                "from_account_id": conta.id,
                "amount": valor,
                "date": dia,
            },
        )

    data = client.get(f"/api/playlists/{obra.id}/history").get_json()
    assert [p["value"] for p in data["series"]] == [10_000, 15_000]
    assert data["first_funded"] == "2026-01-15"
    assert data["peak"] == 15_000
    assert data["days_held"] is not None


def test_comparacao_com_o_mes_anterior(client, make_account, make_category, make_transaction):
    from datetime import date

    conta = make_account(initial=10_000)
    categoria = make_category()
    hoje = date.today()
    mes_passado = (hoje.replace(day=1) - __import__("datetime").timedelta(days=1)).replace(day=10)

    make_transaction(conta, 300, category=categoria, when=hoje.replace(day=5))
    make_transaction(conta, 500, category=categoria, when=mes_passado)

    data = client.get(f"/api/dashboard/summary?month={hoje:%Y-%m}").get_json()
    assert data["month_expense"] == 300
    assert data["previous_month"]["expense"] == 500


def test_exporta_patrimonio_em_csv(client, make_account, make_position):
    make_account(initial=580)
    make_position(name="obra", opening=1_000)
    client.post(
        "/api/snapshots",
        json={
            "date": "2026-08-27",
            "entries": [{"playlist_id": 1, "value": 1_000}, {"account_id": 1, "value": 580}],
        },
    )

    response = client.get("/api/export/patrimonio.csv")
    assert response.status_code == 200
    assert "attachment" in response.headers["Content-Disposition"]

    texto = response.get_data(as_text=True)
    assert "Data;obra;Dinheiro" in texto
    assert "1000,00" in texto  # vírgula decimal, para o Excel pt-BR


def test_exporta_emprestimos_com_uma_linha_por_participante(client):
    client.post(
        "/api/loans",
        json={
            "borrower": "Carlos",
            "amount": 50_000,
            "start_date": "2026-01-10",
            "status": "active",
            "participants": [
                {"name": "Eu", "contributed": 25_000, "to_receive": 27_500, "is_me": True},
                {"name": "Sócio", "contributed": 25_000, "to_receive": 27_500},
            ],
        },
    )

    linhas = client.get("/api/export/emprestimos.csv").get_data(as_text=True).splitlines()
    assert len(linhas) == 3  # cabeçalho + 2 participantes
    assert "Carlos" in linhas[1] and "Eu" in linhas[1]
