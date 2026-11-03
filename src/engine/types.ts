/**
 * Engine types — framework agnostic. ARCHITECTURE.md §2: nothing here may
 * import React, and UI components must not paste codec logic around these
 * types (they consume engine results only).
 */

import type { ProbeResult } from "./inspect/probe";

/** MVP output/input formats (PRD §4 Step 2). Extended in Phase 5. */
export type ImageFormatId = "jpeg" | "png" | "webp" | "avif" | "gif" | "bmp" | "tiff" | "ico" | "svg";

/**
 * What signature sniffing can conclude today. Formats outside ImageFormatId
 * are recognised so the UI can give *specific* "not supported yet" messages
 * instead of a generic failure (PRD §8, acceptance #13).
 */
export type DetectedKind =
  | ImageFormatId
  | "heic"
  | "heif"
  | "gif"
  | "tiff"
  | "bmp"
  | "ico"
  | "svg"
  | "unknown";

/** File lifecycle per PRD §12. */
export type FileStatus =
  | "validating"
  | "ready"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface ItemError {
  code: "empty" | "unknown-format" | "unsupported-format" | "conversion-failed";
  kindLabel: string;
  message: string;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  /** Object URL of the original file for thumbnail preview; revoked on remove/clear. */
  objectUrl: string | null;
  status: FileStatus;
  /** Format concluded from real file signatures — never from the extension. */
  detectedFormat: ImageFormatId | null;
  kindLabel: string;
  dimensions: Dimensions | null;
  /** Byte-level Quality Guard inspection facts (PRD §7). */
  probe: ProbeResult | null;
  error: ItemError | null;
  /** Quality Guard warnings; always surfaced, never silent. */
  warnings: string[];
  /** 0..1 while processing; null otherwise. */
  progress: number | null;
  progressStage: "decoding" | "encoding" | null;
  /** Conversion result owned by the store (Blob kept in memory only). */
  result: null | {
    name: string;
    size: number;
    mime: string;
    blob: Blob;
  };
}

export interface OutputSettings {
  format: ImageFormatId;
  /** 1..100; meaningful only for lossy formats (qualityApplicable). */
  quality: number;
  resizeEnabled: boolean;
  /** When resize enabled: longest side cap, aspect preserved. */
  maxDimension: number;
  /** Inserted after base name: `photo-` + suffix + `output.ext`. */
  suffix: string;
}
