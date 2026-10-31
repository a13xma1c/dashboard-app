from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from app.routers import auth, analytics

app = FastAPI(title="GA Dashboard API", version="1.0.0")

# Middleware is applied in LIFO order by Starlette.
# CORS must be the outermost layer so preflight requests are handled before
# SessionMiddleware tries to read the cookie (which would fail on OPTIONS).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ["SESSION_SECRET"],
    same_site="lax",
    https_only=False,
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
