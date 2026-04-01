from fastapi import APIRouter, UploadFile, File
from app.services.file_service import save_uploaded_file
from app.services.clothing_analysis_service import ClothingAnalysisService
from app.schemas.upload import ClothingUploadResponse, UploadedClothingItemSchema
import uuid

router = APIRouter()

# Initialize analysis service once
analysis_service = ClothingAnalysisService()


@router.post("/upload-clothing", response_model=ClothingUploadResponse)
async def upload_clothing(files: list[UploadFile] = File(...)):
    """
    Upload multiple clothing images and get analysis for each using OpenAI Vision API.
    
    Falls back to mock analysis if OpenAI is unavailable.
    
    Returns:
        ClothingUploadResponse with analyzed clothing items
    """
    if not files:
        return ClothingUploadResponse(
            success=False,
            items=[],
            message="No files provided.",
        )

    uploaded_items = []

    for file in files:
        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            continue

        try:
            # Read file content
            content = await file.read()

            # Save file locally
            file_path = save_uploaded_file(content, file.filename or "image.jpg")

            # Analyze clothing using OpenAI (or mock fallback)
            analysis, analysis_source = analysis_service.analyze_clothing_with_source(file_path)

            # Create response item
            item = UploadedClothingItemSchema(
                id=str(uuid.uuid4()),
                file_path=file_path,
                analysis_source=analysis_source,
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
            # Log error but continue processing other files
            print(f"Error processing file {file.filename}: {str(e)}")
            continue

    return ClothingUploadResponse(
        success=len(uploaded_items) > 0,
        items=uploaded_items,
        message=f"Successfully processed {len(uploaded_items)} clothing item(s).",
    )
