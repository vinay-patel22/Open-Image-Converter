/**
 * Generates committed test fixtures with REAL codecs (jsQuash WASM) — no
 * hand-crafted pixels. Also emits the tiny AVIF probe used at runtime to
 * detect native AVIF decoding support in the browser (ARCHITECTURE §5.2).
 *
 *   node scripts/generate-fixtures.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL(".", import.meta.url)));

// Node lacks ImageData; all jsQuash codecs only need { data, width, height }.
globalThis.ImageData = class {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
    this.colorSpace = "srgb";
  }
};

const wasmsBinary = (rel) => new Uint8Array(readFileSync(path.join(root, rel)));

async function loadEmscriptenEncoder(packageName, wasmRel) {
  // init() lives on the encode.js submodule, not the package index.
  const encoderModule = await import(`${packageName}/encode.js`);
  try {
    await encoderModule.init({ wasmBinary: wasmsBinary(wasmRel) });
  } catch {
    // Older wrappers take a WebAssembly.Module directly.
    const mod = await WebAssembly.compile(wasmsBinary(wasmRel));
    await encoderModule.init(mod);
  }
  return encoderModule.default; // encode(ImageData, options?)
}

function makeGradientImage(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = (x / width) * 255;
      data[i + 1] = (y / height) * 255;
      data[i + 2] = 128;
      // transparent 6px corner block — drives transparency tests
      data[i + 3] = x < 6 && y < 6 ? 0 : 255;
    }
  }
  return { data, width, height };
}

async function main() {
  const fixtureDir = path.join(root, "src/test/fixtures");
  await mkdir(fixtureDir, { recursive: true });

  const image = makeGradientImage(24, 24);

  // --- PNG (wasm-pack loader: hand it the wasm bytes in Node) ---------------
  const pngEncoderModule = await import("@jsquash/png/encode.js");
  await pngEncoderModule.init(wasmsBinary("node_modules/@jsquash/png/codec/pkg/squoosh_png_bg.wasm"));
  const pngBytes = new Uint8Array(await pngEncoderModule.default(image));
  await writeFile(path.join(fixtureDir, "sample-alpha.png"), pngBytes);
  console.log("png:", pngBytes.length, "bytes");

  // --- JPEG ----------------------------------------------------------------
  const jpegEncode = await loadEmscriptenEncoder("@jsquash/jpeg", "node_modules/@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm");
  const jpegBytes = new Uint8Array(await jpegEncode(image, { quality: 80 }));
  await writeFile(path.join(fixtureDir, "sample.jpg"), jpegBytes);
  console.log("jpeg:", jpegBytes.length, "bytes");

  // --- WebP ----------------------------------------------------------------
  const webpEncode = await loadEmscriptenEncoder("@jsquash/webp", "node_modules/@jsquash/webp/codec/enc/webp_enc.wasm");
  const webpBytes = new Uint8Array(await webpEncode(image, { quality: 80 }));
  await writeFile(path.join(fixtureDir, "sample.webp"), webpBytes);
  console.log("webp:", webpBytes.length, "bytes");

  // --- AVIF (larger sample may be slow; keep tiny) --------------------------
  console.time("avif-layer");
  const avifEncode = await loadEmscriptenEncoder("@jsquash/avif", "node_modules/@jsquash/avif/codec/enc/avif_enc.wasm");
  const avifBytes = new Uint8Array(await avifEncode(image, { quality: 60, speed: 10 }));
  await writeFile(path.join(fixtureDir, "sample.avif"), avifBytes);
  console.timeEnd("avif-layer");
  console.log("avif:", avifBytes.length, "bytes");

  // --- tiny AVIF for the browser-native decode probe ------------------------
  console.time("avif-probe");
  const tinyBytes = new Uint8Array(await avifEncode({ data: new Uint8ClampedArray(5 * 5 * 4).fill(200), width: 5, height: 5 }, { quality: 30, speed: 10 }));
  const probeModulePath = path.join(root, "src/engine/codecs/avif-probe.ts");
  await mkdir(path.dirname(probeModulePath), { recursive: true });
  await writeFile(
    probeModulePath,
    `/**
 * Tiny (5x5) AVIF, generated with @jsquash/avif by scripts/generate-fixtures.mjs.
 * Used once per session to detect whether the browser can decode AVIF
 * natively (createImageBitmap) before falling back to the WASM decoder.
 * Regenerate: node scripts/generate-fixtures.mjs
 */
export const TINY_AVIF_BASE64 = "${Buffer.from(tinyBytes).toString("base64")}";
`,
  );
  console.timeEnd("avif-probe");
  console.log("avif probe:", tinyBytes.length, "bytes");

  console.log("fixtures written to", fixtureDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
