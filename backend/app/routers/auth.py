"""Auth router — login endpoint."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.auth_service import authenticate_user, create_access_token

router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    username = authenticate_user(request.username, request.password)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token(username)
    return LoginResponse(access_token=token)
