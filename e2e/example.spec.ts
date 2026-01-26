import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/DanSarp Herbal Centre/);
});

test("navigation works", async ({ page }) => {
  await page.goto("/");
  await page.click('text="About"');
  await expect(page).toHaveURL(/.*about/);
});
