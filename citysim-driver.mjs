import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Capture console errors
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

console.log('Navigating to app...');
await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
await page.screenshot({ path: '/tmp/citysim-1-home.png', fullPage: false });
console.log('Screenshot 1: home page taken');

// Look for simulation-related buttons or elements
const content = await page.content();
const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
console.log('Page text preview:', bodyText.substring(0, 500));

// Look for "Run" or "Simulate" or "Start" buttons
const buttons = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(t => t)
);
console.log('Buttons found:', buttons);

// Try clicking a Run Simulation / Run Month button if visible
const runBtn = page.locator('button').filter({ hasText: /run|simulate|start sim/i }).first();
const runCount = await runBtn.count();
if (runCount > 0) {
  console.log('Clicking run button...');
  await runBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/citysim-2-running.png', fullPage: false });
  console.log('Screenshot 2: after clicking run');

  // Wait a bit for animation
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/citysim-3-after.png', fullPage: false });
  console.log('Screenshot 3: simulation in progress');
} else {
  console.log('No run button found. Taking additional screenshots of the page.');
  await page.screenshot({ path: '/tmp/citysim-2-detail.png', fullPage: true });
}

console.log('Console errors:', errors);
await browser.close();
