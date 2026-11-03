/**
 * Format capability registry — the single authority for format facts used by
 * UI and engine (PRD §8, ARCHITECTURE §5.1). Statements must match
 * FORMAT_SUPPORT.md; anything not verified is declared as such.
 */
import type { ImageFormatId } from "./types";

export interface FormatSpec {
  id: ImageFormatId;
  /** UI chip label (PRD says "JPG / JPEG" for jpeg). */
  label: string;
  mime: string;
  extensions: string[];
  transparency: boolean;
  animation: boolean;
  lossy: boolean;
  qualityApplicable: boolean;
  /** Nominal container bit depth; decode pipelines are 8-bit for MVP. */
  containerBitDepth: number | "varies";
  /** Honest metadata capability of our current pipeline. */
  metadataCapability: "dropped-on-reencode";
  decode: { strategy: "native-primary" | "wasm-only" | "browser-native"; wasmFallback: string };
  encode: { engine: "wasm" | "none"; wasmPackage: string; lazyLoaded: boolean };
}

const jpeg: FormatSpec = {
  id: "jpeg",
  label: "JPG",
  mime: "image/jpeg",
  extensions: ["jpg", "jpeg"],
  transparency: false,
  animation: false,
  lossy: true,
  qualityApplicable: true,
  containerBitDepth: 8,
  metadataCapability: "dropped-on-reencode",
  decode: { strategy: "native-primary", wasmFallback: "@jsquash/jpeg" },
  encode: { engine: "wasm", wasmPackage: "@jsquash/jpeg", lazyLoaded: true },
};

const png: FormatSpec = {
  id: "png",
  label: "PNG",
  mime: "image/png",
  extensions: ["png"],
  transparency: true,
  animation: false,
  lossy: false,
  qualityApplicable: false,
  containerBitDepth: 16,
  metadataCapability: "dropped-on-reencode",
  decode: { strategy: "native-primary", wasmFallback: "@jsquash/png" },
  encode: { engine: "wasm", wasmPackage: "@jsquash/png", lazyLoaded: true },
};

const webp: FormatSpec = {
  id: "webp",
  label: "WebP",
  mime: "image/webp",
  extensions: ["webp"],
  transparency: true,
  animation: true, // animated WebP accepted as input (still-image output is warned, not silent)
  lossy: true,
  qualityApplicable: true,
  containerBitDepth: 8,
  metadataCapability: "dropped-on-reencode",
  decode: { strategy: "native-primary", wasmFallback: "@jsquash/webp" },
  encode: { engine: "wasm", wasmPackage: "@jsquash/webp", lazyLoaded: true },
};

const avif: FormatSpec = {
  id: "avif",
  label: "AVIF",
  mime: "image/avif",
  extensions: ["avif"],
  transparency: true,
  animation: true,
  lossy: true,
  qualityApplicable: true,
  containerBitDepth: "varies",
  metadataCapability: "dropped-on-reencode",
  decode: { strategy: "native-primary", wasmFallback: "@jsquash/avif" },
  encode: { engine: "wasm", wasmPackage: "@jsquash/avif", lazyLoaded: true },
};

const gif: FormatSpec = {
  id: "gif",
  label: "GIF",
  mime: "image/gif",
  extensions: ["gif"],
  transparency: true,
  animation: true,
  lossy: false,
  qualityApplicable: false,
  containerBitDepth: 8,
  metadataCapability: "dropped-on-reencode",
  decode: { strategy: "wasm-only", wasmFallback: "omggif" },
  encode: { engine: "wasm", wasmPackage: "omggif", lazyLoaded: true },
};

const bmp: FormatSpec = {
  id: "bmp",
  label: "BMP",
  mime: "image/bmp",
  extensions: ["bmp"],
  transparency: true,
  animation: false,
  lossy: false,
  qualityApplicable: false,
  containerBitDepth: 24,
  metadataCapability: "dropped-on-reencode",
  decode: { strategy: "native-primary", wasmFallback: "custom-parser" },
  encode: { engine: "wasm", wasmPackage: "custom-encoder", lazyLoaded: true },
};

const tiff: FormatSpec = {
  id: "tiff",
  label: "TIFF",
  mime: "image/tiff",
  extensions: ["tif", "tiff"],
  transparency: true,
  animation: false,
  lossy: false,
  qualityApplicable: false,
  containerBitDepth: "varies",
  metadataCapability: "dropped-on-reencode",
  decode: { strategy: "wasm-only", wasmFallback: "custom-parser" },
  encode: { engine: "wasm", wasmPackage: "custom-encoder", lazyLoaded: true },
};

const ico: FormatSpec = {
  id: "ico",
  label: "ICO",
  mime: "image/x-icon",
  extensions: ["ico"],
  transparency: true,
  animation: false,
  lossy: false,
  qualityApplicable: false,
  containerBitDepth: 32,
  metadataCapability: "dropped-on-reencode",
  decode: { strategy: "wasm-only", wasmFallback: "custom-parser" },
  encode: { engine: "wasm", wasmPackage: "custom-encoder", lazyLoaded: true },
};

const svg: FormatSpec = {
  id: "svg",
  label: "SVG",
  mime: "image/svg+xml",
  extensions: ["svg"],
  transparency: true,
  animation: false,
  lossy: false,
  qualityApplicable: false,
  containerBitDepth: "varies",
  metadataCapability: "dropped-on-reencode",
  decode: { strategy: "browser-native", wasmFallback: "none" },
  encode: { engine: "none", wasmPackage: "none", lazyLoaded: false },
};

export const FORMATS: Record<ImageFormatId, FormatSpec> = { jpeg, png, webp, avif, gif, bmp, tiff, ico, svg };

/** Order drives UI chips (PRD lists PNG first as default output). */
export const OUTPUT_FORMATS: ImageFormatId[] = ["png", "jpeg", "webp", "avif", "gif", "bmp", "tiff", "ico", "svg"];

export function getFormat(id: ImageFormatId): FormatSpec {
  return FORMATS[id];
}

export function isSupportedFormat(kind: string): kind is ImageFormatId {
  return kind === "jpeg" || kind === "png" || kind === "webp" || kind === "avif" || kind === "gif" || kind === "bmp" || kind === "tiff" || kind === "ico" || kind === "svg";
}

/** All raster pairs are planned/verified in Phase 2 — the registry is where
 * the gate lives once implemented, so the UI never offers impossible paths. */
export function canConvert(_from: ImageFormatId, to: ImageFormatId): boolean {
  return OUTPUT_FORMATS.includes(to);
}

export const DEFAULT_SETTINGS_FORMAT: ImageFormatId = "png";
