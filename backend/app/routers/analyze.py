from fastapi import APIRouter
from app.schemas.phase2 import (
    AnalyzeClothesRequest,
    AnalyzeClothesResponse,
    ClothingAnalysisSchema,
)

router = APIRouter()


@router.post("/analyze-clothes", response_model=AnalyzeClothesResponse)
def analyze_clothes(request: AnalyzeClothesRequest):
    """
    Analyze uploaded clothing items and return their properties.
    
    Mock response for Phase 2 - in Phase 3+ this will call OpenAI Vision API.
    """
    # Mock analyses for each clothing item
    mock_analyses = [
        ClothingAnalysisSchema(
            category="T-Shirt",
            color="Blue",
            style="Casual",
            warmth_level="Light",
            weather_suitability="Spring/Summer",
            notes="Great for warm weather",
        ),
        ClothingAnalysisSchema(
            category="Jeans",
            color="Dark Blue",
            style="Casual",
            warmth_level="Medium",
            weather_suitability="Spring/Fall",
            notes="Versatile everyday wear",
        ),
        ClothingAnalysisSchema(
            category="Jacket",
            color="Black",
            style="Formal",
            warmth_level="Heavy",
            weather_suitability="Fall/Winter",
            notes="Professional layering piece",
        ),
    ]

    # Return analyses based on number of items (mock data)
    analyses = mock_analyses[: min(len(request.clothing_ids), len(mock_analyses))]

    return AnalyzeClothesResponse(
        success=True,
        analyses=analyses,
        message=f"Successfully analyzed {len(analyses)} clothing items.",
    )
