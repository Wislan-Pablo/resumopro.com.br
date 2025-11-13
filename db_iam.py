import os
from typing import Optional, Dict, Any
from google.cloud.sql.connector import Connector
import asyncio

# Não manter Connector global para evitar conflito de loops de eventos.
# Crie um novo Connector por chamada (ou por request) usando context manager.

def _get_db_env() -> Dict[str, str]:
    return {
        "instance": os.getenv("INSTANCE_CONNECTION_NAME", "").strip(),
        "user": os.getenv("DB_USER", "").strip(),
        "db": os.getenv("DB_NAME", "").strip(),
        "password": os.getenv("DB_PASSWORD", "").strip(),
    }

async def connect_asyncpg():
    env = _get_db_env()
    if not env["instance"] or not env["user"] or not env["db"]:
        raise RuntimeError("INSTANCE_CONNECTION_NAME, DB_USER, DB_NAME devem estar definidos no ambiente")
    # Usar autenticação por senha inicialmente para simplificar; IAM pode ser habilitado depois
    kwargs = {
        "user": env["user"],
        "db": env["db"],
    }
    if env["password"]:
        kwargs["password"] = env["password"]
    async with Connector() as connector:
        conn = await connector.connect_async(env["instance"], driver="asyncpg", **kwargs)
        return conn

async def iam_fetch_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = await connect_asyncpg()
    try:
        row = await conn.fetchrow("SELECT id, email, name, password_hash, is_active, role, last_login FROM users WHERE email=$1", email)
        if not row:
            return None
        return dict(row)
    finally:
        await conn.close()

async def iam_create_user(email: str, name: str, password_hash: Optional[str]) -> Dict[str, Any]:
    conn = await connect_asyncpg()
    try:
        row = await conn.fetchrow(
            "INSERT INTO users (email, name, password_hash, is_active) VALUES ($1, $2, $3, true) RETURNING id, email, name",
            email, name, password_hash
        )
        return dict(row)
    finally:
        await conn.close()

async def iam_update_last_login(user_id: int) -> None:
    conn = await connect_asyncpg()
    try:
        await conn.execute("UPDATE users SET last_login = NOW() WHERE id=$1", user_id)
    finally:
        await conn.close()

async def iam_insert_refresh_token(user_id: int, token_hash: str, expires_at_iso: str) -> None:
    conn = await connect_asyncpg()
    try:
        await conn.execute(
            "INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked) VALUES ($1, $2, $3::timestamptz, false)",
            user_id, token_hash, expires_at_iso
        )
    finally:
        await conn.close()

async def iam_find_valid_refresh_tokens() -> list:
    conn = await connect_asyncpg()
    try:
        rows = await conn.fetch("SELECT id, user_id, token_hash, expires_at, revoked FROM refresh_tokens WHERE revoked=false")
        return [dict(r) for r in rows]
    finally:
        await conn.close()