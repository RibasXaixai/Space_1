import base64
import json
from pathlib import Path
from typing import Optional
import os

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


class OpenAIService:
    """Service for integrating with OpenAI Vision API."""

    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        
        if OpenAI is None:
            raise ImportError("openai package is required. Install with: pip install openai")
        
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4-turbo"

    def analyze_clothing_image(self, file_path: str) -> Optional[dict]:
        """
        Analyze a clothing image using OpenAI Vision API.
        
        Args:
            file_path: Local path to the clothing image file
            
        Returns:
            Dictionary with structured clothing metadata, or None if analysis fails
        """
        try:
            # Validate file exists
            if not Path(file_path).exists():
                return None

            # Read and encode image
            with open(file_path, "rb") as f:
                image_data = f.read()
            
            base64_image = base64.b64encode(image_data).decode("utf-8")

            # Determine image media type
            suffix = Path(file_path).suffix.lower()
            media_type_map = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".webp": "image/webp",
            }
            media_type = media_type_map.get(suffix, "image/jpeg")

            # Create message with vision
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{media_type};base64,{base64_image}"
                                },
                            },
                            {
                                "type": "text",
                                "text": """Analyze this clothing item image and return a JSON object with the following fields:
{
    "category": "Type of clothing (e.g., T-Shirt, Jeans, Jacket, Sweater, Dress, etc.)",
    "color": "Primary color of the item",
    "style": "Style category (Casual, Formal, Smart Casual, Athletic, Vintage, Modern, Streetwear, or Classic)",
    "warmth_level": "How warm the item is (Light, Medium, or Heavy)",
    "weather_suitability": "Best weather for this item (Spring/Summer, Fall/Winter, All-Weather, VariableSeason, or Indoor)",
    "notes": "A brief, helpful note about this clothing item (1-2 sentences)"
}

Return ONLY valid JSON, no other text. Be concise and accurate."""
                            }
                        ],
                    }
                ],
            )

            # Parse response
            response_text = response.choices[0].message.content
            analysis = json.loads(response_text)
            
            return analysis

        except json.JSONDecodeError as e:
            print(f"Failed to parse OpenAI response as JSON: {e}")
            return None
        except FileNotFoundError:
            print(f"Image file not found: {file_path}")
            return None
        except Exception as e:
            print(f"OpenAI analysis error: {str(e)}")
            return None
