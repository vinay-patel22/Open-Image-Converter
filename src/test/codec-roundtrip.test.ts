// @vitest-environment node
/**
 * Real-codec round-trips against the committed fixtures. The WASM codecs are
 * seeded from node_modules bytes by src/test/setup.ts (`typeof document ===
 * "undefined"` at import time), so these tests exercise exactly the same
 * decode/encode adapters the browser worker will use.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { fittedDimensions, flattenAlpha, scanAlpha } from "../engine/codecs/imageUtils";
import { probeFromBytes } from "../engine/inspect/probe";

/** Shape shared by every jsQuash output (Node ImageData polyfill included). */
type ImageDataLike = { data: Uint8ClampedArray; width: number; height: number };

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

let pngBytes!: Uint8Array;
let jpegBytes!: Uint8Array;
let webpBytes!: Uint8Array;
let avifBytes!: Uint8Array;

beforeAll(async () => {
  [pngBytes, jpegBytes, webpBytes, avifBytes] = await Promise.all(
    ["sample-alpha.png", "sample.jpg", "sample.webp", "sample.avif"].map(async (name) =>
      new Uint8Array(await readFile(path.join(fixtures, name))),
    ),
  );
});

describe("PNG codec (@jsquash/png)", () => {
  it("decodes the fixture at 24×24 with real transparency", async () => {
    const png = await import("@jsquash/png");
    const image = (await png.decode(pngBytes.slice().buffer, undefined)) as ImageDataLike;
    expect(image.width).toBe(24);
    expect(image.height).toBe(24);
    expect(scanAlpha(image.data)).toBe(true);
  });

  it("flattenAlpha composites onto white and clears the alpha channel", async () => {
    const png = await import("@jsquash/png");
    const image = (await png.decode(pngBytes.slice().buffer, undefined)) as ImageDataLike;
    const touched = flattenAlpha(image as unknown as ImageData);
    expect(touched).toBe(true);
    expect((image as unknown as ImageData).data[3]).toBe(255); // the 6×6 corner was alpha-0
    expect(scanAlpha(image.data)).toBe(false);
  });

  it("encodes, re-probes and re-decodes (full lossless round-trip)", async () => {
    const png = await import("@jsquash/png");
    const source = (await png.decode(pngBytes.slice().buffer, undefined)) as ImageDataLike;
    const bytes = new Uint8Array(await png.encode(source as unknown as ImageData, { bitDepth: 8 }));

    const probe = probeFromBytes(bytes, "png");
    expect(probe.bitDepth).toBe(8);
    expect(probe.alphaChannelSuspected).toBe(true);

    const decoded = (await png.decode(bytes.slice().buffer, undefined)) as ImageDataLike;
    expect(decoded.width).toBe(24);
    expect(decoded.height).toBe(24);
    expect(decoded.data.length).toBe(24 * 24 * 4);
  });
});

describe("JPEG codec (@jsquash/jpeg)", () => {
  it("encodes an ImageData to JPEG bytes and decodes them back", async () => {
    const jpeg = await import("@jsquash/jpeg");

    const source = { data: solidImage(), width: 16, height: 16 } as unknown as ImageData;
    const bytes = new Uint8Array(await jpeg.encode(source, { quality: 80 }));
    expect(bytes.length).toBeGreaterThan(100);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);

    const probe = probeFromBytes(bytes, "jpeg");
    expect(probe).toMatchObject({ bitDepth: null, alphaChannelSuspected: false });

    const image = (await jpeg.decode(bytes.slice().buffer, undefined)) as ImageDataLike;
    expect(image.width).toBe(16);
    expect(image.height).toBe(16);
  });

  it("decodes the fixture at original dimensions", async () => {
    const jpeg = await import("@jsquash/jpeg");
    const image = (await jpeg.decode(jpegBytes.slice().buffer, undefined)) as ImageDataLike;
    expect(image.width).toBe(24);
    expect(image.height).toBe(24);
    // JPEG has no alpha channel; mozjpeg decode fills RGBA with opaque alpha.
    expect(scanAlpha(image.data)).toBe(false);
  });
});

describe("WebP codec (@jsquash/webp)", () => {
  it("decodes the committed fixture at original dimensions", async () => {
    const webp = await import("@jsquash/webp");
    const image = (await webp.decode(webpBytes.slice().buffer)) as ImageDataLike;
    expect(image.width).toBe(24);
    expect(image.height).toBe(24);
    // The fixture carries a transparent 6px corner block — libwebp keeps it.
    expect(scanAlpha(image.data)).toBe(true);
  });

  it("encodes and decodes back at original dimensions", async () => {
    const webp = await import("@jsquash/webp");

    const source = { data: solidImage(), width: 16, height: 16 } as unknown as ImageData;
    const bytes = new Uint8Array(await webp.encode(source, { quality: 80 }));
    expect(bytes.length).toBeGreaterThan(30);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WEBP");

    const image = (await webp.decode(bytes.slice().buffer)) as ImageDataLike;    expect(image.width).toBe(16);
    expect(image.height).toBe(16);
  });
});

describe("AVIF codec (@jsquash/avif) — slow encoder, long timeout", () => {
  it("decodes the committed fixture at original dimensions", { timeout: 30_000 }, async () => {
    const avif = await import("@jsquash/avif");
    const image = await avif.decode(avifBytes.slice().buffer);
    expect(image).not.toBeNull();
    expect(image!.width).toBe(24);
    expect(image!.height).toBe(24);
  });

  it("encodes and decodes back at original dimensions", { timeout: 30_000 }, async () => {
    const avif = await import("@jsquash/avif");

    const source = { data: solidImage(), width: 16, height: 16 } as unknown as ImageData;
    const bytes = new Uint8Array(await avif.encode(source, { quality: 60, speed: 10 }));
    expect(bytes.length).toBeGreaterThan(50);
    expect(String.fromCharCode(...bytes.slice(4, 8))).toBe("ftyp");

    const image = await avif.decode(bytes.slice().buffer);
    expect(image).not.toBeNull();
    expect(image!.width).toBe(16);
    expect(image!.height).toBe(16);
  });
});

describe("fittedDimensions", () => {
  it("caps the longest side and preserves aspect", () => {
    expect(fittedDimensions(4000, 2000, 2048)).toEqual({ width: 2048, height: 1024 });
    expect(fittedDimensions(2000, 4000, 1024)).toEqual({ width: 512, height: 1024 });
  });

  it("never upscales and clamps to 1 px", () => {
    expect(fittedDimensions(100, 100, 2048)).toEqual({ width: 100, height: 100 });
    expect(fittedDimensions(1, 5000, 100)).toEqual({ width: 1, height: 100 });
  });
});

/** 16×16 opaque RGBA buffer (solid left half red, right half blue). */
function solidImage(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      if (x < 8) {
        data[i] = 200;
      } else {
        data[i + 2] = 150;
      }
      data[i + 3] = 255;
    }
  }
  return data;
}
