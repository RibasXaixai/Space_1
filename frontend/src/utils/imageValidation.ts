/**
 * Frontend image validation utilities for wardrobe upload.
 * Performs client-side checks before sending to backend.
 */

export const SUPPORTED_FORMATS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MIN_DIMENSION_PX = 320;              // Hard minimum (below this is too small to analyze)
export const RECOMMENDED_DIMENSION_PX = 512;      // Recommended for best quality
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB safety cap

export interface ImageValidationResult {
  valid: boolean;
  reject_reason?: string;
  warning?: string;  // Non-blocking quality hint (e.g., resolution below recommended)
}

/**
 * Validate a File before upload.
 * Returns a reject_reason string if the file should be rejected immediately.
 * Low resolution (320-511px) is NOT auto-rejected; the backend AI analyzer decides viability.
 */
export async function validateImageFile(file: File): Promise<ImageValidationResult> {
  // 1. File format check
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      reject_reason: `Unsupported file format (${file.type || "unknown"}). Please upload a JPG, PNG, or WebP image.`,
    };
  }

  // 2. File size cap
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      reject_reason: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed is 15 MB.`,
    };
  }

  // 3. Resolution check
  const dims = await getImageDimensions(file);
  if (!dims) {
    return {
      valid: false,
      reject_reason: "Could not read image dimensions. The file may be corrupted.",
    };
  }

  // Hard minimum: 320×320
  // If below, auto-reject (image too small to analyze)
  if (dims.width < MIN_DIMENSION_PX || dims.height < MIN_DIMENSION_PX) {
    return {
      valid: false,
      reject_reason: `Image resolution too low (${dims.width}×${dims.height}px). Minimum required is ${MIN_DIMENSION_PX}×${MIN_DIMENSION_PX}px.`,
    };
  }

  // Soft warning: below recommended resolution (512×512)
  // Images in this range are accepted; the backend AI analyzer decides if clothing is still clearly visible
  let warning: string | undefined;
  if (dims.width < RECOMMENDED_DIMENSION_PX || dims.height < RECOMMENDED_DIMENSION_PX) {
    warning = `Image resolution is below recommended (${dims.width}×${dims.height}px). For best quality, use ${RECOMMENDED_DIMENSION_PX}×${RECOMMENDED_DIMENSION_PX}px or higher.`;
  }

  return { valid: true, warning };
}

/**
 * Read the pixel dimensions of an image File using the browser's Image API.
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
