import { describe, expect, it } from "vitest";
import { detectFormatFromBytes, DETECTED_KIND_LABEL } from "../engine/inspect/signatures";

const hex = (s: string) => Uint8Array.from(s.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
const ascii = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));

describe("detectFormatFromBytes (magic bytes only)", () => {
  it("detects JPEG by FF D8 FF", () => {
    expect(detectFormatFromBytes(hex("ffd8ffe000104a46494600010100"))).toBe("jpeg");
  });

  it("detects PNG by full signature", () => {
    expect(detectFormatFromBytes(hex("89504e470d0a1a0a0000000d49484452"))).toBe("png");
  });

  it("detects WebP by RIFF … WEBP", () => {
    expect(detectFormatFromBytes(hex("52494646240000005745425056503820"))).toBe("webp");
  });

  it("detects AVIF by major brand avif or avis", () => {
    expect(detectFormatFromBytes(ascii("????ftypavifavif"))).toBe("avif");
    expect(detectFormatFromBytes(ascii("????ftypavisavif"))).toBe("avif");
  });

  it("detects AVIF by compatible brand (mif1 container + avif)", () => {
    const arr = new Uint8Array(64);
    arr.set(ascii("ftypmif1avif"), 4); // major = mif1, first compatible brand = avif
    arr.set(ascii("miaf"), 16);
    expect(detectFormatFromBytes(arr)).toBe("avif");
  });

  it("detects HEIC by major brand heic", () => {
    const arr = new Uint8Array(32);
    arr.set(ascii("ftypheicheic"), 4);
    expect(detectFormatFromBytes(arr)).toBe("heic");
  });

  it("labels ambiguous mif1 HEIF containers as heif, never avif", () => {
    const arr = new Uint8Array(32);
    arr.set(ascii("ftypmif1miaf"), 4);
    expect(detectFormatFromBytes(arr)).toBe("heif");
  });

  it("detects GIF87a and GIF89a", () => {
    expect(detectFormatFromBytes(ascii("GIF87a"))).toBe("gif");
    expect(detectFormatFromBytes(ascii("GIF89a"))).toBe("gif");
  });

  it("detects TIFF little- and big-endian", () => {
    expect(detectFormatFromBytes(hex("49492a00"))).toBe("tiff");
    expect(detectFormatFromBytes(hex("4d4d002a"))).toBe("tiff");
  });

  it("detects BMP", () => {
    expect(detectFormatFromBytes(hex("424d00000000"))).toBe("bmp");
  });

  it("detects ICO", () => {
    expect(detectFormatFromBytes(hex("0000010000"))).toBe("ico");
  });

  it("detects SVG with leading whitespace, BOM and/or XML prolog", () => {
    expect(detectFormatFromBytes(ascii("<svg xmlns='x'>"))).toBe("svg");
    expect(detectFormatFromBytes(ascii("\n <?xml version='1.0'?><svg xmlns='x'>"))).toBe("svg");
  });

  it("returns unknown for random bytes", () => {
    expect(detectFormatFromBytes(hex("deadbeefcafebabebeef"))).toBe("unknown");
  });

  it("returns unknown for empty input", () => {
    expect(detectFormatFromBytes(new Uint8Array(0))).toBe("unknown");
  });

  it("labels the non-MVP kinds for honest messaging", () => {
    expect(DETECTED_KIND_LABEL.heic).toBe("HEIC");
    expect(DETECTED_KIND_LABEL.unknown).toBe("Unknown");
  });
});
