import random
import re
import difflib
from app.schemas.phase2 import ClothingAnalysisSchema
from app.services.openai_service import OpenAIService


class ClothingAnalysisService:
    """Service for analyzing clothing items using OpenAI Vision API."""
    
    # Fallback values for missing fields
    FALLBACK_CATEGORIES = [
        "T-Shirt",
        "Jeans",
        "Jacket",
        "Sweater",
        "Dress",
        "Shirt",
        "Pants",
        "Shorts",
        "Skirt",
        "Hoodie",
        "Shoes",
        "Boots",
        "Sneakers",
    ]
    FALLBACK_COLORS = ["Blue", "Black", "White", "Red", "Green", "Gray", "Navy", "Beige", "Brown", "Pink"]
    FALLBACK_STYLES = ["Casual", "Formal", "Smart Casual", "Athletic", "Vintage", "Modern", "Streetwear", "Classic"]
    FALLBACK_WARMTH_LEVELS = ["Light", "Medium", "Heavy"]
    FALLBACK_WEATHER_SUITABILITY = ["Spring/Summer", "Fall/Winter", "All-Weather", "VariableSeason", "Indoor"]
    FALLBACK_GENDERS = ["Unisex", "Male", "Female"]
    NON_CLOTHING_HINTS = {
        "mug", "cup", "glass", "bottle", "plate", "book", "phone", "laptop", "keyboard",
        "mouse", "table", "chair", "sofa", "plant", "toy", "pet", "dog", "cat", "food",
        "foot", "feet", "hand", "face", "person", "body part", "skin", "finger", "nail",
    }
    LOW_CONFIDENCE_HINTS = {
        "unclear", "blurry", "too dark", "low light", "cannot determine", "not visible",
        "hard to identify", "partial", "cropped", "multiple items",
    }
    # Keywords that indicate the item is clearly not a clothing item at all
    REJECTED_CATEGORY_HINTS = {
        "foot", "feet", "hand", "face", "person", "body part", "skin", "mug",
        "cup", "bottle", "food", "plant", "pet", "dog", "cat",
    }
    NA_CATEGORY_HINTS = {"n/a", "na", "none", "unknown", "not available", "not_applicable"}
    
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

    def get_review_state(self, analysis: ClothingAnalysisSchema, analysis_source: str) -> tuple[str, str | None, str | None]:
        """
        Classify an analyzed item as 'analyzed', 'needs_review', or 'rejected'.

        rejected   — clearly not a clothing item or completely unanalyzable
        needs_review — clothing may be present but confidence is too low
        analyzed   — confident clothing item with usable metadata

        Returns:
            tuple(status, review_reason, review_issue)
        """
        category = (analysis.category or "").strip().lower()
        notes = (analysis.notes or "").strip().lower()
        confidence = analysis.confidence_score

        # Fallback analysis is always low confidence
        if analysis_source == "fallback":
            return (
                "needs_review",
                "We could not confidently analyze this image.",
                "The photo may be unclear, incomplete, or may not show a full clothing item.",
            )

        # Clearly non-clothing category → rejected
        if any(token in category for token in self.REJECTED_CATEGORY_HINTS):
            return (
                "rejected",
                "Not a clothing item.",
                f"The image appears to contain '{analysis.category}' rather than a wearable clothing item.",
            )

        # Confidence below threshold → needs_review
        if confidence < 95.0:
            return (
                "needs_review",
                f"Confidence too low ({confidence:.0f}%, need 95%+).",
                "The AI analyzer was not confident enough. Please review and confirm the category.",
            )

        # N/A or unknown category → needs_review
        if category in self.NA_CATEGORY_HINTS:
            return (
                "needs_review",
                "We could not confidently identify the category for this image.",
                "Category output was N/A or unknown and needs manual review.",
            )

        # Other non-clothing hints in category → needs_review (borderline)
        if any(token in category for token in self.NON_CLOTHING_HINTS):
            return (
                "needs_review",
                "This image may not contain a clothing item.",
                "Detected object appears non-clothing. Please review before use.",
            )

        # Low-confidence language in notes → needs_review
        if any(token in notes for token in self.LOW_CONFIDENCE_HINTS):
            return (
                "needs_review",
                "We could not confidently analyze this image.",
                "The photo may be unclear, incomplete, or may not show a full clothing item.",
            )

        return ("analyzed", None, None)
    
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

        gender = self._validate_field(
            analysis.get("gender"),
            self.FALLBACK_GENDERS,
            "gender"
        )
        
        notes = analysis.get("notes", "")
        if not isinstance(notes, str) or not notes.strip():
            notes = f"A {style.lower()} {category.lower()} in {color.lower()}."
        
        # Extract confidence score (default to 100 for normalized results from AI)
        confidence_score = analysis.get("confidence_score", 100.0)
        try:
            confidence_score = float(confidence_score)
        except (ValueError, TypeError):
            confidence_score = 100.0
        
        return ClothingAnalysisSchema(
            category=category,
            color=color,
            style=style,
            warmth_level=warmth_level,
            weather_suitability=weather_suitability,
            gender=gender,
            notes=notes.strip(),
            confidence_score=confidence_score,
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
            "category": {
                "work boot": "Boots",
                "work boots": "Boots",
                "boot": "Boots",
                "boots": "Boots",
                "sneaker": "Sneakers",
                "sneakers": "Sneakers",
                "trainer": "Sneakers",
                "trainers": "Sneakers",
                "running shoe": "Sneakers",
                "running shoes": "Sneakers",
                "tennis shoe": "Sneakers",
                "tennis shoes": "Sneakers",
                "sandal": "Shoes",
                "sandals": "Shoes",
                "heel": "Shoes",
                "heels": "Shoes",
                "oxford": "Shoes",
                "loafer": "Shoes",
                "loafers": "Shoes",
                "shoe": "Shoes",
                "shoes": "Shoes",
            },
            "color": {
                "dark blue": "Navy",
                "navy blue": "Navy",
                "light gray": "Gray",
                "dark gray": "Gray",
            },
            "gender": {
                "man": "Male",
                "male": "Male",
                "mens": "Male",
                "boy": "Male",
                "woman": "Female",
                "female": "Female",
                "womens": "Female",
                "girl": "Female",
                "unisex": "Unisex",
                "neutral": "Unisex",
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
            gender=random.choice(self.FALLBACK_GENDERS),
            notes=notes,
        )
