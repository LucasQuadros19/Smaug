from datetime import date, datetime

from flask import Blueprint, jsonify, request

from app.services.dashboard_service import get_summary

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/summary")
def summary():
    month_param = request.args.get("month")
    if month_param:
        dt = datetime.strptime(month_param, "%Y-%m")
        month = date(dt.year, dt.month, 1)
    else:
        month = date.today().replace(day=1)

    granularity = request.args.get("granularity", "monthly")
    if granularity not in ("monthly", "weekly"):
        return jsonify({"error": "granularity deve ser 'monthly' ou 'weekly'"}), 400

    compact = request.args.get("compact") in ("1", "true")

    return jsonify(get_summary(month, granularity, compact=compact))
