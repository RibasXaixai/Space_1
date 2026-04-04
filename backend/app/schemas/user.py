from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.utils.input_validation import sanitize_email, sanitize_optional_location


class UserBase(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    location: str | None = Field(default=None, max_length=120)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return sanitize_email(value)

    @field_validator("location")
    @classmethod
    def validate_location(cls, value: str | None) -> str | None:
        return sanitize_optional_location(value)


class UserOut(UserBase):
    id: int
    created_at: datetime

    model_config = {
        "from_attributes": True
    }
