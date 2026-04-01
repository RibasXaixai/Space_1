import os
from pathlib import Path


def get_uploads_directory() -> Path:
    """Get or create the uploads directory."""
    uploads_dir = Path(__file__).resolve().parents[2] / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    return uploads_dir


def save_uploaded_file(file_content: bytes, filename: str) -> str:
    """
    Save an uploaded file locally and return the relative path.
    
    Args:
        file_content: The file bytes
        filename: The original filename
        
    Returns:
        The relative path to the saved file
    """
    uploads_dir = get_uploads_directory()
    
    # Create a unique filename to prevent collisions
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    ext = Path(filename).suffix
    saved_filename = f"{unique_id}{ext}"
    
    file_path = uploads_dir / saved_filename
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    return f"uploads/{saved_filename}"


def delete_uploaded_file(file_path: str) -> bool:
    """Delete an uploaded file."""
    try:
        uploads_dir = get_uploads_directory()
        full_path = uploads_dir / Path(file_path).name
        if full_path.exists():
            full_path.unlink()
            return True
    except Exception:
        pass
    return False
