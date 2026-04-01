from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.routers.auth import get_current_user
from app.schemas.clothing import ClothingItemCreate, ClothingItemOut, ClothingItemUpdate, ClothingAnalysisOut
from app.services.clothing_service import (
    create_clothing_item,
    delete_clothing_item,
    get_clothing_item,
    get_clothing_items,
    save_upload_file,
    update_clothing_item,
)
from app.services.image_analysis_service import analyze_clothing_image

router = APIRouter()


def _build_recommendation(analysis: dict[str, str]) -> str:
    category = analysis.get("category", "item").lower()
    style = analysis.get("style", "stylish")
    weather = analysis.get("weather_suitability", "any weather")

    if "top" in category:
        return f"Try pairing this {style} top with neutral bottoms for {weather}."
    if "bottom" in category:
        return f"Match these {style} bottoms with a clean top and comfortable shoes."
    if "outerwear" in category:
        return f"This {style} outerwear is perfect for {weather}. Layer it over a simple outfit."
    if "shoe" in category or "foot" in category:
        return f"These shoes will finish off a relaxed or dressed-up look nicely."
    if "dress" in category:
        return f"This {style} dress is a strong statement piece for {weather} days. Keep accessories light."
    return f"This {style} piece works well in {weather}. Keep the rest of your look simple."


@router.post("/upload-game", response_model=ClothingAnalysisOut, status_code=status.HTTP_201_CREATED)
def upload_game_clothing_item(
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Clothing image file is required.")

    image_url = save_upload_file(file)
    filename = Path(image_url).name
    saved_path = Path(__file__).resolve().parents[1] / "uploads" / filename
    analysis = analyze_clothing_image(saved_path)
    recommendation = _build_recommendation(analysis)

    return {
        "image_url": image_url,
        "category": analysis.get("category", "unknown"),
        "color": analysis.get("color", "unknown"),
        "style": analysis.get("style", "basic"),
        "warmth_level": analysis.get("warmth_level", "medium"),
        "weather_suitability": analysis.get("weather_suitability", "general"),
        "notes": analysis.get("notes", "No AI metadata available."),
        "recommendation": recommendation,
    }


@router.post("/upload", response_model=ClothingItemOut, status_code=status.HTTP_201_CREATED)
def upload_clothing_item(
    file: UploadFile = File(...),
    category: str | None = Form(None),
    color: str | None = Form(None),
    style: str | None = Form(None),
    warmth_level: str | None = Form(None),
    weather_suitability: str | None = Form(None),
    notes: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Clothing image file is required.")

    image_url = save_upload_file(file)
    filename = Path(image_url).name
    saved_path = Path(__file__).resolve().parents[1] / "uploads" / filename
    analysis = analyze_clothing_image(saved_path)

    payload = {
        "image_url": image_url,
        "category": category or analysis.get("category"),
        "color": color or analysis.get("color"),
        "style": style or analysis.get("style"),
        "warmth_level": warmth_level or analysis.get("warmth_level"),
        "weather_suitability": weather_suitability or analysis.get("weather_suitability"),
        "notes": notes or analysis.get("notes"),
    }

    item = create_clothing_item(db, current_user.id, payload)
    return item


@router.get("/", response_model=list[ClothingItemOut])
def list_clothing_items(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return get_clothing_items(db, current_user.id)


@router.put("/{item_id}", response_model=ClothingItemOut)
def update_clothing_item_route(
    item_id: int,
    item_in: ClothingItemUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = get_clothing_item(db, current_user.id, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found.")

    updates = item_in.model_dump(exclude_none=True)
    updated_item = update_clothing_item(db, item, updates)
    return updated_item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clothing_item_route(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = get_clothing_item(db, current_user.id, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found.")

    delete_clothing_item(db, item)
    return None
