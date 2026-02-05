/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * E2E Tests for Configuration Dashboards
 * Tests the complete workflow: upload → configure → convert → result
 */

import { test, expect } from '@playwright/test';
import path from 'path';

// Test fixture files
const TEST_FILES = {
  image1: path.join(__dirname, '../fixtures/test-image-1.jpg'),
  image2: path.join(__dirname, '../fixtures/test-image-2.jpg'),
  pdf1: path.join(__dirname, '../fixtures/test-pdf-1.pdf'),
  pdf2: path.join(__dirname, '../fixtures/test-pdf-2.pdf'),
};

test.describe('Configuration Dashboards E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('Image to PDF - Full workflow with configuration', async ({ page }) => {
    // Navigate to Image to PDF tool
    await page.click('text=Image to PDF');

    // Upload images
    await page.setInputFiles('input[type="file"]', [TEST_FILES.image1, TEST_FILES.image2]);

    // Verify files are shown
    await expect(page.locator('text=Selected Images (2)')).toBeVisible();

    // Click Configure & Convert button
    await page.click('text=Configure & Convert to PDF');

    // Verify configuration dashboard is shown
    await expect(page.locator('text=Image to PDF Configuration')).toBeVisible();

    // Select landscape orientation
    await page.click('text=Landscape');

    // Select Letter page size
    await page.click('button:has-text("Letter")');

    // Select medium margin
    await page.click('button:has-text("Medium")');

    // Select high quality
    await page.click('button:has-text("High Quality")');

    // Verify settings are applied (check for green borders indicating selection)
    const landscapeButton = page.locator('button:has-text("Landscape")');
    await expect(landscapeButton).toHaveCSS('border-color', /4CAF50/);

    // Click Convert to PDF button
    await page.click('text=Convert to PDF →');

    // Wait for conversion to complete
    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Your images have been converted to PDF successfully')).toBeVisible();
  });

  test('Merge PDF - Full workflow with drag & drop reordering', async ({ page }) => {
    // Navigate to Merge PDF tool
    await page.click('text=Merge PDF');

    // Upload PDFs
    await page.setInputFiles('input[type="file"]', [TEST_FILES.pdf1, TEST_FILES.pdf2]);

    // Verify files are shown
    await expect(page.locator('text=Selected Files (2)')).toBeVisible();

    // Click Configure & Merge button
    await page.click('text=Configure & Merge PDFs');

    // Verify configuration dashboard
    await expect(page.locator('text=Merge PDF Configuration')).toBeVisible();

    // Test drag & drop reordering (simulate moving second file to first position)
    const firstFile = page.locator('.draggable-item').first();
    const secondFile = page.locator('.draggable-item').nth(1);

    // Use arrow buttons to reorder
    await page.click('button[title="Move up"]');

    // Click Merge PDFs button
    await page.click('text=Merge PDFs →');

    // Wait for success
    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Your PDFs have been merged successfully')).toBeVisible();
  });

  test('Compress PDF - Configuration options', async ({ page }) => {
    // Navigate to Compress PDF tool
    await page.click('text=Compress PDF');

    // Upload PDF
    await page.setInputFiles('input[type="file"]', TEST_FILES.pdf1);

    // Click Configure & Compress button
    await page.click('text=Configure & Compress');

    // Verify configuration dashboard
    await expect(page.locator('text=Compress PDF')).toBeVisible();

    // Select high compression
    await page.click('button:has-text("High Compression")');

    // Enable optimize images
    await page.check('input[type="checkbox"]:near(:text("Optimize images"))');

    // Enable remove metadata
    await page.check('input[type="checkbox"]:near(:text("Remove metadata"))');

    // Click Compress button
    await page.click('text=Compress PDF →');

    // Wait for success
    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });
  });

  test('Rotate PDF - Page selection and rotation', async ({ page }) => {
    // Navigate to Rotate PDF tool
    await page.click('text=Rotate PDF');

    // Upload PDF
    await page.setInputFiles('input[type="file"]', TEST_FILES.pdf1);

    // Click Configure & Rotate button
    await page.click('text=Configure & Rotate');

    // Verify configuration dashboard
    await expect(page.locator('text=Rotate PDF')).toBeVisible();

    // Select 90° rotation
    await page.click('button:has-text("90° Clockwise")');

    // Select specific pages
    await page.click('text=Specific pages');

    // Enter page numbers
    await page.fill('input[placeholder*="1,3-5"]', '1,2,3');

    // Click Rotate button
    await page.click('text=Rotate PDF →');

    // Wait for success
    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });
  });

  test('Split PDF - Multiple split modes', async ({ page }) => {
    // Navigate to Split PDF tool
    await page.click('text=Split PDF');

    // Upload PDF
    await page.setInputFiles('input[type="file"]', TEST_FILES.pdf1);

    // Click Configure & Split button
    await page.click('text=Configure & Split');

    // Verify configuration dashboard
    await expect(page.locator('text=Split PDF')).toBeVisible();

    // Test range mode
    await page.click('text=By Page Ranges');
    await page.fill('input[placeholder*="1-3, 5-7"]', '1-2, 3-4');

    // Select separate files output
    await page.click('text=Separate files');

    // Click Split button
    await page.click('text=Split PDF →');

    // Wait for success
    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });
  });

  test('PDF to JPG - Format and quality settings', async ({ page }) => {
    // Navigate to PDF to JPG tool
    await page.click('text=PDF to JPG');

    // Upload PDF
    await page.setInputFiles('input[type="file"]', TEST_FILES.pdf1);

    // Click Configure & Convert button
    await page.click('text=Configure & Convert');

    // Verify configuration dashboard
    await expect(page.locator('text=PDF to Image')).toBeVisible();

    // Select PNG format
    await page.click('button:has-text("PNG")');

    // Select 300 DPI
    await page.click('button:has-text("300 DPI")');

    // Select grayscale
    await page.click('button:has-text("Grayscale")');

    // Adjust quality slider
    await page.locator('input[type="range"]').fill('95');

    // Select page range
    await page.click('text=Specific pages');
    await page.fill('input[placeholder*="1-5"]', '1,2,3');

    // Click Convert button
    await page.click('text=Convert →');

    // Wait for success
    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });
  });

  test('Configuration persistence - Settings saved across sessions', async ({ page }) => {
    // Navigate to Image to PDF tool
    await page.click('text=Image to PDF');
    await page.setInputFiles('input[type="file"]', TEST_FILES.image1);
    await page.click('text=Configure & Convert to PDF');

    // Set configuration
    await page.click('text=Landscape');
    await page.click('button:has-text("A3")');

    // Cancel and go back
    await page.click('text=Cancel');

    // Upload again and open config
    await page.click('text=Configure & Convert to PDF');

    // Verify settings are persisted
    const landscapeButton = page.locator('button:has-text("Landscape")');
    await expect(landscapeButton).toHaveCSS('border-color', /4CAF50/);

    const a3Button = page.locator('button:has-text("A3")');
    await expect(a3Button).toHaveCSS('border-color', /4CAF50/);
  });

  test('Error handling - Invalid configuration', async ({ page }) => {
    // Navigate to Split PDF tool
    await page.click('text=Split PDF');
    await page.setInputFiles('input[type="file"]', TEST_FILES.pdf1);
    await page.click('text=Configure & Split');

    // Select extract mode but don't enter pages
    await page.click('text=Extract Pages');

    // Try to split without entering pages
    await page.click('text=Split PDF →');

    // Should show error message
    await expect(page.locator('text=Please enter page numbers')).toBeVisible();
  });

  test('Cancel configuration - Returns to upload step', async ({ page }) => {
    // Navigate to Compress PDF tool
    await page.click('text=Compress PDF');
    await page.setInputFiles('input[type="file"]', TEST_FILES.pdf1);
    await page.click('text=Configure & Compress');

    // Verify in config step
    await expect(page.locator('text=Compress PDF')).toBeVisible();

    // Click cancel
    await page.click('text=Cancel');

    // Should return to upload step
    await expect(page.locator('text=Configure & Compress')).toBeVisible();
    await expect(page.locator('text=Select Different PDF')).toBeVisible();
  });
});
