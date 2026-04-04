from pydantic import BaseModel, Field, field_validator

from app.utils.input_validation import sanitize_email


class UserRegister(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return sanitize_email(value)


class UserLogin(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return sanitize_email(value)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
