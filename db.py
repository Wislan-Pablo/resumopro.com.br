import os
import time
from typing import List, Optional, Dict, Any

from sqlalchemy import Column, Integer, String, Text, BigInteger, DateTime, JSON, Boolean, ForeignKey, select, delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship


class Base(DeclarativeBase):
    pass


class EditorState(Base):
    __tablename__ = "editor_states"

    id = Column(Integer, primary_key=True)
    slug = Column(String(128), unique=True, nullable=False, index=True)
    name = Column(String(256), nullable=False)
    saved_at = Column(BigInteger, nullable=True)
    pdf_name = Column(String(256), nullable=True)
    html = Column(Text, nullable=False)
    images_copied = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# --- Auth Models ---
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(256), unique=True, nullable=False, index=True)
    name = Column(String(256), nullable=True)
    password_hash = Column(String(512), nullable=True)
    is_active = Column(Boolean, nullable=False, server_default="true")
    role = Column(String(64), nullable=True)  # e.g., 'user', 'admin' (restrições serão modeladas depois)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)

    oauth_accounts = relationship("OAuthAccount", back_populates="user")
    refresh_tokens = relationship("RefreshToken", back_populates="user")


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id = Column(Integer, primary_key=True)
    provider = Column(String(64), nullable=False)  # 'google'
    subject = Column(String(256), nullable=False)  # provider unique id (sub)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="oauth_accounts")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(512), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="refresh_tokens")


def _build_db_url() -> str:
    host = os.getenv("DB_HOST", "10.54.192.3")
    user = os.getenv("DB_USER", "wislanpablo")
    password = os.getenv("DB_PASSWORD", "")
    name = os.getenv("DB_NAME", "resumopro-db")
    # Usar driver psycopg (psycopg3) com SQLAlchemy assíncrono
    return f"postgresql+psycopg://{user}:{password}@{host}:5432/{name}"


_engine = create_async_engine(
    _build_db_url(),
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = async_sessionmaker(_engine, expire_on_commit=False)


async def init_db() -> None:
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def upsert_editor_state(
    session: AsyncSession,
    slug: str,
    name: str,
    html: str,
    pdf_name: Optional[str],
    images_copied: Optional[List[str]] = None,
) -> Dict[str, Any]:
    now_ms = int(time.time() * 1000)
    result = await session.execute(select(EditorState).where(EditorState.slug == slug))
    entity = result.scalar_one_or_none()
    if entity:
        entity.name = name
        entity.html = html
        entity.pdf_name = pdf_name
        entity.images_copied = images_copied or []
        entity.saved_at = now_ms
    else:
        entity = EditorState(
            slug=slug,
            name=name,
            html=html,
            pdf_name=pdf_name,
            images_copied=images_copied or [],
            saved_at=now_ms,
        )
        session.add(entity)
    await session.commit()
    await session.refresh(entity)
    return {
        "slug": entity.slug,
        "name": entity.name,
        "saved_at": entity.saved_at,
        "pdf_name": entity.pdf_name,
        "images_copied": entity.images_copied or [],
    }


async def list_editor_states(session: AsyncSession) -> List[Dict[str, Any]]:
    result = await session.execute(select(EditorState).order_by(EditorState.saved_at.desc().nullslast()))
    items = []
    for e in result.scalars():
        items.append({
            "slug": e.slug,
            "name": e.name,
            "saved_at": e.saved_at,
            "pdf_name": e.pdf_name,
            "has_html": bool(e.html),
        })
    return items


async def get_editor_state(session: AsyncSession, slug: str) -> Optional[Dict[str, Any]]:
    result = await session.execute(select(EditorState).where(EditorState.slug == slug))
    e = result.scalar_one_or_none()
    if not e:
        return None
    return {
        "meta": {
            "slug": e.slug,
            "name": e.name,
            "saved_at": e.saved_at,
            "pdf_name": e.pdf_name,
            "images_copied": e.images_copied or [],
        },
        "html": e.html or "",
    }


async def delete_editor_state(session: AsyncSession, slug: str) -> bool:
    result = await session.execute(select(EditorState).where(EditorState.slug == slug))
    e = result.scalar_one_or_none()
    if not e:
        return False
    await session.execute(delete(EditorState).where(EditorState.id == e.id))
    await session.commit()
    return True