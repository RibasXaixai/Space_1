import hashlib
from pathlib import Path
from PIL import Image
import imagehash
from typing import Optional


# Resolve uploads directory relative to this file (backend/uploads/)
_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"


def _resolve_path(file_path: str) -> Path:
    """Convert a relative 'uploads/filename.jpg' path to an absolute path."""
    p = Path(file_path)
    if p.is_absolute():
        return p
    # Strip leading 'uploads/' prefix and resolve against the uploads directory
    name = p.name
    return _UPLOADS_DIR / name


class DuplicateDetectionService:
    """Service for detecting duplicate and similar images."""

    def compute_file_hash(self, file_path: str) -> str:
        sha256_hash = hashlib.sha256()
        with open(_resolve_path(file_path), "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def compute_perceptual_hash(self, file_path: str) -> Optional[str]:
        try:
            image = Image.open(_resolve_path(file_path))
            phash = imagehash.phash(image)
            return str(phash)
        except Exception as e:
            print(f"Failed to compute perceptual hash for {file_path}: {e}")
            return None

    def check_exact_duplicate(self, file_hash: str, existing_hashes: list[str]) -> bool:
        """
        Check if file_hash matches any existing hash (exact duplicate).

        Args:
            file_hash: SHA256 hash of current file
            existing_hashes: List of existing file hashes

        Returns:
            True if exact duplicate found
        """
        return file_hash in existing_hashes

    def check_visual_similarity(
        self, phash: str, existing_phashes: list[str], threshold: int = 5
    ) -> bool:
        """
        Check if image is visually similar to any existing image.

        Args:
            phash: Perceptual hash of current image
            existing_phashes: List of existing perceptual hashes
            threshold: Hamming distance threshold (0-64, lower = more similar)

        Returns:
            True if visually similar image found
        """
        if not phash:
            return False

        try:
            current_hash = imagehash.hex_to_hash(phash)
            for existing in existing_phashes:
                if existing:
                    existing_hash = imagehash.hex_to_hash(existing)
                    distance = current_hash - existing_hash
                    if distance <= threshold:
                        return True
        except Exception as e:
            print(f"Failed to compare perceptual hashes: {e}")
            return False

        return False

    def check_duplicates_in_batch(
        self,
        file_paths: list[str],
        existing_file_hashes: list[str] = None,
        existing_perceptual_hashes: list[str] = None,
    ) -> dict:
        """
        Check for duplicates across a batch of uploaded files.

        Args:
            file_paths: List of paths to new files
            existing_file_hashes: List of hashes from wardrobe
            existing_perceptual_hashes: List of pHashes from wardrobe

        Returns:
            Dictionary mapping file index to duplicate info:
            {
                0: {"is_exact_duplicate": bool, "is_similar_duplicate": bool, "duplicates": [...]}
            }
        """
        if existing_file_hashes is None:
            existing_file_hashes = []
        if existing_perceptual_hashes is None:
            existing_perceptual_hashes = []

        duplicates = {}
        seen_hashes = existing_file_hashes.copy()
        seen_phashes = existing_perceptual_hashes.copy()

        for idx, file_path in enumerate(file_paths):
            try:
                file_hash = self.compute_file_hash(file_path)
                phash = self.compute_perceptual_hash(file_path)

                # Check against wardrobe
                is_exact = self.check_exact_duplicate(file_hash, existing_file_hashes)
                is_similar = self.check_visual_similarity(
                    phash, existing_perceptual_hashes
                )

                # Check against earlier files in same batch
                is_exact_batch = self.check_exact_duplicate(
                    file_hash, seen_hashes[len(existing_file_hashes) :]
                )
                is_similar_batch = self.check_visual_similarity(
                    phash, seen_phashes[len(existing_perceptual_hashes) :]
                )

                duplicates[idx] = {
                    "is_exact_duplicate": is_exact or is_exact_batch,
                    "is_similar_duplicate": is_similar or is_similar_batch,
                    "file_hash": file_hash,
                    "perceptual_hash": phash,
                }

                # Add to seen for batch comparison
                seen_hashes.append(file_hash)
                if phash:
                    seen_phashes.append(phash)

            except Exception as e:
                print(f"Error checking duplicates for {file_path}: {e}")
                duplicates[idx] = {
                    "is_exact_duplicate": False,
                    "is_similar_duplicate": False,
                    "file_hash": None,
                    "perceptual_hash": None,
                }

        return duplicates
