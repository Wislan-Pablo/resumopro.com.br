import os
from typing import Optional

from sqlmodel import SQLModel, create_engine
from dotenv import load_dotenv


_engine = None


def _ensure_sqlite_dir(database_url: str) -> None:
    if database_url.startswith("sqlite"):
        # Extract file path after last '/'
        path = database_url.split("///")[-1]
        directory = os.path.dirname(path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)


def init_engine() -> None:
    """Initialize a global SQLAlchemy engine using DATABASE_URL or SQLite fallback."""
    global _engine
    if _engine is not None:
        return

    load_dotenv()
    database_url = os.getenv("DATABASE_URL", "sqlite:///data/app.db")
    _ensure_sqlite_dir(database_url)

    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    _engine = create_engine(database_url, echo=False, connect_args=connect_args)


def get_engine():
    if _engine is None:
        init_engine()
    return _engine


def create_db_and_tables() -> None:
    engine = get_engine()
    SQLModel.metadata.create_all(engine)