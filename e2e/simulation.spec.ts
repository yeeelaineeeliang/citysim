import { expect, test } from "@playwright/test";

test.describe("Simulation avatar scene", () => {
  test.beforeEach(async ({ page }) => {
    // Mock sim-month to return instantly without real API calls
    await page.route("**/api/sim-month", async (route) => {
      const body = [
        `data: ${JSON.stringify({ type: "tools", mapActions: [] })}`,
        "",
        `data: ${JSON.stringify({ type: "chunk", text: "October in Hyde Park. The streets are quiet and the trees are turning gold." })}`,
        "",
        `data: ${JSON.stringify({ type: "done" })}`,
        "",
      ].join("\n");
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        body,
      });
    });

    // Mock opening to return quickly
    await page.route("**/api/opening", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ response: "October opens quietly in Hyde Park." }),
      });
    });
  });

  test("starts simulation and renders avatar scene with mini-map", async ({ page }) => {
    await page.goto("/sim?demo=1");

    // Wait for the hero overlay run button (there is also one in the footer — target first)
    const runBtn = page.getByRole("button", { name: /run my year in/i }).first();
    await expect(runBtn).toBeVisible({ timeout: 10_000 });

    // Start the simulation
    await runBtn.click();

    // The auto-run wrapper should appear
    const scene = page.locator('[data-testid="sim-avatar-scene"]');
    await expect(scene).toBeVisible({ timeout: 15_000 });

    // The main Leaflet map container should be in the DOM
    const leafletContainer = scene.locator(".leaflet-container").first();
    await expect(leafletContainer).toBeVisible({ timeout: 10_000 });

    // The mini-map HUD should be present
    const miniMap = page.locator('[data-testid="mini-map"]');
    await expect(miniMap).toBeVisible();

    // DailyLifePanel narrative should appear (any non-empty text inside the panel)
    const narrative = page.locator("text=Hyde Park").first();
    await expect(narrative).toBeVisible({ timeout: 10_000 });

    // Exit button should be present and clickable
    const exitBtn = page.getByRole("button", { name: /exit/i });
    await expect(exitBtn).toBeVisible();
    await exitBtn.click();

    // After exit, the normal sim layout returns (run button reappears)
    await expect(runBtn).toBeVisible({ timeout: 5_000 });
  });
});
