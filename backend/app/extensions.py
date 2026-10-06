from datetime import UTC, datetime

from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)
