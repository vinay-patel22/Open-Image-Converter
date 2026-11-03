/**
 * Magic-byte sniffing (PRD §8: "Do not infer actual format support from file
 * extensions alone."). Pure function over bytes — fully unit-testable.
 * Detection of non-MVP kinds is deliberate: specific honesty beats a generic
 * "unknown file" error.
 */
import type { DetectedKind } from "../types";

/** Reads 1+ ASCII tokens back to back, returns null on non-ASCII bytes. */
function asciiAt(bytes: Uint8Array, offset: number, length: number): string | null {
  let out = "";
  for (let i = 0; i < length; i++) {
    const b = bytes[offset + i];
    if (b === undefined || b < 0x20 || b > 0x7e) return null;
    out += String.fromCharCode(b);
  }
  return out;
}

function startsWith(bytes: Uint8Array, prefix: number[]) {
  if (bytes.length < prefix.length) return false;
  return prefix.every((v, i) => bytes[i] === v);
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  const text = new TextDecoder("latin1").decode(bytes.slice(0, 512));
  // Handles XML prologs, BOMs and leading whitespace before <svg>.
  return /<svg[\s>]/i.test(text) || (/<\?xml|<!doctype/i.test(text) && /<svg[\s>]/i.test(text));
}

/**
 * ftyp box brand inspection.
 * AVIF: major brand avif/avis, or any compatible brand avif/avis with
 *baarf major mif1/msf1 (Chrome-compatible sniffing). HEIC: heic/heix/hevc/…
 * Ambiguous mif1 without avif/heic markers → "heif" (honest: unknown HEIF brand).
 */
function detectHeifBrandFamily(bytes: Uint8Array): DetectedKind {
  const major = asciiAt(bytes, 8, 4);
  if (!major) return "unknown";

  const compat: string[] = [];
  const limit = Math.min(bytes.length, 64);
  for (let off = 12; off + 4 <= limit; off += 4) {
    const t = asciiAt(bytes, off, 4);
    if (t) compat.push(t);
  }
  const hasAvifBrand = compat.some((t) => t === "avif" || t === "avis");
  const hasHeicBrand = compat.some((t) => HEIC_MAJOR_BRANDS.includes(t));

  if (major === "avif" || major === "avis") return "avif";
  if (major === "mif1" || major === "msf1") {
    if (hasAvifBrand) return "avif";
    if (hasHeicBrand) return "heic";
    return "heif";
  }
  if (HEIC_MAJOR_BRANDS.includes(major)) return "heic";
  return "heif";
}

const HEIC_MAJOR_BRANDS = ["heic", "heix", "heim", "heis", "hevc", "hevm", "hevx", "msf1"];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function detectFormatFromBytes(bytes: Uint8Array): DetectedKind {
  if (!bytes || bytes.length === 0) return "unknown";

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "png";
  if (
    bytes.length >= 12 &&
    asciiAt(bytes, 0, 4) === "RIFF" &&
    asciiAt(bytes, 8, 4) === "WEBP"
  ) {
    return "webp";
  }
  if (bytes.length >= 12 && asciiAt(bytes, 4, 4) === "ftyp") {
    return detectHeifBrandFamily(bytes);
  }
  if (bytes.length >= 6 && asciiAt(bytes, 0, 3) === "GIF" && (asciiAt(bytes, 3, 3) === "87a" || asciiAt(bytes, 3, 3) === "89a")) {
    return "gif";
  }
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return "tiff";
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && (bytes[2] === 0x01 || bytes[2] === 0x02) && bytes[3] === 0x00) {
    return "ico";
  }
  if (looksLikeSvg(bytes)) return "svg";

  return "unknown";
}

export const DETECTED_KIND_LABEL: Record<DetectedKind, string> = {
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
  avif: "AVIF",
  heic: "HEIC",
  heif: "HEIF",
  gif: "GIF",
  tiff: "TIFF",
  bmp: "BMP",
  ico: "ICO",
  svg: "SVG",
  unknown: "Unknown",
};
