from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base, SessionLocal, migrate_db
from app.seed import seed_database
from app.api import auth, quotes, rates, dashboard, settings as company_settings_router, admin as admin_router

# Ensure tables exist and seed default data
Base.metadata.create_all(bind=engine)
migrate_db(engine)
try:
    db = SessionLocal()
    seed_database(db)
    db.close()
except Exception as e:
    print("Database initialization check:", e)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Damper Quote Pro API - Industrial Dampers Costing and Quotation Engine",
    version="1.0.0"
)

# Parse allowed origins from settings
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers for /api/v1
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(quotes.router, prefix=settings.API_V1_STR)
app.include_router(rates.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(company_settings_router.router, prefix=settings.API_V1_STR)
app.include_router(admin_router.router, prefix=settings.API_V1_STR)

# Also mount under /api for frontend backward compatibility
app.include_router(auth.router, prefix="/api")
app.include_router(quotes.router, prefix="/api")
app.include_router(rates.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(company_settings_router.router, prefix="/api")
app.include_router(admin_router.router, prefix="/api")

@app.get("/")
def root():
    return {
        "app": "Damper Quote Pro",
        "status": "online",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR
    }

@app.get("/api/health")
@app.get("/health")
def health():
    return {"status": "healthy"}
