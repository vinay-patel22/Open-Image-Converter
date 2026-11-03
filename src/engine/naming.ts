/**
 * Safe output naming (PRD §12): suffix insertion, extension mapping, ZIP-safe
 * collision suffixes. Mutation of `takenNames` lets batch callers keep one set.
 */
import { getFormat } from "./registry";
import type { ImageFormatId } from "./types";

const WINDOWS_UNSAFE = /[\\/:*?"<>|#%]/g;

export function stripExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot > 0) return name.slice(0, dot);
  return name;
}

export function outputExtension(format: ImageFormatId): string {
  return getFormat(format).extensions[0];
}

export function buildOutputName(
  originalName: string,
  outputFormat: ImageFormatId,
  suffix: string,
  takenNames: Set<string> = new Set(),
): string {
  const base = stripExtension(originalName).replace(WINDOWS_UNSAFE, "").trim() || "image";
  const cleanSuffix = suffix.replace(WINDOWS_UNSAFE, "").trim();
  const ext = outputExtension(outputFormat);
  const maxStem = 200 - ext.length - 1;
  const stem = `${base}${cleanSuffix}`.slice(0, maxStem);
  let name = `${stem}.${ext}`;
  if (takenNames.has(name)) {
    let counter = 1;
    while (takenNames.has(`${stem}-${counter}.${ext}`)) counter += 1;
    name = `${stem}-${counter}.${ext}`;
  }
  takenNames.add(name);
  return name;
}
