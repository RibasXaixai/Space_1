from datetime import datetime

from pydantic import BaseModel


class UserBase(BaseModel):
    email: str
    location: str | None = None


class UserOut(UserBase):
    id: int
    created_at: datetime

    model_config = {
        "from_attributes": True
    }
