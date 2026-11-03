import { describe, expect, it } from "vitest";
import { formatBytes } from "../lib/formatBytes";

describe("formatBytes", () => {
  it("formats exact units without decimals under 10 or in bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("formats KB/MB with one decimal", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("uses no decimals at large magnitudes", () => {
    expect(formatBytes(15 * 1024 * 1024)).toBe("15 MB");
  });

  it("is defensive against invalid input", () => {
    expect(formatBytes(-5)).toBe("—");
    expect(formatBytes(NaN)).toBe("—");
  });
});
