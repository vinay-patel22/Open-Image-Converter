import { describe, expect, it } from "vitest";
import {
  getFormat,
  isSupportedFormat,
  OUTPUT_FORMATS,
} from "../engine/registry";

describe("format capability registry", () => {
  it("exposes all formats including extended (Phase 5)", () => {
    expect(OUTPUT_FORMATS).toEqual(["png", "jpeg", "webp", "avif", "gif", "bmp", "tiff", "ico", "svg"]);
  });

  it("persists PRD chip labels", () => {
    expect(getFormat("jpeg").label).toBe("JPG");
    expect(getFormat("png").label).toBe("PNG");
    expect(getFormat("webp").label).toBe("WebP");
    expect(getFormat("avif").label).toBe("AVIF");
    expect(getFormat("gif").label).toBe("GIF");
    expect(getFormat("bmp").label).toBe("BMP");
    expect(getFormat("tiff").label).toBe("TIFF");
    expect(getFormat("ico").label).toBe("ICO");
    expect(getFormat("svg").label).toBe("SVG");
  });

  it("declares transparency appropriately", () => {
    expect(getFormat("jpeg").transparency).toBe(false);
    expect(getFormat("png").transparency).toBe(true);
    expect(getFormat("gif").transparency).toBe(true);
    expect(getFormat("bmp").transparency).toBe(true);
    expect(getFormat("svg").transparency).toBe(true);
  });

  it("marks lossy formats", () => {
    expect(getFormat("jpeg").lossy).toBe(true);
    expect(getFormat("png").lossy).toBe(false);
    expect(getFormat("gif").lossy).toBe(false);
    expect(getFormat("bmp").lossy).toBe(false);
  });

  it("rejects unsupported kinds", () => {
    expect(isSupportedFormat("heic")).toBe(false);
    expect(isSupportedFormat("unknown")).toBe(false);
  });
});
