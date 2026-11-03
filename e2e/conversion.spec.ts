import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end conversion flows against the production build + strict CSP.
 * Fixtures under src/test/fixtures are real codec-generated images.
 */

const FIXTURES = path.join(import.meta.dirname, "..", "src", "test", "fixtures");
const TMP = path.join(import.meta.dirname, "tmp-downloads");

function fileInput(page: Page) {
  return page.locator('input[type="file"]');
}

function formatChip(page: Page, label: string) {
  return page.getByRole("radio", { name: label, exact: true });
}

/**
 * Privacy rule #4 (PRD §3): everything runs locally. Every outgoing HTTP
 * request must go to the app origin itself. CSP violations surface as console
 * errors and are treated as failures too.
 */
function trackExternalTraffic(page: Page) {
  const violations: string[] = [];
  const origin = "http://localhost:4173";
  page.on("request", (request) => {
    const url = request.url();
    const local =
      url.startsWith(origin) ||
      url.startsWith("data:") ||
      url.startsWith("blob:") ||
      url.startsWith("about:");
    if (!local) violations.push(url);
  });
  page.on("console", (message) => {
    if (message.type() === "error" && /Content-Security-Policy/i.test(message.text())) {
      violations.push(`CSP violation: ${message.text()}`);
    }
  });
  return violations;
}

test.beforeEach(() => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
});

test.afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

test("T1 · PNG → WebP converts through the UI, downloads real WebP bytes, and requests nothing external", async ({
  page,
}) => {
  const external = trackExternalTraffic(page);
  await page.goto("/");

  await fileInput(page).setInputFiles(path.join(FIXTURES, "sample-alpha.png"));
  await expect(page.getByText("sample-alpha.png")).toBeVisible();

  await formatChip(page, "WebP").click();
  await page.getByRole("button", { name: /Convert All/ }).click();

  // Result row appears with its own name and size, then MIME from the blob.
  await expect(page.getByText(/sample-alpha\.webp ·/)).toBeVisible({ timeout: 30_000 });

  const downloadButton = page.getByRole("button", { name: /Download sample-alpha/ });
  await expect(downloadButton).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), downloadButton.click()]);
  const target = path.join(TMP, download.suggestedFilename());
  await download.saveAs(target);

  expect(download.suggestedFilename()).toBe("sample-alpha.webp");
  const bytes = readFileSync(target);
  expect(bytes.length).toBeGreaterThan(50);
  expect(bytes.subarray(0, 4).toString("latin1")).toBe("RIFF");
  expect(bytes.subarray(8, 12).toString("latin1")).toBe("WEBP");

  expect(external).toEqual([]);
});

test("T2 · PNG with transparency → JPG shows the transparency-loss warning, never silently", async ({ page }) => {
  trackExternalTraffic(page);
  await page.goto("/");

  await fileInput(page).setInputFiles(path.join(FIXTURES, "sample-alpha.png"));
  await formatChip(page, "JPG").click();
  await page.getByRole("button", { name: /Convert All/ }).click();

  // Preflight (suspected) or worker (confirmed) warning must appear and stay.
  await expect(
    page.getByText(/Transparency (was removed|may contain transparency)/),
  ).toBeVisible({ timeout: 30_000 });
  // The confirmed message must eventually replace the tentative one.
  await expect(page.getByText(/Transparency was removed/)).toBeVisible({ timeout: 30_000 });
  // And the item still completes — a warning, not a refusal.
  await expect(page.getByText(/sample\.jpg|sample-alpha\.jpg ·/)).toBeVisible({ timeout: 30_000 });
});

test("T3 · an unrecognised file shows an honest error and Convert All stays disabled", async ({ page }) => {
  trackExternalTraffic(page);
  await page.goto("/");

  const garbage = path.join(TMP, "fake-image.png");
  writeFileSync(garbage, Buffer.from("NOT An IMAGE, just text bytes pretending to be png"));

  await fileInput(page).setInputFiles(garbage);
  await expect(page.getByText(/could not be recognised as a supported image format/i)).toBeVisible();
  await expect(page.getByText("Unknown")).toBeVisible();

  const convertAll = page.getByRole("button", { name: /Convert All/ });
  await expect(convertAll).toBeDisabled();
});

test("T3b · a signature-valid but corrupt PNG reports the conversion failure path", async ({ page }) => {
  trackExternalTraffic(page);
  await page.goto("/");

  // Real PNG signature + garbage body: it passes sniffing (that is honest),
  // enters the queue, and must fail loudly at decode — never fake success.
  const corrupt = path.join(TMP, "corrupt.png");
  writeFileSync(corrupt, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 0xff)]));

  await fileInput(page).setInputFiles(corrupt);
  await expect(page.locator('span').filter({ hasText: "Ready" }).first()).toBeVisible();

  await page.getByRole("button", { name: /Convert All/ }).click();
  await expect(page.getByText(/Conversion failed/i)).toBeVisible({ timeout: 30_000 });
});

test("T4 · batch conversion with Download All produces a valid ZIP with all converted files", async ({ page }) => {
  const external = trackExternalTraffic(page);
  await page.goto("/");

  // Upload two different files
  await fileInput(page).setInputFiles([
    path.join(FIXTURES, "sample-alpha.png"),
    path.join(FIXTURES, "sample.jpg"),
  ]);

  await formatChip(page, "WebP").click();
  await page.getByRole("button", { name: /Convert All/ }).click();

  // Wait for both to complete
  await expect(page.getByText(/sample-alpha\.webp/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/sample\.webp/)).toBeVisible({ timeout: 30_000 });

  // Download All should appear
  const downloadAllButton = page.getByRole("button", { name: /Download All/ });
  await expect(downloadAllButton).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), downloadAllButton.click()]);
  const target = path.join(TMP, download.suggestedFilename());
  await download.saveAs(target);

  expect(download.suggestedFilename()).toBe("converted-images.zip");
  const zipBytes = readFileSync(target);
  expect(zipBytes.length).toBeGreaterThan(100);

  // Verify ZIP structure and contents
  const unzipped = unzipSync(zipBytes);
  const filenames = Object.keys(unzipped);
  expect(filenames).toHaveLength(2);
  expect(filenames).toContain("sample-alpha.webp");
  expect(filenames).toContain("sample.webp");

  // Verify WebP signatures inside the ZIP
  const sampleAlphaWebp = unzipped["sample-alpha.webp"];
  const sampleWebp = unzipped["sample.webp"];
  expect(Buffer.from(sampleAlphaWebp.subarray(0, 4)).toString("latin1")).toBe("RIFF");
  expect(Buffer.from(sampleAlphaWebp.subarray(8, 12)).toString("latin1")).toBe("WEBP");
  expect(Buffer.from(sampleWebp.subarray(0, 4)).toString("latin1")).toBe("RIFF");
  expect(Buffer.from(sampleWebp.subarray(8, 12)).toString("latin1")).toBe("WEBP");

  expect(external).toEqual([]);
});

test("T5 · cancellation mid-batch stops conversion and marks in-flight items as cancelled", async ({ page }) => {
  const external = trackExternalTraffic(page);
  await page.goto("/");

  // Upload multiple files to give cancellation time to act
  await fileInput(page).setInputFiles([
    path.join(FIXTURES, "sample-alpha.png"),
    path.join(FIXTURES, "sample.jpg"),
    path.join(FIXTURES, "sample.webp"),
  ]);

  await formatChip(page, "AVIF").click();
  await page.getByRole("button", { name: /Convert All/ }).click();

  // Wait for conversion to start (progress bar appears)
  await expect(page.getByRole("progressbar")).toBeVisible({ timeout: 5000 });

  // Cancel immediately
  await page.getByRole("button", { name: /Cancel/ }).click();

  // Progress bar should disappear
  await expect(page.getByRole("progressbar")).not.toBeVisible({ timeout: 5000 });

  // Items should be in ready or cancelled state, not processing
  await expect(page.getByText(/Decoding|Encoding/)).not.toBeVisible();
  await expect(page.getByText(/Cancelled/).first()).toBeVisible();

  expect(external).toEqual([]);
});

test("T6 · Clear all removes all items from the queue", async ({ page }) => {
  const external = trackExternalTraffic(page);
  await page.goto("/");

  // Upload two files
  await fileInput(page).setInputFiles([
    path.join(FIXTURES, "sample-alpha.png"),
    path.join(FIXTURES, "sample.jpg"),
  ]);

  await formatChip(page, "WebP").click();
  await page.getByRole("button", { name: /Convert All/ }).click();

  // Wait for completion
  await expect(page.getByText(/sample-alpha\.webp/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/sample\.webp/)).toBeVisible({ timeout: 30_000 });

  // Clear all button should be visible
  const clearAllButton = page.getByRole("button", { name: /Clear all/ });
  await expect(clearAllButton).toBeVisible();

  // Click clear all
  await clearAllButton.click();

  // Both items should be removed
  await expect(page.getByText(/sample-alpha\.webp/)).not.toBeVisible();
  await expect(page.getByText(/sample\.webp/)).not.toBeVisible();

  // Queue should be empty (no items in the list)
  await expect(page.locator("ul").getByRole("listitem")).toHaveCount(0);

  expect(external).toEqual([]);
});

test("T7 · duplicate filenames get disambiguated with -1, -2 suffixes in ZIP", async ({ page }) => {
  const external = trackExternalTraffic(page);
  await page.goto("/");

  // Upload the same file twice (user may legitimately want two conversions)
  await fileInput(page).setInputFiles([
    path.join(FIXTURES, "sample-alpha.png"),
    path.join(FIXTURES, "sample-alpha.png"),
  ]);

  await formatChip(page, "WebP").click();
  await page.getByRole("button", { name: /Convert All/ }).click();

  // Wait for both to complete
  await expect(page.getByText(/sample-alpha\.webp/)).toBeVisible({ timeout: 30_000 });

  // Download All
  const downloadAllButton = page.getByRole("button", { name: /Download All/ });
  await expect(downloadAllButton).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), downloadAllButton.click()]);
  const target = path.join(TMP, download.suggestedFilename());
  await download.saveAs(target);

  const zipBytes = readFileSync(target);
  const unzipped = unzipSync(zipBytes);

  // Should have two files with disambiguated names
  const filenames = Object.keys(unzipped);
  expect(filenames).toHaveLength(2);
  expect(filenames).toContain("sample-alpha.webp");
  expect(filenames).toContain("sample-alpha-1.webp");

  expect(external).toEqual([]);
});
