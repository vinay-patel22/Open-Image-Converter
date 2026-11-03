/**
 * Validation API (PRD §12 / acceptance #2): signature-based, extension-blind,
 * honest about every unsupported kind. Also returns byte-level Quality Guard
 * probe facts for preflight warnings.
 */
import { detectFormatFromBytes, DETECTED_KIND_LABEL } from "./inspect/signatures";
import { probeFromBytes, type ProbeResult } from "./inspect/probe";
import { getFormat, isSupportedFormat } from "./registry";
import type { ImageFormatId } from "./types";

/** Enough bytes for all binary signatures, header metadata and SVG scan. */
const SNIFF_SIZE = 65_536;

export type ValidationResult =
  | { ok: true; format: ImageFormatId; kindLabel: string; probe: ProbeResult }
  | {
      ok: false;
      code: "empty" | "unknown-format" | "unsupported-format";
      kindLabel: string;
      message: string;
    };

const UNSUPPORTED_MESSAGES = {
  heic: "HEIC / HEIF (iPhone photos) is recognised but not supported yet — it is planned for a later release.",
  heif: "HEIF is recognised but its brand family is not supported yet — it is planned for a later release.",
  unknown: "This file could not be recognised as a supported image format.",
} as const;

function fail(code: "empty" | "unknown-format" | "unsupported-format", kindLabel: string, message: string): ValidationResult {
  return { ok: false, code, kindLabel, message };
}

export async function validateImageFile(file: File | Blob): Promise<ValidationResult> {
  if (file.size === 0) {
    return fail("empty", "File", "The selected file is empty (0 bytes) and cannot be converted.");
  }

  const bytes = new Uint8Array(await file.slice(0, SNIFF_SIZE).arrayBuffer());
  if (bytes.length === 0) {
    return fail("empty", "File", "The selected file is empty (0 bytes) and cannot be converted.");
  }

  const kind = detectFormatFromBytes(bytes);
  const kindLabel = DETECTED_KIND_LABEL[kind];

  if (isSupportedFormat(kind)) {
    return {
      ok: true,
      format: kind,
      kindLabel: getFormat(kind).label,
      probe: probeFromBytes(bytes, kind),
    };
  }

  if (kind === "unknown") {
    return fail("unknown-format", kindLabel, UNSUPPORTED_MESSAGES[kind]);
  }
  return fail("unsupported-format", kindLabel, UNSUPPORTED_MESSAGES[kind]);
}
