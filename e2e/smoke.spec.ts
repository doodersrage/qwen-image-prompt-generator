import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /ComfyUI Image Prompt Generator/i })).toBeVisible();
});

test("studio page loads", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: /Prompt Studio/i })).toBeVisible();
});
