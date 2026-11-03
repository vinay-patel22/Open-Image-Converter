/**
 * Object-URL lifecycle for previews (PRD §9: "Revoke object URLs when no
 * longer needed"). Store code is the sole owner — components never create or
 * revoke URLs themselves.
 */

export function createObjectUrl(blob: File | Blob): string | null {
  try {
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function revokeObjectUrl(url: string | null): void {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // jsdom/no-op environments
  }
}
