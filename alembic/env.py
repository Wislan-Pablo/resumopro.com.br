import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
import sqlalchemy as sa
from sqlmodel import SQLModel

# Importar engine e modelos para expor o metadata
from db.session import get_engine
from db import models  # noqa: F401 - garante que modelos são registrados no metadata

# Esta é a instância de Config do Alembic, que fornece acesso ao arquivo .ini.
config = context.config

# Interpretar o arquivo de configurações para logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata de destino para 'autogenerate'
target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    """
    Executa migrações em modo 'offline'.
    Configura o contexto com uma URL e não um Engine.
    """
    url = os.getenv("DATABASE_URL", "sqlite:///data/app.db")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Executa migrações em modo 'online'.
    Conecta ao Engine real e associa ao contexto.
    """
    engine = get_engine()
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()