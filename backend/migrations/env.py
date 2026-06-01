import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context
from dotenv import load_dotenv

# Thêm backend/ vào sys.path để import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

# Import tất cả models để Alembic nhận diện schema
from app.database import Base
from app.models import (  # noqa: F401
    user, shop, product, order, cart,
    payment, shipment, notification, voucher, dispute, logs
)

# Alembic Config object
config = context.config

# Đọc DATABASE_URL từ biến môi trường (dùng DIRECT_URL nếu có, fallback DATABASE_URL)
database_url = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
if not database_url:
    from app.config import settings
    database_url = settings.DATABASE_URL

# Nếu URL dùng pgbouncer (pooler) thì chuyển sang direct connection cho migrations
if "pgbouncer=true" in (database_url or ""):
    database_url = os.getenv("DIRECT_URL", database_url)

# Override URL trong alembic config
config.set_main_option("sqlalchemy.url", database_url)

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata cho autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Chạy migrations ở offline mode (không cần kết nối DB)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Chạy migrations ở online mode (kết nối trực tiếp DB)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # NullPool phù hợp cho migrations
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
