import { vi } from "vitest";

// jsdom does not implement object URLs; the store must survive them in tests.
if (typeof URL !== "undefined" && typeof URL.createObjectURL !== "function") {
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn(() => `blob:mock-${Math.random().toString(36).slice(2)}`),
    writable: true,
  });
}
if (typeof URL !== "undefined" && typeof URL.revokeObjectURL !== "function") {
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), writable: true });
}

if (typeof ImageData === "undefined") {
  class NodeImageDataLike {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace: string;
    constructor(data: Uint8ClampedArray | number, width?: number, height?: number) {
      if (data instanceof Uint8ClampedArray) {
        this.data = data;
        this.width = width as number;
        this.height = height as number;
      } else {
        this.width = data;
        this.height = width as number;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
      this.colorSpace = "srgb";
    }
  }
  Object.defineProperty(globalThis, "ImageData", { value: NodeImageDataLike, writable: true });
}

/**
 * When jsdom-like `createImageBitmap` is absent (Node test environments),
 * the jsQuash WASM modules cannot fetch their binary from a URL path — seed
 * each encode/decode submodule explicitly from node_modules. In the browser
 * the loaders resolve same-origin URLs automatically and this is skipped.
 */
export async function seedNodeWasmCodecs() {
  if (typeof createImageBitmap === "function") return false;

  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = await import("node:path");

  const wasmRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../node_modules");
  const wasm = async (relativePath: string): Promise<Uint8Array> =>
    new Uint8Array(await readFile(path.join(wasmRoot, relativePath)));

  const jpegEncode = await import("@jsquash/jpeg/encode.js");
  const jpegDecode = await import("@jsquash/jpeg/decode.js");
  const webpEncode = await import("@jsquash/webp/encode.js");
  const webpDecode = await import("@jsquash/webp/decode.js");
  const avifEncode = await import("@jsquash/avif/encode.js");
  const avifDecode = await import("@jsquash/avif/decode.js");
  const pngEncode = await import("@jsquash/png/encode.js");
  const pngDecode = await import("@jsquash/png/decode.js");

  await jpegEncode.init({ wasmBinary: await wasm("@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm") });
  await jpegDecode.init({ wasmBinary: await wasm("@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm") });
  await webpEncode.init({ wasmBinary: await wasm("@jsquash/webp/codec/enc/webp_enc.wasm") });
  await webpDecode.init({ wasmBinary: await wasm("@jsquash/webp/codec/dec/webp_dec.wasm") });
  await avifEncode.init({ wasmBinary: await wasm("@jsquash/avif/codec/enc/avif_enc.wasm") });
  await avifDecode.init({ wasmBinary: await wasm("@jsquash/avif/codec/dec/avif_dec.wasm") });
  await pngEncode.init(await wasm("@jsquash/png/codec/pkg/squoosh_png_bg.wasm"));
  await pngDecode.init(await wasm("@jsquash/png/codec/pkg/squoosh_png_bg.wasm"));

  return true;
}

// Codecs load from URL in browsers/jsdom only when the loader can fetch them;
// in plain Node (where our round-trip tests run) they must be seeded by bytes.
if (typeof document === "undefined") {
  await seedNodeWasmCodecs();
}
