/**
 * Quality Guard (PRD §7): every degradation is reported, never silent.
 * Pure derivation — testable without workers. Used twice per item: a
 * preflight pass at "Convert All" (suspected facts from byte probes) and the
 * in-worker pass when pixel-level facts are confirmed.
 */
import { getFormat } from "./registry";
import type { Dimensions, ImageFormatId } from "./types";
import type { ProbeResult } from "./inspect/probe";

export interface GuardInput {
  inputFormat: ImageFormatId;
  outputFormat: ImageFormatId;
  probe: ProbeResult | null;
  dimensions: Dimensions | null;
  resize: { enabled: boolean; maxSide: number };
  /** null = not pixel-verified yet (preflight); true/false = worker scan result. */
  confirmedAlpha: boolean | null;
}

export function deriveWarnings(input: GuardInput): string[] {
  const warnings: string[] = [];
  const inSpec = getFormat(input.inputFormat);
  const outSpec = getFormat(input.outputFormat);
  const probe = input.probe;

  const alphaConfirmed = input.confirmedAlpha === true;
  const alphaRuledOut = input.confirmedAlpha === false;
  const alphaSuspected = probe?.alphaChannelSuspected === true && !alphaRuledOut;

  if (alphaConfirmed || alphaSuspected) {
    if (!outSpec.transparency) {
      warnings.push(
        alphaConfirmed
          ? `Transparency was removed: ${inSpec.label} contained transparent pixels and ${outSpec.label} does not support them — those areas were filled with white.`
          : `${inSpec.label} may contain transparency. ${outSpec.label} does not support it and will fill transparent areas with white.`,
      );
    }
  }

  if (probe?.animationSuspected) {
    const frameInfo = probe.frameCount && probe.frameCount > 1 ? ` (${probe.frameCount} frames)` : "";
    warnings.push(`Animated ${inSpec.label} was detected${frameInfo}. The output keeps only the first frame.`);
  }

  if (probe?.bitDepth !== null && probe?.bitDepth !== undefined && probe.bitDepth > 8) {
    warnings.push(`Colours are reduced to 8-bit — ${outSpec.label} stores ${probe.bitDepth}-bit sources at 8-bit.`);
  }

  if (probe?.iccSuspected) {
    warnings.push(`The colour profile could not be preserved; the output uses sRGB values.`);
  }

  if (probe?.metadataSuspected) {
    warnings.push(`EXIF/XMP metadata (camera, settings, GPS) is not preserved in the converted output.`);
  }

  if (probe?.bitDepth !== null && probe?.bitDepth !== undefined && probe.bitDepth > 8) {
    warnings.push(`Colours are reduced to 8-bit — ${outSpec.label} stores ${probe.bitDepth}-bit sources at 8-bit.`);
  }

  if (probe?.iccSuspected) {
    warnings.push(`The colour profile could not be preserved; the output uses sRGB values.`);
  }

  if (probe?.metadataSuspected) {
    warnings.push(`EXIF/XMP metadata (camera, settings, GPS) is not preserved in the converted output.`);
  }

  if (input.resize.enabled && input.dimensions) {
    const longest = Math.max(input.dimensions.width, input.dimensions.height);
    if (input.resize.maxSide < longest) {
      const scale = input.resize.maxSide / longest;
      const width = Math.round(input.dimensions.width * scale);
      const height = Math.round(input.dimensions.height * scale);
      warnings.push(`Resized to ${width} × ${height} px to fit ${input.resize.maxSide} px (aspect preserved).`);
    }
  }

  return [...new Set(warnings)];
}

/** Union of suspected (preflight) and confirmed (worker) warnings, de-duplicated. */
export function mergeWarnings(previous: string[], next: string[]): string[] {
  const merged = new Set(previous);
  for (const warning of next) {
    // Confirmed messages supersede their "may contain" suspected equivalent.
    if (warning.includes("Transparency was removed")) {
      for (const old of merged) if (old.includes("may contain transparency")) merged.delete(old);
    }
    merged.add(warning);
  }
  return [...merged];
}
