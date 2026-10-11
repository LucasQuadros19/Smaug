from datetime import UTC, datetime

from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import String, event, inspect
from sqlalchemy.orm import Session
from werkzeug.exceptions import BadRequest

db = SQLAlchemy()
migrate = Migrate()


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


@event.listens_for(Session, "before_flush")
def _only_text_in_text_columns(session, _context, _instances):
    """Nota, ícone, descrição: o que veio do JSON precisa ser texto. Lista ou
    número numa coluna de texto viraria erro 500 no banco."""
    for obj in [*session.new, *session.dirty]:
        for attr in inspect(obj).mapper.column_attrs:
            value = getattr(obj, attr.key)
            if value is not None and isinstance(attr.columns[0].type, String) and not isinstance(value, str):
                raise BadRequest(f"{attr.key} inválido")
