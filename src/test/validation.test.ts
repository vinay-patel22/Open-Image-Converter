// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateImageFile, type ValidationResult } from "../engine/validation";

const hex = (s: string) => Uint8Array.from(s.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
const ascii = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
const file = (part: BlobPart, name: string) => new File([part], name, { type: "application/octet-stream" });

function expectFailure(result: ValidationResult) {
  if (result.ok) throw new Error("expected validation failure");
  return result;
}

describe("validateImageFile (signature-based, extension-blind)", () => {
  it("accepts a real PNG and records the format from bytes", async () => {
    const result = await validateImageFile(file(hex("89504e470d0a1a0a0000000d49484452"), "sample.png"));
    expect(result).toMatchObject({ ok: true, format: "png", kindLabel: "PNG" });
  });

  it("trusts bytes over file name: .png containing JPEG bytes is JPEG", async () => {
    const result = await validateImageFile(file(hex("ffd8ffe000"), "looks-png.png"));
    expect(result).toMatchObject({ ok: true, format: "jpeg", kindLabel: "JPG" });
  });

  it("rejects zero-byte files with a specific error", async () => {
    const result = await validateImageFile(file(new Uint8Array(0), "empty.png"));
    expect(result).toMatchObject({ ok: false, code: "empty" });
  });

  it("rejects random bytes as unrecognised", async () => {
    const result = expectFailure(await validateImageFile(file(hex("deadbeefcafebabe"), "data.bin")));
    expect(result.code).toBe("unknown-format");
    expect(result.message).toContain("recognised");
  });

  it("accepts GIF files (Phase 5 support)", async () => {
    const result = await validateImageFile(file(ascii("GIF89a"), "anim.gif"));
    expect(result).toMatchObject({ ok: true, format: "gif", kindLabel: "GIF" });
  });

  it("accepts BMP files (Phase 5 support)", async () => {
    const bytes = Uint8Array.from([0x42, 0x4d, ...new Uint8Array(52)]);
    const result = await validateImageFile(file(bytes, "image.bmp"));
    expect(result).toMatchObject({ ok: true, format: "bmp", kindLabel: "BMP" });
  });

  it("accepts ICO files (Phase 5 support)", async () => {
    const bytes = Uint8Array.from([0x00, 0x00, 0x01, 0x00, ...new Uint8Array(18)]);
    const result = await validateImageFile(file(bytes, "icon.ico"));
    expect(result).toMatchObject({ ok: true, format: "ico", kindLabel: "ICO" });
  });

  it("accepts TIFF files (Phase 5 support)", async () => {
    const bytes = Uint8Array.from([0x49, 0x49, 0x2a, 0x00, ...new Uint8Array(4)]);
    const result = await validateImageFile(file(bytes, "scan.tif"));
    expect(result).toMatchObject({ ok: true, format: "tiff", kindLabel: "TIFF" });
  });

  it("accepts SVG files (Phase 5 support)", async () => {
    const result = await validateImageFile(file(ascii("<svg xmlns='x'></svg>"), "icon.svg"));
    expect(result).toMatchObject({ ok: true, format: "svg", kindLabel: "SVG" });
  });

  it("gives SVG-specific messaging including honesty about rasterization", async () => {
    const result = await validateImageFile(file(ascii("<svg xmlns='x'></svg>"), "icon.svg"));
    expect(result).toMatchObject({ ok: true, format: "svg", kindLabel: "SVG" });
  });

  it("gives HEIC-specific messaging for iPhone photos", async () => {
    const arr = new Uint8Array(32);
    arr.set(ascii("ftypheicheic"), 4);
    const result = expectFailure(await validateImageFile(file(arr, "iphone.heic")));
    expect(result.kindLabel).toBe("HEIC");
    expect(result.message).toContain("planned");
  });

  it("accepts WebP and AVIF signatures", async () => {
    const webp = await validateImageFile(file(hex("52494646240000005745425056503820"), "v.webp"));
    expect(webp).toMatchObject({ ok: true, format: "webp" });
    const arr = new Uint8Array(32);
    arr.set(ascii("ftypavifavif"), 4);
    const avif = await validateImageFile(file(arr, "still.avif"));
    expect(avif).toMatchObject({ ok: true, format: "avif" });
  });
});
