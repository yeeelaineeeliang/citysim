import { expect, test } from "@playwright/test";

/**
 * Journey e2e — demo mode runs entirely on canned data (lib/demoData.ts), so
 * no API mocks are needed for the cinematic run itself. /api/opening is mocked
 * for the debrief screen's month-change fetches (demo mode short-circuits most
 * of them client-side, but the mock keeps any stragglers instant).
 */
test.describe("Redesigned journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/opening", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ response: "The season opens quietly in Hyde Park." }),
      });
    });
  });

  test("demo shows the season ticket, then Begin starts the year", async ({ page }) => {
    await page.goto("/sim?demo=1");

    // Season-ticket interstitial is the default idle view
    const begin = page.getByRole("button", { name: /begin your year/i });
    await expect(begin).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/your year in/i).first()).toBeVisible();

    await begin.click();

    // Cinematic act 1 starts
    await expect(page.getByText("Spring · Morning")).toBeVisible({ timeout: 15_000 });
    // Back exits the run
    const back = page.getByRole("button", { name: /back/i }).first();
    await expect(back).toBeVisible();
  });

  test("demo autorun starts the cinematic run without interaction", async ({ page }) => {
    await page.goto("/sim?demo=1&autorun=1");

    await expect(page.getByText("Spring · Morning")).toBeVisible({ timeout: 20_000 });
    // No interstitial button present
    await expect(page.getByRole("button", { name: /begin your year/i })).toHaveCount(0);
  });

  test("skip leads to the Q&A screen with working grounded answers", async ({ page }) => {
    await page.goto("/sim?demo=1");

    await page.getByRole("button", { name: /skip the film/i }).click();

    // Two-panel screen with the ask header (no completed run → not "debrief")
    await expect(page.getByText(/ask sam about hyde park/i)).toBeVisible({ timeout: 10_000 });

    // Grounded demo answer + map action
    await page.getByRole("button", { name: /what can i do on weekends here/i }).first().click();
    await expect(page.getByText(/Hyde Park entertainment|restaurants/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".leaflet-container").first()).toBeVisible();
  });

  test("season chips set the chat season context", async ({ page }) => {
    await page.goto("/sim?demo=1");
    await page.getByRole("button", { name: /skip the film/i }).click();

    await page.getByRole("button", { name: /^winter$/i }).click();
    await expect(page.getByText(/winter · january/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("run-your-year button in the header starts the cinematic run", async ({ page }) => {
    await page.goto("/sim?demo=1");
    await page.getByRole("button", { name: /skip the film/i }).click();

    await page.getByRole("button", { name: /live the year/i }).click();
    await expect(page.getByText("Spring · Morning")).toBeVisible({ timeout: 15_000 });
  });

  test("links back to the profile page from the simulation header", async ({ page }) => {
    await page.goto("/sim?demo=1");
    await page.getByRole("button", { name: /skip the film/i }).click();

    await page.getByRole("link", { name: /back to profile/i }).click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { name: /give the city your point of view/i })).toBeVisible();
  });
});
