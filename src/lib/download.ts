/** Local download helper — URL revoked after a grace period (PRD §9). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export interface ZipEntry {
  name: string;
  blob: Blob;
}

/**
 * Creates a ZIP archive from entries using fflate and downloads it.
 * All entries are added with their provided names; collisions are
 * the caller's responsibility (naming.ts disambiguates before this).
 */
export async function downloadZip(entries: ZipEntry[], zipName = "converted-images.zip"): Promise<void> {
  const { zipSync } = await import("fflate");
  const zipObj: Record<string, Uint8Array> = {};

  for (const entry of entries) {
    const buffer = await entry.blob.arrayBuffer();
    zipObj[entry.name] = new Uint8Array(buffer);
  }

  const zipped = zipSync(zipObj);
  const blob = new Blob([zipped], { type: "application/zip" });
  downloadBlob(blob, zipName);
}
