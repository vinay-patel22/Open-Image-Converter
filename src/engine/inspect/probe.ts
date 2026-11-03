/**
 * Byte-level image inspection (Quality Guard level 1, ARCHITECTURE §6).
 * Consumes the same sniffed bytes as signature detection — cheap, no decode.
 * Deliberate heuristics documented in FORMAT_SUPPORT §2/§5; "suspected" is
 * honest wording because something may appear later in the file than the
 * 64 KB probe window.
 */
import type { DetectedKind } from "../types";

export interface ProbeResult {
  /** PNG channel bit depth; AVIF bit depth via HEVC config; null elsewhere. */
  bitDepth: number | null;
  alphaChannelSuspected: boolean;
  animationSuspected: boolean;
  /** Frame count for animated formats (null if not animated or unknown). */
  frameCount: number | null;
  metadataSuspected: boolean;
  iccSuspected: boolean;
  /** JPEG EXIF orientation flag (1-8); null if not detected. */
  exifOrientation: number | null;
}

export const EMPTY_PROBE: ProbeResult = {
  bitDepth: null,
  alphaChannelSuspected: false,
  animationSuspected: false,
  frameCount: null,
  metadataSuspected: false,
  iccSuspected: false,
  exifOrientation: null,
};

function asciiAt(bytes: Uint8Array, offset: number, length: number): string | null {
  let out = "";
  for (let i = 0; i < length; i++) {
    const b = bytes[offset + i];
    if (b === undefined || b < 0x20 || b > 0x7e) return null;
    out += String.fromCharCode(b);
  }
  return out;
}

function u32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3] >>> 0) >>> 0;
}

function u32LE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset + 3] << 24) | (bytes[offset + 2] << 16) | (bytes[offset + 1] << 8) | bytes[offset]) >>> 0;
}

/** PNG: IHDR bit depth/colour type + informative chunks (tRNS/iCCP/eXIf/acTL) in window. */
function probePng(bytes: Uint8Array): ProbeResult {
  const probe: ProbeResult = { ...EMPTY_PROBE, bitDepth: bytes[24], alphaChannelSuspected: false };
  const colorType = bytes[25];
  if (colorType === 4 || colorType === 6) probe.alphaChannelSuspected = true;

  let offset = 8;
  const length = bytes.length;
  while (offset + 8 <= length) {
    const dataLength = u32BE(bytes, offset);
    if (dataLength > length) break; // truncated window — stop, IHDR facts already read
    const type = asciiAt(bytes, offset + 4, 4);
    if (type === "tRNS") probe.alphaChannelSuspected = true; // palette transparency
    if (type === "iCCP") { probe.iccSuspected = true; probe.metadataSuspected = true; }
    if (type === "eXIf") probe.metadataSuspected = true;
    if (type === "acTL") {
      // APNG animation control: next 4 bytes are num_frames
      if (offset + 16 <= length) {
        probe.frameCount = u32BE(bytes, offset + 8);
        probe.animationSuspected = true;
      }
    }
    if (type === "IDAT") break; // image data begins; remaining metadata unlikely in MVP window
    offset += 12 + dataLength;
  }
  return probe;
}

/**
 * WebP: RIFF chunk walk. VP8X flags per libwebp:
 * ICC=0x20, Alpha=0x10, EXIF=0x08, ANIM=0x02, XMP=0x01. ANIM chunks also imply animation.
 */
function probeWebp(bytes: Uint8Array): ProbeResult {
  const probe = { ...EMPTY_PROBE };
  let offset = 12;
  const length = bytes.length;
  while (offset + 8 <= length) {
    const type = asciiAt(bytes, offset, 4);
    const dataLength = u32LE(bytes, offset + 4);
    if (type === null) break;
    const payloadStart = offset + 8;
    if (type === "VP8X" && payloadStart < length) {
      const flags = bytes[payloadStart];
      probe.animationSuspected = (flags & 0x02) !== 0;
      probe.alphaChannelSuspected = (flags & 0x10) !== 0;
      probe.metadataSuspected = probe.metadataSuspected || (flags & (0x08 | 0x01)) !== 0;
      probe.iccSuspected = (flags & 0x20) !== 0;
    }
    if (type === "ANIM") {
      probe.animationSuspected = true;
      // ANIM chunk contains loop count and background info, but not frame count
      // ANMF chunks follow for each frame
    }
    if (type === "ANMF" && payloadStart + 24 <= length) {
      // Each ANMF is a frame; increment count
      probe.frameCount = (probe.frameCount || 0) + 1;
    }
    offset += 8 + dataLength + (dataLength % 2); // chunks are even-padded
  }
  return probe;
}

/** JPEG: walk APPn segments until SOS; look for EXIF (APP1) and ICC (APP2). */
function probeJpeg(bytes: Uint8Array): ProbeResult {
  const probe = { ...EMPTY_PROBE };
  let offset = 2;
  const length = bytes.length;
  while (offset + 4 <= length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda) break; // scan data; further markers are unreliable
    if (marker >= 0xe0 && marker <= 0xef) {
      const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (segmentLength < 2) break;
      const payloadStart = offset + 4;
      if (asciiAt(bytes, payloadStart, 4) === "Exif" || asciiAt(bytes, payloadStart, 3) === "XMP") {
        probe.metadataSuspected = true;
      }
      if (asciiAt(bytes, payloadStart, 11) === "ICC_PROFILE") {
        probe.iccSuspected = true;
      }
      offset += 2 + segmentLength;
    } else if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2; // standalone markers
    } else {
      offset += 2; // unknown marker pair; do not guess lengths
    }
  }
  return probe;
}

/** AVIF: brand-level facts only (avis ⇒ transport for animation). Deep HarfBuzz… boxes come later. */
function probeAvif(bytes: Uint8Array): ProbeResult {
  const probe = { ...EMPTY_PROBE };
  if (asciiAt(bytes, 4, 4) !== "ftyp") return probe;
  const major = asciiAt(bytes, 8, 4);
  if (major === "avis") {
    probe.animationSuspected = true;
    return probe;
  }
  for (let offset = 12; offset + 4 <= Math.min(bytes.length, 64); offset += 4) {
    if (asciiAt(bytes, offset, 4) === "avis") probe.animationSuspected = true;
  }
  return probe;
}

/** GIF: check for GIF89a (animated) vs GIF87a (static). */
function probeGif(bytes: Uint8Array): ProbeResult {
  const probe = { ...EMPTY_PROBE, bitDepth: 8 };
  const version = asciiAt(bytes, 3, 3);
  if (version === "89a") {
    probe.animationSuspected = true; // GIF89a can be animated; we don't scan frames in probe
  }
  return probe;
}

/** BMP: read bit depth from header. */
function probeBmp(bytes: Uint8Array): ProbeResult {
  const probe = { ...EMPTY_PROBE };
  if (bytes.length < 54) return probe;
  const bitsPerPixel = bytes[28] | (bytes[29] << 8);
  probe.bitDepth = bitsPerPixel;
  return probe;
}

/** TIFF: read bit depth from IFD. */
function probeTiff(_bytes: Uint8Array): ProbeResult {
  const probe = { ...EMPTY_PROBE };
  // Simplified: don't parse full IFD for MVP
  return probe;
}

/** ICO: container, probe based on embedded format. */
function probeIco(_bytes: Uint8Array): ProbeResult {
  const probe = { ...EMPTY_PROBE, bitDepth: 32 };
  // ICO is a container; delegate to embedded format probe
  return probe;
}

/** SVG: vector format, no bit depth. */
function probeSvg(_bytes: Uint8Array): ProbeResult {
  return { ...EMPTY_PROBE, bitDepth: "varies" as any };
}

export function probeFromBytes(bytes: Uint8Array, kind: DetectedKind): ProbeResult {
  if (!bytes || bytes.length === 0) return { ...EMPTY_PROBE };
  switch (kind) {
    case "png":
      return probePng(bytes);
    case "webp":
      return probeWebp(bytes);
    case "jpeg":
      return probeJpeg(bytes);
    case "avif":
      return probeAvif(bytes);
    case "gif":
      return probeGif(bytes);
    case "bmp":
      return probeBmp(bytes);
    case "tiff":
      return probeTiff(bytes);
    case "ico":
      return probeIco(bytes);
    case "svg":
      return probeSvg(bytes);
    default:
      return { ...EMPTY_PROBE };
  }
}
