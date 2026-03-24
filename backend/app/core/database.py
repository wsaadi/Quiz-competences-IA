import logging

from sqlalchemy import event, inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger(__name__)

# Build engine with appropriate pooling config
_engine_kwargs: dict = {"echo": settings.DEBUG}

if settings.DATABASE_URL.startswith("postgresql"):
    # PostgreSQL: configure connection pool for concurrent users
    _engine_kwargs.update({
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_pre_ping": True,  # Verify connections are alive before use
        "pool_recycle": 300,  # Recycle connections after 5 min
    })

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

# SQLite: enable WAL mode + busy timeout for concurrent access
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def _add_missing_columns(conn):
    """Add any columns defined in models but missing from existing tables."""
    inspector = inspect(conn)
    for table_name, table in Base.metadata.tables.items():
        if not inspector.has_table(table_name):
            continue
        existing = {col["name"] for col in inspector.get_columns(table_name)}
        for column in table.columns:
            if column.name not in existing:
                col_type = column.type.compile(conn.dialect)
                conn.execute(
                    text(f"ALTER TABLE {table_name} ADD COLUMN {column.name} {col_type}")
                )
                logger.info("Added column %s.%s (%s)", table_name, column.name, col_type)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)
