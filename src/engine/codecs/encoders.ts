/**
 * Encode adapters: lazy-loaded jsQuash WASM encoders (self-hosted), the only
 * reliable AVIF encoder option in browsers (ARCHITECTURE §5.2). Quality
 * (1–100) is a product-level setting; the registry decides per format whether
 * it applies (PNG is lossless and ignores it).
 */
import { getFormat } from "../registry";
import type { ImageFormatId } from "../types";

export async function encodeImageData(
  imageData: ImageData,
  outputFormat: ImageFormatId,
  quality: number,
): Promise<Blob> {
  const spec = getFormat(outputFormat);
  switch (outputFormat) {
    case "png": {
      const png = await import("@jsquash/png");
      const buffer = await png.encode(imageData, { bitDepth: 8 });
      return new Blob([buffer], { type: spec.mime });
    }
    case "jpeg": {
      const jpeg = await import("@jsquash/jpeg");
      const buffer = await jpeg.encode(imageData, { quality });
      return new Blob([buffer], { type: spec.mime });
    }
    case "webp": {
      const webp = await import("@jsquash/webp");
      const buffer = await webp.encode(imageData, { quality });
      return new Blob([buffer], { type: spec.mime });
    }
    case "avif": {
      const avif = await import("@jsquash/avif");
      const buffer = await avif.encode(imageData, { quality });
      return new Blob([buffer], { type: spec.mime });
    }
    case "gif": {
      const { GifWriter } = await import("omggif");
      const { width, height, data } = imageData;
      const palette = quantizePalette(data, 256);
      const indices = new Uint8Array(width * height);
      const numPixels = width * height;
      for (let i = 0; i < numPixels; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        const a = data[i * 4 + 3];
        if (a === 0) {
          indices[i] = 0; // transparent index
        } else {
          indices[i] = findNearestPaletteIndex(r, g, b, palette);
        }
      }
      const buffer = new Uint8Array(width * height + 1024);
      const writer = new GifWriter(buffer as any, width, height, { palette: palette.map((p) => [p.r, p.g, p.b]) } as any);
      writer.addFrame(0, 0, width, height, indices as any, { transparent: 0, delay: 10 } as any);
      return new Blob([buffer.slice(0, writer.end() as any)], { type: spec.mime });
    }
    case "bmp": {
      return encodeBmp(imageData);
    }
    case "tiff": {
      throw new Error("TIFF encoding not yet implemented");
    }
    case "ico": {
      throw new Error("ICO encoding not yet implemented");
    }
    case "svg": {
      throw new Error("SVG encoding not supported (rasterization only)");
    }
  }
}

function encodeBmp(imageData: ImageData): Blob {
  const { width, height, data } = imageData;
  const rowSize = Math.ceil((width * 24) / 32) * 4;
  const dataSize = rowSize * height;
  const fileSize = 54 + dataSize;
  const buffer = new Uint8Array(fileSize);
  
  // BMP Header
  buffer[0] = 0x42; // 'B'
  buffer[1] = 0x4d; // 'M'
  buffer[2] = fileSize & 0xff;
  buffer[3] = (fileSize >> 8) & 0xff;
  buffer[4] = (fileSize >> 16) & 0xff;
  buffer[5] = (fileSize >> 24) & 0xff;
  buffer[10] = 54; // data offset
  
  // DIB Header
  buffer[14] = 40; // header size
  buffer[18] = width & 0xff;
  buffer[19] = (width >> 8) & 0xff;
  buffer[20] = (width >> 16) & 0xff;
  buffer[21] = (width >> 24) & 0xff;
  buffer[22] = height & 0xff;
  buffer[23] = (height >> 8) & 0xff;
  buffer[24] = (height >> 16) & 0xff;
  buffer[25] = (height >> 24) & 0xff;
  buffer[26] = 1; // planes
  buffer[28] = 24; // bits per pixel
  
  // Pixel data (BGR, bottom-up)
  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      buffer[offset++] = data[i + 2]; // B
      buffer[offset++] = data[i + 1]; // G
      buffer[offset++] = data[i]; // R
    }
    // Padding to 4-byte boundary
    while (offset % 4 !== 0) {
      buffer[offset++] = 0;
    }
  }
  
  return new Blob([buffer], { type: "image/bmp" });
}

function quantizePalette(data: Uint8ClampedArray, maxColors: number): Array<{ r: number; g: number; b: number }> {
  const colors = new Map<string, { r: number; g: number; b: number; count: number }>();
  const numPixels = data.length / 4;
  for (let i = 0; i < numPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    if (a === 0) continue; // skip transparent pixels
    const key = `${r},${g},${b}`;
    const existing = colors.get(key);
    if (existing) {
      existing.count++;
    } else {
      colors.set(key, { r, g, b, count: 1 });
    }
  }
  const sorted = Array.from(colors.values()).sort((a, b) => b.count - a.count);
  const palette = sorted.slice(0, maxColors - 1).map((c) => ({ r: c.r, g: c.g, b: c.b }));
  // Ensure index 0 is reserved for transparency
  palette.unshift({ r: 0, g: 0, b: 0 });
  return palette;
}

function findNearestPaletteIndex(r: number, g: number, b: number, palette: Array<{ r: number; g: number; b: number }>): number {
  let minDist = Infinity;
  let minIndex = 1; // skip index 0 (transparent)
  for (let i = 1; i < palette.length; i++) {
    const p = palette[i];
    const dr = r - p.r;
    const dg = g - p.g;
    const db = b - p.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < minDist) {
      minDist = dist;
      minIndex = i;
    }
  }
  return minIndex;
}
