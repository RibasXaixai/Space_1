import random
import re
import difflib
from app.schemas.phase2 import ClothingAnalysisSchema
from app.services.openai_service import OpenAIService


class ClothingAnalysisService:
    """Service for analyzing clothing items using OpenAI Vision API."""
    
    # Fallback values for missing fields
    FALLBACK_CATEGORIES = ["T-Shirt", "Jeans", "Jacket", "Sweater", "Dress", "Shirt", "Pants", "Shorts", "Skirt", "Hoodie"]
    FALLBACK_COLORS = ["Blue", "Black", "White", "Red", "Green", "Gray", "Navy", "Beige", "Brown", "Pink"]
    FALLBACK_STYLES = ["Casual", "Formal", "Smart Casual", "Athletic", "Vintage", "Modern", "Streetwear", "Classic"]
    FALLBACK_WARMTH_LEVELS = ["Light", "Medium", "Heavy"]
    FALLBACK_WEATHER_SUITABILITY = ["Spring/Summer", "Fall/Winter", "All-Weather", "VariableSeason", "Indoor"]
    
    def __init__(self):
        try:
            self.openai_service = OpenAIService()
            self.use_ai = True
        except (ValueError, ImportError) as e:
            print(f"Warning: OpenAI service initialization failed: {str(e)}. Falling back to mock analysis.")
            self.use_ai = False
    
    def analyze_clothing(self, file_path: str) -> ClothingAnalysisSchema:
        """
        Analyze a clothing item from an uploaded image using OpenAI.
        
        Falls back to mock analysis if OpenAI is unavailable.
        
        Args:
            file_path: Path to the uploaded clothing image
            
        Returns:
            ClothingAnalysisSchema with detected clothing properties
        """
        if self.use_ai:
            analysis = self.openai_service.analyze_clothing_image(file_path)
            if analysis:
                return self._validate_and_normalize_analysis(analysis)
        
        # Fallback to mock analysis
        return self._generate_mock_analysis()

    def analyze_clothing_with_source(self, file_path: str) -> tuple[ClothingAnalysisSchema, str]:
        """
        Analyze clothing and return both normalized result and source marker.

        Returns:
            tuple[ClothingAnalysisSchema, str]: (analysis, "ai" | "fallback")
        """
        if self.use_ai:
            analysis = self.openai_service.analyze_clothing_image(file_path)
            if analysis:
                return self._validate_and_normalize_analysis(analysis), "ai"

        return self._generate_mock_analysis(), "fallback"
    
    def _validate_and_normalize_analysis(self, analysis: dict) -> ClothingAnalysisSchema:
        """
        Validate and normalize the OpenAI response.
        
        Ensures all required fields are present and have valid values.
        Uses fallback values for missing or invalid fields.
        """
        # Extract and validate each field with fallbacks
        category = self._validate_field(
            analysis.get("category"),
            self.FALLBACK_CATEGORIES,
            "category"
        )
        
        color = self._validate_field(
            analysis.get("color"),
            self.FALLBACK_COLORS,
            "color"
        )
        
        style = self._validate_field(
            analysis.get("style"),
            self.FALLBACK_STYLES,
            "style"
        )
        
        warmth_level = self._validate_field(
            analysis.get("warmth_level"),
            self.FALLBACK_WARMTH_LEVELS,
            "warmth_level"
        )
        
        weather_suitability = self._validate_field(
            analysis.get("weather_suitability"),
            self.FALLBACK_WEATHER_SUITABILITY,
            "weather_suitability"
        )
        
        notes = analysis.get("notes", "")
        if not isinstance(notes, str) or not notes.strip():
            notes = f"A {style.lower()} {category.lower()} in {color.lower()}."
        
        return ClothingAnalysisSchema(
            category=category,
            color=color,
            style=style,
            warmth_level=warmth_level,
            weather_suitability=weather_suitability,
            notes=notes.strip(),
        )
    
    def _validate_field(self, value: any, valid_options: list, field_name: str) -> str:
        """
        Validate and normalize a field value against valid options.

        Uses deterministic fuzzy matching first, then safe fallback.
        """
        if not isinstance(value, str) or not value.strip():
            return valid_options[0]

        raw = value.strip()

        # Exact match
        if raw in valid_options:
            return raw

        # Case-insensitive exact match
        lower_to_option = {opt.lower(): opt for opt in valid_options}
        raw_lower = raw.lower()
        if raw_lower in lower_to_option:
            return lower_to_option[raw_lower]

        # Field-specific aliases for common model outputs
        aliases = {
            "weather_suitability": {
                "spring": "Spring/Summer",
                "summer": "Spring/Summer",
                "fall": "Fall/Winter",
                "autumn": "Fall/Winter",
                "winter": "Fall/Winter",
                "all weather": "All-Weather",
                "all-weather": "All-Weather",
                "variable season": "VariableSeason",
                "variable": "VariableSeason",
            },
            "warmth_level": {
                "lightweight": "Light",
                "thin": "Light",
                "mid": "Medium",
                "moderate": "Medium",
                "thick": "Heavy",
                "warm": "Heavy",
            },
            "style": {
                "sport": "Athletic",
                "sporty": "Athletic",
                "smart-casual": "Smart Casual",
                "smart casual": "Smart Casual",
            },
            "color": {
                "dark blue": "Navy",
                "navy blue": "Navy",
                "light gray": "Gray",
                "dark gray": "Gray",
            },
        }

        if field_name in aliases:
            for alias, mapped in aliases[field_name].items():
                if alias in raw_lower:
                    return mapped

        # Substring match against valid options
        for opt in valid_options:
            if opt.lower() in raw_lower or raw_lower in opt.lower():
                return opt

        # Fuzzy nearest option to avoid random mismatches
        nearest = difflib.get_close_matches(raw, valid_options, n=1, cutoff=0.72)
        if nearest:
            return nearest[0]

        # Preserve meaningful free-text for category/color instead of randomizing.
        if field_name in {"category", "color"}:
            normalized = re.sub(r"\s+", " ", raw).strip()
            return normalized[:40]

        # Final deterministic fallback
        return valid_options[0]
    
    def _generate_mock_analysis(self) -> ClothingAnalysisSchema:
        """Generate mock analysis as fallback when OpenAI is unavailable."""
        category = random.choice(self.FALLBACK_CATEGORIES)
        color = random.choice(self.FALLBACK_COLORS)
        style = random.choice(self.FALLBACK_STYLES)
        warmth = random.choice(self.FALLBACK_WARMTH_LEVELS)
        weather = random.choice(self.FALLBACK_WEATHER_SUITABILITY)
        
        notes = f"A {style.lower()} {category.lower()} in {color.lower()} - great for {weather.lower()} wear."
        
        return ClothingAnalysisSchema(
            category=category,
            color=color,
            style=style,
            warmth_level=warmth,
            weather_suitability=weather,
            notes=notes,
        )
