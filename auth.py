import os
import datetime
import secrets
from typing import Optional, Tuple

from passlib.hash import argon2
from jose import jwt

JWT_ALG = "HS256"

def get_auth_secret() -> str:
    secret = os.getenv("AUTH_SECRET")
    if not secret:
        # Generate ephemeral secret in dev; in prod use Secret Manager
        secret = os.getenv("EPHEMERAL_AUTH_SECRET") or secrets.token_urlsafe(32)
        os.environ["EPHEMERAL_AUTH_SECRET"] = secret
    return secret


def hash_password(password: str) -> str:
    return argon2.using(rounds=3).hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return argon2.verify(password, password_hash)
    except Exception:
        return False


def create_access_token(user_id: int, email: str, expires_minutes: int = 15) -> str:
    now = datetime.datetime.utcnow()
    exp = now + datetime.timedelta(minutes=expires_minutes)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    token = jwt.encode(payload, get_auth_secret(), algorithm=JWT_ALG)
    return token


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, get_auth_secret(), algorithms=[JWT_ALG])
    except Exception:
        return None


def generate_refresh_token() -> Tuple[str, str]:
    """Return (raw, hashed) refresh token."""
    raw = secrets.token_urlsafe(48)
    hashed = argon2.using(rounds=3).hash(raw)
    return raw, hashed


def verify_refresh_token(raw: str, hashed: str) -> bool:
    try:
        return argon2.verify(raw, hashed)
    except Exception:
        return False