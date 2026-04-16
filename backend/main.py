"""HookePak API — local dev on :8000; production uses same app behind a hosted URL."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health, structural

app = FastAPI(title="HookePak API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173", "app://."],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(structural.router, prefix="/api/structural", tags=["structural"])


@app.get("/")
def root():
    return {"service": "hookepak-api", "docs": "/docs"}
