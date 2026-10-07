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
