"""Regras do patrimônio.

Todos os bugs que já apareceram na prática viraram teste aqui: dinheiro que
sumia ao quitar, dívida contada como lucro, aporte inflando despesa do mês.
"""


def test_patrimonio_soma_caixa_e_posicoes(make_account, make_position, summary):
    make_account(initial=1_000)
    make_position(name="obra", opening=50_000)

    data = summary()

    assert data["total_balance"] == 1_000
    assert data["parked_in_assets"] == 50_000
    assert data["net_worth"] == 51_000


def test_posicao_fora_do_patrimonio_nao_soma(make_account, make_position, summary):
    make_account(initial=1_000)
    make_position(name="viagem", opening=3_000, counts=False, kind="group")

    data = summary()

    assert data["net_worth"] == 1_000
    assert data["parked_in_playlists"] == 0


def test_divida_declarada_negativa_reduz_o_patrimonio(make_account, make_position, summary):
    """Regressão: dívida de -4.000 era exibida como lucro e zerada no total."""
    make_account(initial=10_000)
    make_position(name="dívida", opening=-4_000)

    data = summary()

    assert data["net_worth"] == 6_000
    divida = next(p for p in data["playlists_summary"] if p["name"] == "dívida")
    assert divida["outstanding"] == -4_000


def test_lucro_realizado_nao_e_contado_duas_vezes(
    make_account, make_position, make_transaction, summary
):
    """Voltou mais do que saiu: o excedente já está no caixa, não soma de novo."""
    account = make_account(initial=0)
    position = make_position(name="empréstimo", opening=1_000)
    make_transaction(account, 1_500, type_="income", playlist=position)

    data = summary()

    assert data["total_balance"] == 1_500
    assert data["parked_in_assets"] == 0  # posição zerada, não -500
    assert data["net_worth"] == 1_500


def test_aporte_marcado_com_ativo_nao_vira_despesa_do_mes(
    make_account, make_position, make_transaction, summary
):
    """Regressão: emprestar dinheiro inflava 'despesas do mês'."""
    account = make_account(initial=50_000)
    position = make_position(name="empréstimo", opening=0)
    make_transaction(account, 20_000, type_="expense", playlist=position)

    data = summary()

    assert data["month_expense"] == 0
    assert data["total_balance"] == 30_000
    assert data["parked_in_assets"] == 20_000
    assert data["net_worth"] == 50_000  # nada sumiu, só mudou de lugar


def test_gasto_real_sem_playlist_conta_como_despesa(
    make_account, make_category, make_transaction, summary
):
    account = make_account(initial=1_000)
    make_transaction(account, 250, type_="expense", category=make_category())

    data = summary()

    assert data["month_expense"] == 250
    assert data["net_worth"] == 750
