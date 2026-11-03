/**
 * Decode adapter (hybrid strategy, ARCHITECTURE §5.2): native
 * createImageBitmap first — fast, orientation-aware — with per-format WASM
 * fallback once the native route is unavailable (e.g., AVIF on browsers
 * without native decoding, or Node tests).
 */
import { imageDataFromBitmap } from "./imageUtils";
import { getNativeDecodeSupport } from "./nativeSupport";
import type { ImageFormatId } from "../types";

export async function decodeToImageData(blob: Blob, inputFormat: ImageFormatId): Promise<ImageData> {
  // GIF, BMP, ICO, TIFF have no native decode; go straight to WASM/custom
  if (inputFormat === "gif" || inputFormat === "bmp" || inputFormat === "ico" || inputFormat === "tiff") {
    return wasmDecode(blob, inputFormat);
  }

  // SVG uses browser-native rendering
  if (inputFormat === "svg") {
    return decodeSvg(blob);
  }

  const canNativeDecode =
    typeof createImageBitmap === "function" &&
    (inputFormat !== "avif" || (await getNativeDecodeSupport()).avif);

  if (canNativeDecode) {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return imageDataFromBitmap(bitmap);
    } catch {
      // Corrupt pixels or an unsupported exotic variant: retry through WASM.
    }
  }
  return wasmDecode(blob, inputFormat);
}

async function decodeSvg(blob: Blob): Promise<ImageData> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  
  const canvas = new OffscreenCanvas(img.width || 512, img.height || 512);
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return imageData;
}

async function wasmDecode(blob: Blob, format: ImageFormatId): Promise<ImageData> {
  const buffer = await blob.arrayBuffer();
  switch (format) {
    case "jpeg": {
      const jpeg = await import("@jsquash/jpeg");
      return jpeg.decode(buffer, { preserveOrientation: true });
    }
    case "png": {
      const png = await import("@jsquash/png");
      return png.decode(buffer);
    }
    case "webp": {
      const webp = await import("@jsquash/webp");
      return webp.decode(buffer);
    }
    case "avif": {
      const avif = await import("@jsquash/avif");
      const decoded = await avif.decode(buffer);
      if (!decoded || decoded.data.length === 0) {
        throw new Error("The AVIF image has no decodable primary picture element.");
      }
      return decoded;
    }
    case "gif": {
      const { GifReader } = await import("omggif");
      const bytes = new Uint8Array(buffer);
      const reader = new GifReader(bytes as Buffer);
      const info = reader.frameInfo(0);
      const imageData = new ImageData(info.width, info.height);
      reader.decodeAndBlitFrameRGBA(0, imageData.data as unknown as Uint8ClampedArray);
      return imageData;
    }
    case "bmp": {
      return decodeBmp(new Uint8Array(buffer));
    }
    case "tiff": {
      throw new Error("TIFF codec not yet implemented");
    }
    case "ico": {
      return decodeIco(new Uint8Array(buffer));
    }
    case "svg": {
      throw new Error("SVG rasterization not yet implemented");
    }
  }
}

function decodeBmp(bytes: Uint8Array): ImageData {
  if (bytes.length < 54) throw new Error("Invalid BMP: file too small");
  const isBm = String.fromCharCode(bytes[0], bytes[1]) === "BM";
  if (!isBm) throw new Error("Invalid BMP: missing BM signature");
  
  const dataOffset = bytes[10] | (bytes[11] << 8) | (bytes[12] << 16) | (bytes[13] << 24);
  const width = bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24);
  const height = bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24);
  const bitsPerPixel = bytes[28] | (bytes[29] << 8);
  
  if (bitsPerPixel !== 24 && bitsPerPixel !== 32) {
    throw new Error(`Unsupported BMP bit depth: ${bitsPerPixel}`);
  }
  
  const bytesPerPixel = bitsPerPixel / 8;
  const rowSize = Math.ceil((width * bitsPerPixel) / 32) * 4;
  const imageData = new ImageData(width, Math.abs(height));
  const isTopDown = height < 0;
  const absHeight = Math.abs(height);
  
  for (let y = 0; y < absHeight; y++) {
    const rowOffset = dataOffset + (isTopDown ? y * rowSize : (absHeight - 1 - y) * rowSize);
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + x * bytesPerPixel;
      const i = (y * width + x) * 4;
      if (bitsPerPixel === 24) {
        imageData.data[i] = bytes[pixelOffset + 2]; // B
        imageData.data[i + 1] = bytes[pixelOffset + 1]; // G
        imageData.data[i + 2] = bytes[pixelOffset]; // R
        imageData.data[i + 3] = 255; // A
      } else {
        imageData.data[i] = bytes[pixelOffset + 2]; // B
        imageData.data[i + 1] = bytes[pixelOffset + 1]; // G
        imageData.data[i + 2] = bytes[pixelOffset]; // R
        imageData.data[i + 3] = bytes[pixelOffset + 3]; // A
      }
    }
  }
  
  return imageData;
}

async function decodeIco(bytes: Uint8Array): Promise<ImageData> {
  if (bytes.length < 22) throw new Error("Invalid ICO: file too small");
  const isIco = bytes[0] === 0 && bytes[1] === 0;
  if (!isIco) throw new Error("Invalid ICO: missing signature");
  
  const imageCount = bytes[4] | (bytes[5] << 8);
  if (imageCount === 0) throw new Error("Invalid ICO: no images");
  
  // Decode the largest entry for simplicity
  let largestOffset = 0;
  let largestSize = 0;
  
  for (let i = 0; i < imageCount; i++) {
    const offset = 6 + i * 16;
    const width = bytes[offset] === 0 ? 256 : bytes[offset];
    const height = bytes[offset + 1] === 0 ? 256 : bytes[offset + 1];
    const size = width * height;
    const dataOffset = bytes[offset + 14] | (bytes[offset + 15] << 8) | (bytes[offset + 16] << 16) | (bytes[offset + 17] << 24);
    
    if (size > largestSize) {
      largestSize = size;
      largestOffset = dataOffset;
    }
  }
  
  // Check if it's a PNG (some ICOs contain PNG)
  if (bytes[largestOffset] === 0x89 && bytes[largestOffset + 1] === 0x50) {
    const pngBytes = bytes.slice(largestOffset);
    const png = await import("@jsquash/png");
    return png.decode(pngBytes.buffer);
  }
  
  // Otherwise treat as BMP
  return decodeBmp(bytes.slice(largestOffset));
}
