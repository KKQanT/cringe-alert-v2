"""
Simple JWT auth for judge testing.
Hardcoded users — no database needed.
"""
import jwt
import hashlib
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends, Query, WebSocket, WebSocketException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings

ALGORITHM = "HS256"
TOKEN_EXPIRY_DAYS = 1

def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def _load_users() -> dict[str, str]:
    """Load users from AUTH_USERS env var. Format: 'user1:pass1,user2:pass2'"""
    raw = settings.AUTH_USERS
    if not raw:
        return {}
    users = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if ":" in pair:
            username, password = pair.split(":", 1)
            users[username.strip()] = _hash(password.strip())
    return users


USERS = _load_users()

security = HTTPBearer()


def authenticate_user(username: str, password: str) -> str | None:
    """Verify credentials. Returns username if valid, None otherwise."""
    expected = USERS.get(username)
    if expected and expected == _hash(password):
        return username
    return None


def create_access_token(username: str) -> str:
    """Create a JWT with 1-day expiry."""
    payload = {
        "sub": username,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRY_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def verify_token(token: str) -> str:
    """Verify JWT and return username. Raises on invalid/expired."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        username: str = payload.get("sub", "")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """FastAPI dependency — extracts and verifies Bearer token from header."""
    return verify_token(credentials.credentials)


async def ws_get_current_user(
    token: str = Query(..., alias="token"),
) -> str:
    """WebSocket dependency — extracts token from query param."""
    try:
        return verify_token(token)
    except HTTPException:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
