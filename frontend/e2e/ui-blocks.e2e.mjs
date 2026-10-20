// End-to-end check of the Kokonut UI blocks and the Tailark-style sections against a running app.
//
//   BASE_URL=http://localhost:3123 ADMIN_COOKIE=<token.sig> node e2e/ui-blocks.e2e.mjs
//
// ADMIN_COOKIE: a signed-in account with at least one captured payment (for the receipt). Screenshots go to SHOTS_DIR.

import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3123";
const SHOTS = process.env.SHOTS_DIR;
const browser = await chromium.launch();
const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (e) {
    results.push(["FAIL", name, e.message.split("\n")[0]]);
  }
}
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
async function noSideScroll(page) {
  const [scroll, width] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(scroll <= width, `page scrolls sideways: ${scroll}px in a ${width}px viewport`);
}

// ---------- public pages at three widths ----------

const pages = [
  ["home", "/", async (p) => {
    await p.getByText("tools in one audit").waitFor();
    await p.getByRole("heading", { name: /Everything it takes to get found/ }).waitFor();
  }],
  ["pricing", "/pricing", async (p) => {
    await p.getByRole("table", { name: "Compare plans" }).waitFor();
    await p.getByRole("table").getByText("Recommended").waitFor();
    assert.ok((await p.getByRole("table").getByRole("link", { name: /on Pro/ }).getAttribute("href")).includes("/signup?plan=pro"));
  }],
  ["login", "/login", async (p) => {
    await p.getByRole("heading", { name: "Welcome back" }).waitFor();
    await p.getByRole("link", { name: "Create an account" }).waitFor();
  }],
  ["signup", "/signup", async (p) => {
    await p.getByRole("heading", { name: "Create your account" }).waitFor();
    await p.getByRole("link", { name: "Log in", exact: true }).waitFor();
  }],
  ["contact", "/contact", async (p) => {
    const img = p.getByRole("img", { name: /Charminar/ });
    await img.waitFor();
    assert.ok(await img.evaluate((el) => el.complete && el.naturalWidth > 0), "Charminar photo did not load");
    await p.getByText("(only)").waitFor();
  }],
];

for (const [name, path, assertions] of pages) {
  for (const width of [375, 768, 1280]) {
    await check(`${name} at ${width}px`, async () => {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      const p = await ctx.newPage();
      await p.goto(`${BASE}${path}`);
      await assertions(p);
      await noSideScroll(p);
      await shot(p, `${name}-${width}`);
      await ctx.close();
    });
  }
}

await check("audit report draws the background paths", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/audit?url=${encodeURIComponent("https://example.com")}`);
  const canvas = p.locator("canvas").first();
  await canvas.waitFor({ state: "attached" });
  assert.ok(await canvas.evaluate((c) => c.width > 0 && c.height > 0), "canvas has no size");
  await p.waitForTimeout(2500);
  await shot(p, "audit-1280");
  await ctx.close();
});

// ---------- app ----------

const app = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await app.addCookies([{ name: "better-auth.session_token", value: process.env.ADMIN_COOKIE ?? "", url: BASE }]);
const page = await app.newPage();

await check("command palette: Ctrl+K, search, Enter navigates", async () => {
  await page.goto(`${BASE}/app`);
  const input = page.getByRole("combobox", { name: "Search sites and pages" }).first();
  await input.waitFor();
  await input.click();
  await page.keyboard.type("billing");
  await page.getByRole("option", { name: /Billing/ }).first().waitFor();
  await shot(page, "app-palette");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app\/billing$/);
});

await check("profile dropdown opens with the keyboard and closes with Esc", async () => {
  const trigger = page.getByRole("button", { name: /E2E Admin/ }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu").first();
  await menu.waitFor();
  await menu.getByRole("menuitem", { name: "Account & security" }).waitFor();
  await menu.getByRole("menuitem", { name: "Feedback (admin)" }).waitFor();
  assert.equal(await page.getByText("Theme", { exact: true }).count(), 0, "theme picker should be hidden");
  await shot(page, "app-profile");
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
});

await check("billing: receipt dialog prints the payment", async () => {
  await page.goto(`${BASE}/app/billing`);
  await page.getByRole("button", { name: "Receipt" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Payment receipt" });
  await dialog.waitFor();
  await dialog.getByRole("document", { name: /Receipt from Rankwise/ }).waitFor({ state: "attached" });
  await dialog.getByText("This is a payment receipt, not a tax invoice.", { exact: false }).waitFor();
  await page.waitForTimeout(2500);
  await shot(page, "app-receipt");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
});

await check("app fits 375px", async () => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`${BASE}/app/billing`);
  await page.getByRole("heading", { name: "Billing" }).waitFor();
  await noSideScroll(page);
});

await app.close();
await browser.close();

for (const [status, name, why] of results) console.log(`${status}  ${name}${why ? `  —  ${why}` : ""}`);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
