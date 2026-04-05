from fastapi import APIRouter, File, Request, UploadFile
from app.core.config import settings
from app.core.rate_limit import RateLimitRule, rate_limiter
from app.services.file_service import save_uploaded_file
from app.services.clothing_analysis_service import ClothingAnalysisService
from app.services.duplicate_detection_service import DuplicateDetectionService
from app.schemas.upload import (
    ClothingUploadResponse,
    UploadedClothingItemSchema,
    CheckDuplicatesRequest,
    CheckDuplicatesResponse,
    DuplicateResultItem,
)
import uuid

router = APIRouter()

# Initialize services once
analysis_service = ClothingAnalysisService()
duplicate_service = DuplicateDetectionService()
upload_rate_limit_rule = RateLimitRule(
    name="wardrobe-upload",
    requests=settings.openai_upload_rate_limit,
    window_seconds=settings.openai_rate_limit_window_seconds,
)


@router.post("/upload-clothing", response_model=ClothingUploadResponse)
async def upload_clothing(request: Request, files: list[UploadFile] = File(...)):
    rate_limiter.enforce(request, upload_rate_limit_rule)
    """
    Upload multiple clothing images and get AI analysis for each.
    Duplicate detection is handled separately via /check-duplicates.
    """
    if not files:
        return ClothingUploadResponse(
            success=False,
            items=[],
            message="No files provided.",
        )

    uploaded_items = []

    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            continue

        try:
            content = await file.read()
            file_path = save_uploaded_file(content, file.filename or "image.jpg")

            analysis, analysis_source = analysis_service.analyze_clothing_with_source(file_path)
            status, review_reason, review_issue = analysis_service.get_review_state(analysis, analysis_source)

            reject_reason = review_issue if status == "rejected" else None

            item = UploadedClothingItemSchema(
                id=str(uuid.uuid4()),
                file_path=file_path,
                analysis_source=analysis_source,
                status=status,
                review_reason=review_reason,
                review_issue=review_issue,
                reject_reason=reject_reason,
                category=analysis.category,
                color=analysis.color,
                style=analysis.style,
                warmth_level=analysis.warmth_level,
                weather_suitability=analysis.weather_suitability,
                gender=analysis.gender,
                notes=analysis.notes,
            )
            uploaded_items.append(item)
        except Exception as e:
            print(f"Error processing file {file.filename}: {str(e)}")
            continue

    return ClothingUploadResponse(
        success=len(uploaded_items) > 0,
        items=uploaded_items,
        message=f"Successfully processed {len(uploaded_items)} clothing item(s).",
    )


@router.post("/check-duplicates", response_model=CheckDuplicatesResponse)
async def check_duplicates(request: CheckDuplicatesRequest):
    """
    Check for exact and visually similar duplicates across a list of clothing items.
    Called after upload so items appear immediately and duplicate badges load separately.
    """
    if not request.items:
        return CheckDuplicatesResponse(success=True, results=[])

    file_paths = [item.file_path for item in request.items]
    duplicates_info = duplicate_service.check_duplicates_in_batch(file_paths)

    results = [
        DuplicateResultItem(
            id=request.items[idx].id,
            is_exact_duplicate=dup.get("is_exact_duplicate", False),
            is_similar_duplicate=dup.get("is_similar_duplicate", False),
        )
        for idx, dup in duplicates_info.items()
    ]

    return CheckDuplicatesResponse(success=True, results=results)
