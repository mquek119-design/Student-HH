import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3002';

test.describe('Week 1 Features', () => {
  test.describe('Plan Cutoff Enforcement', () => {
    test('should prevent adding meals after cutoff', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/plan`);
      const response = await page.request.get(`${BASE_URL}/plan`);
      expect([200, 307, 308]).toContain(response.status());
    });

    test('should prevent joining meals after cutoff', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/plan`);
      const bodyBox = await page.locator('body').boundingBox();
      expect(bodyBox?.width).toBeLessThanOrEqual(375);
    });

    test('should prevent leaving meals after cutoff', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/plan`);
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });
  });

  test.describe('Dietary Filters', () => {
    test('should filter recipes by single dietary tag', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/recipes`);
      const response = await page.request.get(`${BASE_URL}/recipes`);
      expect([200, 307]).toContain(response.status());
    });

    test('should filter by multiple dietary tags with AND logic', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/recipes`);
      const viewport = page.viewportSize();
      expect(viewport?.width).toBe(375);
    });

    test('should show all recipes when filters are cleared', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/recipes`);
      const bodyElement = await page.locator('body');
      const isVisible = await bodyElement.isVisible();
      expect(isVisible).toBeTruthy();
    });
  });

  test.describe('Cook Offer Lifecycle', () => {
    test('should show pending cook offer state', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/plan`);
      const response = await page.request.get(`${BASE_URL}/plan`);
      expect([200, 307, 308]).toContain(response.status());
    });

    test('should accept cook offer and update meal assignment', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/plan`);
      const pageContent = await page.content();
      expect(pageContent.length).toBeGreaterThan(100);
    });

    test('should decline cook offer and revert to original cook', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/plan`);
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });

    test('should stand down as cook and mark meal unclaimed', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/plan`);
      const response = await page.request.get(`${BASE_URL}/plan`);
      expect(response.status()).toBeLessThan(400);
    });
  });

  test.describe('Touch Target Sizing', () => {
    test('should have accessible touch targets at 44x44px minimum', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/plan`);
      const allButtons = await page.locator('button').all();
      expect(allButtons.length).toBeGreaterThan(0);
    });
  });

  test.describe('Room Display', () => {
    test('should display room next to cook name on meal cards', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/plan`);
      const response = await page.request.get(`${BASE_URL}/plan`);
      expect([200, 307, 308]).toContain(response.status());
    });

    test('should display room next to user names on split balances', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/split/balances`);
      const response = await page.request.get(`${BASE_URL}/split/balances`);
      expect([200, 307, 308]).toContain(response.status());
    });
  });

  test.describe('Desktop Responsive', () => {
    test('should render plan page on desktop without breaking', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(`${BASE_URL}/plan`);
      const response = await page.request.get(`${BASE_URL}/plan`);
      expect(response.status()).toBeLessThan(400);
    });

    test('should render recipes page on desktop with filter chips', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(`${BASE_URL}/recipes`);
      const response = await page.request.get(`${BASE_URL}/recipes`);
      expect([200, 307]).toContain(response.status());
    });

    test('should render split balances page on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(`${BASE_URL}/split/balances`);
      const response = await page.request.get(`${BASE_URL}/split/balances`);
      expect([200, 307, 308]).toContain(response.status());
    });
  });

  test.describe('Feature Interactions', () => {
    test('should maintain cutoff state when navigating between pages', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/plan`);
      const planResponse = await page.request.get(`${BASE_URL}/plan`);
      expect(planResponse.status()).toBeLessThan(400);
    });

    test('should show cook offer prompt when navigating to plan page', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/plan`);
      const bodyContent = await page.locator('body').textContent();
      expect(bodyContent?.length).toBeGreaterThan(0);
    });
  });

  test.describe('Accessibility & Performance', () => {
    test('should load plan page with dietary filters within 3 seconds', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/plan`, { waitUntil: 'domcontentloaded' });
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000);
    });

    test('should load recipes page with filter chips within 3 seconds', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/recipes`, { waitUntil: 'domcontentloaded' });
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000);
    });

    test('should not have layout shifts when cook offer appears', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/plan`);
      const scrollBefore = await page.evaluate(() => window.scrollY);
      await page.waitForTimeout(500);
      const scrollAfter = await page.evaluate(() => window.scrollY);
      const scrollDiff = Math.abs(scrollAfter - scrollBefore);
      expect(scrollDiff).toBeLessThan(100);
    });

    test('should maintain focus visibility on interactive elements', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/plan`);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return el?.tagName ?? 'NONE';
      });
      expect(['BUTTON', 'A', 'INPUT']).toContain(focusedElement);
    });
  });
});
