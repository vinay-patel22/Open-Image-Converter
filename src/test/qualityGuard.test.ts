import { describe, expect, it } from "vitest";
import { deriveWarnings, mergeWarnings, type GuardInput } from "../engine/qualityGuard";
import type { ProbeResult } from "../engine/inspect/probe";

const ALPHA_PNG_PROBE: ProbeResult = {
  bitDepth: 8,
  alphaChannelSuspected: true,
  animationSuspected: false,
  frameCount: null,
  metadataSuspected: false,
  iccSuspected: false,
  exifOrientation: null,
};

const CLEAN_PROBE: ProbeResult = {
  bitDepth: 8,
  alphaChannelSuspected: false,
  animationSuspected: false,
  frameCount: null,
  metadataSuspected: false,
  iccSuspected: false,
  exifOrientation: null,
};

function guardInput(overrides: Partial<GuardInput> = {}): GuardInput {
  return {
    inputFormat: "png",
    outputFormat: "jpeg",
    probe: ALPHA_PNG_PROBE,
    dimensions: { width: 1000, height: 1000 },
    resize: { enabled: false, maxSide: 2048 },
    confirmedAlpha: null,
    ...overrides,
  };
}

describe("deriveWarnings — transparency", () => {
  it("warns (suspected) when the probe saw alpha and the target has none", () => {
    const warnings = deriveWarnings(guardInput());
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("may contain transparency");
    expect(warnings[0]).toContain("fill transparent areas with white");
  });

  it("escalates to a confirmed removal message once pixels prove it", () => {
    const warnings = deriveWarnings(guardInput({ confirmedAlpha: true }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Transparency was removed");
    expect(warnings[0]).toContain("filled with white");
  });

  it("stays silent when the pixel scan rules alpha out (suspected was a false lead)", () => {
    const warnings = deriveWarnings(guardInput({ confirmedAlpha: false }));
    expect(warnings).toHaveLength(0);
  });

  it("never warns about transparency when the output keeps it", () => {
    for (const outputFormat of ["png", "webp", "avif"] as const) {
      const warnings = deriveWarnings(guardInput({ outputFormat, confirmedAlpha: true }));
      expect(warnings.some((w) => w.toLowerCase().includes("transparency"))).toBe(false);
    }
  });
});

describe("deriveWarnings — animation, bit depth, ICC, metadata", () => {
  it("warns that animation is collapsed to the first frame", () => {
    const warnings = deriveWarnings(
      guardInput({
        probe: { ...ALPHA_PNG_PROBE, alphaChannelSuspected: false, animationSuspected: true },
        outputFormat: "webp",
      }),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Animated PNG");
    expect(warnings[0]).toContain("first frame");
  });

  it("includes frame count in animation warning when available", () => {
    const warnings = deriveWarnings(
      guardInput({
        probe: { ...ALPHA_PNG_PROBE, alphaChannelSuspected: false, animationSuspected: true, frameCount: 12 },
        outputFormat: "webp",
      }),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("(12 frames)");
  });

  it("warns for 16-bit sources but not for 8-bit or unknown depths", () => {
    const bit16 = deriveWarnings(
      guardInput({ probe: { ...ALPHA_PNG_PROBE, alphaChannelSuspected: false, bitDepth: 16, frameCount: null }, outputFormat: "png" }),
    );
    expect(bit16).toHaveLength(1);
    expect(bit16[0]).toContain("8-bit");

    for (const depth of [8, null]) {
      const warnings = deriveWarnings(
        guardInput({ probe: { ...ALPHA_PNG_PROBE, alphaChannelSuspected: false, bitDepth: depth, frameCount: null }, outputFormat: "png" }),
      );
      expect(warnings).toHaveLength(0);
    }
  });

  it("warns separately about ICC and EXIF/XMP loss", () => {
    const warnings = deriveWarnings(
      guardInput({
        probe: { ...CLEAN_PROBE, metadataSuspected: true, iccSuspected: true, frameCount: null },
        outputFormat: "jpeg",
      }),
    );
    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.includes("colour profile"))).toBe(true);
    expect(warnings.some((w) => w.includes("EXIF/XMP"))).toBe(true);
  });

  it("adds no facts-based warnings when the probe is fully clean", () => {
    const warnings = deriveWarnings(guardInput({ probe: CLEAN_PROBE, outputFormat: "png" }));
    expect(warnings).toHaveLength(0);
  });

  it("reports confirmed alpha even without a probe (AVIF/JPEG have no sniff-flag path)", () => {
    const warnings = deriveWarnings(guardInput({ probe: null, confirmedAlpha: true, inputFormat: "avif" }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("AVIF contained transparent pixels");
  });
});

describe("deriveWarnings — resize", () => {
  it("announces the exact fitted dimensions", () => {
    const warnings = deriveWarnings(
      guardInput({
        probe: CLEAN_PROBE,
        dimensions: { width: 4000, height: 2000 },
        resize: { enabled: true, maxSide: 2048 },
      }),
    );
    expect(warnings.some((w) => w.includes("Resized to 2048 × 1024 px to fit 2048 px"))).toBe(true);
  });

  it("stays silent when resize would not shrink (or is disabled)", () => {
    const enabledNoShrink = deriveWarnings(
      guardInput({
        probe: CLEAN_PROBE,
        dimensions: { width: 1000, height: 1000 },
        resize: { enabled: true, maxSide: 2048 },
      }),
    );
    expect(enabledNoShrink).toHaveLength(0);

    const disabled = deriveWarnings(
      guardInput({
        probe: CLEAN_PROBE,
        dimensions: { width: 4000, height: 4000 },
        resize: { enabled: false, maxSide: 2048 },
      }),
    );
    expect(disabled).toHaveLength(0);
  });
});

describe("mergeWarnings", () => {
  it("de-duplicates identical warnings", () => {
    expect(mergeWarnings(["Same warning"], ["Same warning"])).toEqual(["Same warning"]);
  });

  it("keeps the union of distinct warnings", () => {
    expect(mergeWarnings(["A"], ["B"])).toEqual(["A", "B"]);
  });

  it("replaces the suspected transparency draft with the confirmed removal notice", () => {
    const suspected = "PNG may contain transparency. JPG does not support it and will fill transparent areas with white.";
    const confirmed = "Transparency was removed: PNG contained transparent pixels and JPG does not support them — those areas were filled with white.";
    expect(mergeWarnings([suspected], [confirmed])).toEqual([confirmed]);
  });
});
