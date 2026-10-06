from decimal import InvalidOperation

from flask import Flask, request
from sqlalchemy.exc import DataError, IntegrityError
from werkzeug.exceptions import HTTPException

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
    from app.routes.sheets import sheets_bp
    from app.routes.loans import loans_bp
    from app.routes.market import market_bp
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
    app.register_blueprint(sheets_bp, url_prefix="/api/sheets")
    app.register_blueprint(market_bp, url_prefix="/api/market")

    @app.before_request
    def require_json():
        # Navegador não manda JSON de outro site sem pedir permissão (CORS), e
        # aqui ninguém dá permissão: escrita só vem da própria tela.
        if request.method in ("POST", "PUT", "PATCH") and not request.is_json:
            return {"error": "Envie os dados como JSON"}, 415
        return None

    @app.after_request
    def security_headers(response):
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.errorhandler(HTTPException)
    def http_error(error):
        return {"error": error.description}, error.code

    @app.errorhandler(DataError)
    @app.errorhandler(ValueError)
    @app.errorhandler(InvalidOperation)
    def invalid_data(_error):
        db.session.rollback()
        return {"error": "Algum valor enviado é inválido ou grande demais"}, 400

    @app.errorhandler(IntegrityError)
    def in_use(_error):
        db.session.rollback()
        return {"error": "Não deu para salvar: o registro está ligado a outros dados"}, 409

    @app.errorhandler(500)
    def internal_error(_error):
        return {"error": "Erro interno — veja o log do backend"}, 500

    @app.get("/api/rates")
    def rates():
        from app.services.rates import get_rates

        return {
            code: {"rate": float(r["rate"]), "updated_at": r["updated_at"]}
            for code, r in get_rates().items()
        }

    return app
