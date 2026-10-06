from flask import Flask

from app.config import Config
from app.extensions import db, migrate


def create_app(config_overrides=None):
    """`config_overrides` existe para os testes rodarem contra um banco próprio."""
    app = Flask(__name__)
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)

    db.init_app(app)
    migrate.init_app(app, db)

    from app import models  # noqa: F401 - garante que os models sejam registrados

    from app.routes.accounts import accounts_bp
    from app.routes.budgets import budgets_bp
    from app.routes.categories import categories_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.expectations import expectations_bp
    from app.routes.export import export_bp
    from app.routes.goals import goals_bp
    from app.routes.loans import loans_bp
    from app.routes.playlists import playlists_bp
    from app.routes.recurring import recurring_bp
    from app.routes.shopping_items import shopping_items_bp
    from app.routes.snapshots import snapshots_bp
    from app.routes.transactions import transactions_bp

    app.register_blueprint(accounts_bp, url_prefix="/api/accounts")
    app.register_blueprint(categories_bp, url_prefix="/api/categories")
    app.register_blueprint(transactions_bp, url_prefix="/api/transactions")
    app.register_blueprint(budgets_bp, url_prefix="/api/budgets")
    app.register_blueprint(recurring_bp, url_prefix="/api/recurring")
    app.register_blueprint(playlists_bp, url_prefix="/api/playlists")
    app.register_blueprint(expectations_bp, url_prefix="/api/expectations")
    app.register_blueprint(shopping_items_bp, url_prefix="/api/shopping-items")
    app.register_blueprint(snapshots_bp, url_prefix="/api/snapshots")
    app.register_blueprint(loans_bp, url_prefix="/api/loans")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    app.register_blueprint(export_bp, url_prefix="/api/export")
    app.register_blueprint(goals_bp, url_prefix="/api/goals")

    @app.get("/api/rates")
    def rates():
        from app.services.rates import get_rates

        return {
            code: {"rate": float(r["rate"]), "updated_at": r["updated_at"]}
            for code, r in get_rates().items()
        }

    return app
