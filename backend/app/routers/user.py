from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.services.user_service import update_user_location

router = APIRouter()


class LocationUpdate(BaseModel):
    location: str


class LocationOut(BaseModel):
    location: str | None = None


@router.put("/location", response_model=LocationOut)
def update_location(
    payload: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = update_user_location(db, current_user, payload.location)
    return {"location": updated.location}


@router.get("/location", response_model=LocationOut)
def get_location(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {"location": current_user.location}
