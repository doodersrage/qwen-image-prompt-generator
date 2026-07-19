import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /ComfyUI Image Prompt Generator/i })).toBeVisible();
});

test("settings page loads", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: /Settings & Health/i })).toBeVisible();
  await expect(page.getByText(/Avoided tokens/i)).toBeVisible();
});

test("studio analytics tab loads", async ({ page }) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: /Analytics/i }).click();
  await expect(page.getByRole("heading", { name: /Gallery rating analytics/i })).toBeVisible();
});
