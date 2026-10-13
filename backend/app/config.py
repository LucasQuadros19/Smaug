import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    FRONTEND_DIST = os.getenv("FRONTEND_DIST")
    SECRET_KEY = os.getenv("SECRET_KEY")
    SESSION_COOKIE_SAMESITE = "Lax"
    # Liga com HTTPS: o navegador só manda o cookie de login por conexão segura.
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE") == "1"
    PERMANENT_SESSION_LIFETIME = timedelta(days=30)
    # Bot (repositório bot-trader): onde a API dele está, o token que ela exige e
    # os usuários (separados por vírgula) que podem usar a tela do bot.
    BOT_API_URL = os.getenv("BOT_API_URL", "http://127.0.0.1:8000")
    BOT_API_TOKEN = os.getenv("BOT_API_TOKEN")
    BOT_USERS = os.getenv("BOT_USERS", "")
