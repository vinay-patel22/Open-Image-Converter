import { describe, expect, it } from "vitest";
import { buildOutputName, outputExtension, stripExtension } from "../engine/naming";

describe("stripExtension", () => {
  it("strips only the final extension", () => {
    expect(stripExtension("archive.tar.png")).toBe("archive.tar");
    expect(stripExtension("photo.webp")).toBe("photo");
    expect(stripExtension("no-extension")).toBe("no-extension");
    expect(stripExtension(".hidden")).toBe(".hidden"); // dotfiles lose nothing
  });
});

describe("outputExtension", () => {
  it("maps the registry's first extension per format", () => {
    expect(outputExtension("jpeg")).toBe("jpg"); // jpeg output is named .jpg
    expect(outputExtension("png")).toBe("png");
    expect(outputExtension("webp")).toBe("webp");
    expect(outputExtension("avif")).toBe("avif");
  });
});

describe("buildOutputName", () => {
  it("swaps the extension and keeps the stem", () => {
    expect(buildOutputName("photo.png", "jpeg", "")).toBe("photo.jpg");
    expect(buildOutputName("photo.jpeg", "webp", "")).toBe("photo.webp");
    expect(buildOutputName("photo.heic", "png", "")).toBe("photo.png");
  });

  it("inserts the suffix before the extension", () => {
    expect(buildOutputName("photo.png", "png", "-convert")).toBe("photo-convert.png");
    expect(buildOutputName("photo.png", "webp", ".small [x] ")).toBe("photo.small [x].webp"); // bracket chars are Windows-safe; trimmed
  });

  it("resolves collisions for one batch with a shared takenNames set", () => {
    const taken = new Set<string>();
    expect(buildOutputName("shot.png", "webp", "", taken)).toBe("shot.webp");
    expect(buildOutputName("shot.png", "webp", "", taken)).toBe("shot-1.webp");
    expect(buildOutputName("shot.png", "webp", "", taken)).toBe("shot-2.webp");
  });

  it("independent batches do not collide with each other", () => {
    expect(buildOutputName("shot.png", "webp", "")).toBe("shot.webp");
    expect(buildOutputName("shot.png", "webp", "")).toBe("shot.webp");
  });

  it("sanitises Windows-unsafe characters", () => {
    expect(buildOutputName('a<b>:c*d?e"f<g>h|i', "png", "")).toBe("abcdefghi.png");
    expect(buildOutputName("path/to\\file.png", "jpeg", "")).toBe("pathtofile.jpg");
    expect(buildOutputName("summer #2024?", "png", "")).toBe("summer 2024.png");
  });

  it('falls back to "image" when sanitising empties the base', () => {
    expect(buildOutputName("?.png", "png", "")).toBe("image.png");
    expect(buildOutputName(" .png", "webp", "")).toBe("image.webp");
  });

  it("caps names at 200 characters including the extension", () => {
    const long = buildOutputName("a".repeat(300), "webp", "");
    expect(long.length).toBeLessThanOrEqual(200);
    expect(long.endsWith(".webp")).toBe(true);
  });
});
