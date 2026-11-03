/**
 * Pixel utilities for conversion workers. Framework-free and usable in Node
 * tests. Canvas-dependent helpers (resize/bitmap conversion) only run where
 * OffscreenCanvas exists (workers / modern main threads).
 */

/** True when any pixel has a non-opaque alpha channel value. */
export function scanAlpha(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 255) return true;
  }
  return false;
}

/** Composites alpha over `bg` and returns whether any alpha was present. */
export function flattenAlpha(imageData: ImageData, bg = { r: 255, g: 255, b: 255 }): boolean {
  const data = imageData.data;
  let touched = false;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 255) continue;
    const weight = alpha / 255;
    data[i] = data[i] * weight + bg.r * (1 - weight);
    data[i + 1] = data[i + 1] * weight + bg.g * (1 - weight);
    data[i + 2] = data[i + 2] * weight + bg.b * (1 - weight);
    data[i + 3] = 255;
    touched = true;
  }
  return touched;
}

/** Copies a decoded ImageBitmap into an ImageData and closes the bitmap. */
export function imageDataFromBitmap(bitmap: ImageBitmap): ImageData {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
  context.drawImage(bitmap, 0, 0);
  const result = context.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close();
  return result;
}

/** High-quality, aspect-preserving scaling through OffscreenCanvas. */
export function resizeImageData(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData {
  const source = new OffscreenCanvas(imageData.width, imageData.height);
  const sourceContext = source.getContext("2d") as OffscreenCanvasRenderingContext2D;
  sourceContext.putImageData(imageData, 0, 0);

  const target = new OffscreenCanvas(targetWidth, targetHeight);
  const context = target.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, imageData.width, imageData.height, 0, 0, targetWidth, targetHeight);
  return context.getImageData(0, 0, targetWidth, targetHeight);
}

/** Longest-side cap → fitted dimensions, never upscaling, minimum 1 px. */
export function fittedDimensions(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (maxSide >= longest) return { width, height };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
