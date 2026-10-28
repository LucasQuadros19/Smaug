"""Configurações do usuário: padrões de mercado e do sistema.

Cada usuário guarda só o que mudou; o resto vem de DEFAULTS. Mudar um padrão
de mercado não mexe no que já foi registrado — vale para os próximos cadastros.
"""

from werkzeug.exceptions import BadRequest

DEFAULTS = {
    # Empréstimos. 4% ao mês é a taxa padrão do Fozesc.
    "loan_rate": 4.0,  # % ao mês
    "loan_months": 1,
    "loan_schedule": "interest_only",
    "late_fine": 2.0,  # % de multa sobre o valor atrasado (teto do Código de Defesa do Consumidor)
    "late_interest": 1.0,  # % ao mês de juros de mora, contado por dia
    "grace_days": 0,  # dias de tolerância antes de cobrar atraso
    "postpone_charges": True,  # adiar cobra os juros do mês
    "business_days": True,  # vencimento em fim de semana ou feriado: avisa e sugere o próximo dia útil
    # Mercado
    "order_fee": 0.0,  # R$ por ordem (corretagem)
    "b3_fee": 0.03,  # % sobre o valor da ordem em ações da B3 (emolumentos + liquidação)
    "stock_tax": 15.0,  # % de IR sobre o lucro em ações
    "stock_exempt": 20000.0,  # vendas de ações no mês até este valor: isento
    "crypto_tax": 15.0,
    "crypto_exempt": 35000.0,
    # Sistema
    "theme": "dark",  # dark, light ou system (segue o aparelho)
    "hide_values": False,  # mostra R$ ••• no lugar dos valores
    "start_page": "/",  # aba que abre ao entrar
    "week_starts_monday": False,  # calendário de segunda a domingo
    "show_goals": False,  # metas no Dashboard
    "show_category_breakdown": False,  # gastos por categoria no Caixa
}

_CHOICES = {
    "loan_schedule": ("interest_only", "installments"),
    "theme": ("dark", "light", "system"),
    "start_page": (
        "/", "/calendario", "/transacoes", "/recorrentes", "/orcamentos", "/lista-compras", "/patrimonio", "/ativos",
        "/emprestimos", "/metas", "/mercado", "/bot", "/grupos", "/contas", "/categorias", "/calculos",
    ),
}
_LIMITS = {
    "loan_rate": (0, 100),
    "loan_months": (1, 600),
    "late_fine": (0, 100),
    "late_interest": (0, 100),
    "grace_days": (0, 90),
    "order_fee": (0, 100_000),
    "b3_fee": (0, 10),
    "stock_tax": (0, 100),
    "stock_exempt": (0, 1_000_000_000),
    "crypto_tax": (0, 100),
    "crypto_exempt": (0, 1_000_000_000),
}


def merged(stored):
    """Os padrões com o que o usuário mudou por cima."""
    return {**DEFAULTS, **{k: v for k, v in (stored or {}).items() if k in DEFAULTS}}


def validate(patch):
    """Confere tipo e faixa de cada valor enviado. Devolve só o que é válido ou recusa tudo."""
    if not isinstance(patch, dict):
        raise BadRequest("settings deve ser um objeto")
    clean = {}
    for key, value in patch.items():
        if key not in DEFAULTS:
            raise BadRequest(f"Configuração desconhecida: {key}")
        default = DEFAULTS[key]
        if isinstance(default, bool):
            if not isinstance(value, bool):
                raise BadRequest(f"{key} deve ser sim ou não")
        elif key in _CHOICES:
            if value not in _CHOICES[key]:
                raise BadRequest(f"{key} deve ser um de {_CHOICES[key]}")
        else:
            low, high = _LIMITS[key]
            # `not low <= value <= high` também recusa NaN.
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not low <= value <= high:
                raise BadRequest(f"{key} deve ser um número de {low} a {high}")
            if isinstance(default, int):
                if value != int(value):
                    raise BadRequest(f"{key} deve ser um número inteiro")
                value = int(value)
            else:
                value = float(value)
        clean[key] = value
    return clean
