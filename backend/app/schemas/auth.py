"""Auth-related Pydantic schemas."""
from pydantic import BaseModel, EmailStr, Field


class LoginIn(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=256)


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class FirstRunIn(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(..., min_length=8, max_length=256)
    email: EmailStr | None = None


class MeOut(BaseModel):
    id: int
    username: str
    email: str | None
    role: str
    is_active: bool


class SetupStatus(BaseModel):
    initialised: bool
