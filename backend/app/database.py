from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def migrate_db(eng):
    """Ensures newly added columns exist in SQLite database without losing data."""
    try:
        with eng.connect() as conn:
            def add_column_if_missing(table, col, col_type):
                try:
                    res = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
                    col_names = [r[1] for r in res]
                    if col_names and col not in col_names:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                        conn.commit()
                except Exception:
                    pass

            add_column_if_missing("rates_versions", "multi_blade_rates", "JSON")
            add_column_if_missing("quotes", "damper_type", "VARCHAR DEFAULT 'rack_and_pinion'")
            add_column_if_missing("quotes", "multi_blade_config", "JSON")
            add_column_if_missing("verified_sizes", "damper_type", "VARCHAR DEFAULT 'rack_and_pinion'")
            add_column_if_missing("validation_rules", "damper_type", "VARCHAR DEFAULT 'all'")
    except Exception:
        pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

