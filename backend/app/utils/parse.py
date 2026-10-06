import re
from datetime import date
from decimal import Decimal, InvalidOperation

from werkzeug.exceptions import BadRequest

_COLOR = re.compile(r"#[0-9a-fA-F]{3,8}")


def money(value, field, *, allow_zero=False, allow_negative=False, required=True):
    if value is None or value == "":
        if required:
            raise BadRequest(f"Informe {field}")
        return None
    try:
        amount = Decimal(str(value))
    except InvalidOperation:
        raise BadRequest(f"{field} inválido") from None
    if not amount.is_finite():
        raise BadRequest(f"{field} inválido")
    if amount < 0 and not allow_negative:
        raise BadRequest(f"{field} não pode ser negativo")
    if amount == 0 and not (allow_zero or allow_negative):
        raise BadRequest(f"{field} deve ser maior que zero")
    return amount


def iso_date(value, field, *, required=True):
    if value is None or value == "":
        if required:
            raise BadRequest(f"O campo '{field}' é obrigatório (YYYY-MM-DD)")
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        raise BadRequest(f"{field} inválida (use YYYY-MM-DD)") from None


def color(value, default):
    if value is None or value == "":
        return default
    if not isinstance(value, str) or not _COLOR.fullmatch(value):
        raise BadRequest("Cor inválida (use #RRGGBB)")
    return value
