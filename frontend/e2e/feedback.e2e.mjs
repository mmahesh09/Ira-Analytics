// End-to-end check of the feedback form and the admin dashboard against a running app.
//
//   BASE_URL=http://localhost:3123 ADMIN_COOKIE=<token.sig> USER_COOKIE=<token.sig> node e2e/feedback.e2e.mjs
//
// Needs the frontend (next start) with the API behind it, on a disposable database where ADMIN_COOKIE belongs to an
// account listed in the API's ADMIN_EMAILS (verified email) and USER_COOKIE to an ordinary account.
// Screenshots go to SHOTS_DIR when it is set. Uses the `playwright` package already in devDependencies.

import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3123";
const SHOTS = process.env.SHOTS_DIR;
const RUN = `E2E ${Date.now()}`;

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

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function noSideScroll(page) {
  const [scroll, width] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(scroll <= width, `page scrolls sideways: ${scroll}px content in a ${width}px viewport`);
}

const cookie = (value) => [{ name: "better-auth.session_token", value, url: BASE }];
const focusedName = (page) => page.evaluate(() => document.activeElement?.getAttribute("name") ?? document.activeElement?.id ?? "");

// ---------- public form ----------

const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/feedback`);
await page.getByRole("heading", { name: "About you" }).waitFor();
await shot(page, "form-375-step1");

await check("layout fits 375px without sideways scroll", () => noSideScroll(page));

await check("required fields block Continue and focus the first one", async () => {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Choose the role that fits you best.").waitFor();
  await page.getByText("Choose how often you use Rankwise.").waitFor();
  assert.equal(await focusedName(page), "role");
  await shot(page, "form-375-errors");
});

await check("invalid email is refused, answers are kept", async () => {
  await page.getByLabel("Name").fill(RUN);
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Enter a valid email address, or leave it blank.").waitFor();
  assert.equal(await page.getByLabel("Name").inputValue(), RUN);
  await page.getByLabel("Email").fill("e2e@example.test");
});

await check("choosing Other asks for text", async () => {
  await page.getByLabel("Other", { exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Tell us your role.").waitFor();
  await page.getByPlaceholder("Your role").fill("Investor");
});

await check("radio groups work from the keyboard", async () => {
  await page.locator('input[name="usage_frequency"]').first().focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.locator('input[name="usage_frequency"]:checked').inputValue(), "several_weekly");
});

await check("Continue moves to step 2 and focuses its heading", async () => {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "Your experience" }).waitFor();
  assert.equal(await focusedName(page), "fb-step-title");
});

await check("Back keeps step 1 answers", async () => {
  await page.getByRole("button", { name: "Back" }).click();
  assert.equal(await page.getByLabel("Name").inputValue(), RUN);
  assert.equal(await page.getByPlaceholder("Your role").inputValue(), "Investor");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "Your experience" }).waitFor();
});

await check("ratings are required, then accepted via keyboard and click", async () => {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Rate your overall satisfaction from 1 to 5.").waitFor();
  await page.locator('input[name="satisfaction_rating"]').first().focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator('input[name="satisfaction_rating"]:checked').inputValue(), "4");
  await page.locator('label:has(input[name="usability_rating"][value="5"])').click();
  await page.locator('label:has(input[name="recommendation_score"][value="9"])').click();
});

await check("goal Other, features and challenge", async () => {
  await page.locator('label:has(input[name="primary_goal"][value="other"])').click();
  await page.getByPlaceholder("Your main goal").fill("Win AI answers");
  await page.locator('label:has(input[name="features_used"][value="visibility_audit"])').click();
  await page.locator('label:has(input[name="features_used"][value="scorecard"])').click();
  await page.locator('label:has(input[name="features_used"][value="none_yet"])').click();
  assert.deepEqual(await page.locator('input[name="features_used"]:checked').evaluateAll((els) => els.map((e) => e.value)), ["none_yet"]);
  await page.locator('label:has(input[name="features_used"][value="scorecard"])').click();
  assert.deepEqual(await page.locator('input[name="features_used"]:checked').evaluateAll((els) => els.map((e) => e.value)), ["scorecard"]);
  await page.locator('label:has(input[name="most_valuable_feature"][value="scorecard"])').click();
  await page.locator('label:has(input[name="biggest_challenge"][value="missing_features"])').click();
  await shot(page, "form-375-step2");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "Suggestions" }).waitFor();
});

await check("step 3 and review show every answer", async () => {
  await page.getByLabel("What feature would you like us to add next?").fill("=Slack alerts");
  await page.getByLabel("You can contact me about this feedback.").check();
  await page.getByRole("button", { name: "Review answers" }).click();
  await page.getByRole("heading", { name: "Review and send" }).waitFor();
  for (const text of ["Other: Investor", "Other: Win AI answers", "4 / 5", "5 / 5", "9 / 10", "Visibility scorecard", "=Slack alerts"]) {
    await page.getByText(text, { exact: true }).first().waitFor();
  }
  await shot(page, "form-375-review");
});

await check("a server error keeps the answers and offers a retry", async () => {
  await page.route("**/api/feedback", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await page.getByRole("button", { name: "Send feedback" }).click();
  await page.getByText(/We couldn't save your feedback/).waitFor();
  await page.getByText("Other: Investor").waitFor();
  await page.unroute("**/api/feedback");
  await shot(page, "form-375-failed");
});

await check("retry succeeds; a duplicate of the same request stores one row", async () => {
  // send the same body twice, as a double submit or a retry after a lost response would
  await page.route("**/api/feedback", async (route) => {
    const first = await route.fetch();
    await route.fetch();
    await route.fulfill({ response: first });
  });
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByRole("heading", { name: /Thank you/ }).waitFor();
  await page.unroute("**/api/feedback");
  await shot(page, "form-375-thanks");
});

await check("reload after success starts a fresh form", async () => {
  await page.goto(`${BASE}/feedback`);
  await page.getByRole("heading", { name: "About you" }).waitFor();
  assert.equal(await page.getByLabel("Name").inputValue(), "");
});

for (const width of [768, 1280]) {
  await check(`form layout at ${width}px`, async () => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/feedback`);
    await page.getByRole("heading", { name: "About you" }).waitFor();
    await noSideScroll(page);
    await shot(page, `form-${width}`);
  });
}
await ctx.close();

// ---------- admin ----------

const anon = await browser.newContext();
await check("admin API refuses anonymous callers", async () => {
  assert.equal((await anon.request.get(`${BASE}/api/admin/feedback`)).status(), 401);
});
await anon.close();

const user = await browser.newContext();
await user.addCookies(cookie(process.env.USER_COOKIE ?? ""));
await check("ordinary account gets 404 from the API and Not found on the page", async () => {
  for (const path of ["/api/admin/feedback", "/api/admin/feedback/stats", "/api/admin/feedback/export.csv"]) {
    assert.equal((await user.request.get(`${BASE}${path}`)).status(), 404, path);
  }
  const p = await user.newPage();
  await p.goto(`${BASE}/app/admin/feedback`);
  await p.getByRole("heading", { name: "Not found" }).waitFor();
  assert.equal(await p.getByRole("link", { name: "Feedback (admin)" }).count(), 0);
});
await user.close();

const admin = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await admin.addCookies(cookie(process.env.ADMIN_COOKIE ?? ""));
const dash = await admin.newPage();

await check("admin sees the submission, saved exactly once", async () => {
  const res = await admin.request.get(`${BASE}/api/admin/feedback?q=${encodeURIComponent(RUN)}`);
  const body = await res.json();
  assert.equal(res.status(), 200);
  assert.equal(body.total, 1);
  const row = body.items[0];
  assert.equal(row.role_other, "Investor");
  assert.equal(row.satisfaction_rating, 4);
  assert.equal(row.usability_rating, 5);
  assert.equal(row.recommendation_score, 9);
  assert.deepEqual(row.features_used, ["scorecard"]);
  assert.equal(row.contact_permission, true);
});

await check("dashboard renders metrics, table, search, filter and detail", async () => {
  await dash.goto(`${BASE}/app/admin/feedback`);
  await dash.getByRole("heading", { name: "Product feedback" }).waitFor();
  await dash.getByRole("link", { name: "Feedback (admin)" }).waitFor();
  await dash.getByText("Avg. satisfaction").waitFor();
  await dash.getByText(/^\d+ responses?$/).first().waitFor();
  await shot(dash, "admin-1280");
  await dash.getByPlaceholder("Search comments, names, emails").fill(RUN);
  await dash.getByText("1 response match these filters").waitFor();
  await dash.getByLabel("Role").selectOption("founder");
  await dash.getByText("No feedback matches these filters.").waitFor();
  await dash.getByLabel("Role").selectOption("other");
  await dash.getByText("1 response match these filters").waitFor();
  await dash.getByRole("button", { name: /open response/ }).first().click();
  const dialog = dash.getByRole("dialog");
  await dialog.getByText("Other: Investor").waitFor();
  await dialog.getByText("Yes, about this feedback").waitFor();
  await shot(dash, "admin-1280-detail");
  await dash.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
});

await check("sorting changes order and sets aria-sort", async () => {
  await dash.getByRole("button", { name: "Clear" }).click();
  await dash.getByRole("button", { name: "Satisfaction" }).click();
  await dash.locator('th[aria-sort="descending"]', { hasText: "Satisfaction" }).waitFor();
  await dash.getByRole("button", { name: "Satisfaction" }).click();
  await dash.locator('th[aria-sort="ascending"]', { hasText: "Satisfaction" }).waitFor();
});

await check("CSV export follows filters and neutralises formulas", async () => {
  const res = await admin.request.get(`${BASE}/api/admin/feedback/export.csv?q=${encodeURIComponent(RUN)}`);
  assert.equal(res.status(), 200);
  const text = await res.text();
  assert.ok(text.includes(RUN), "row missing from export");
  assert.ok(text.includes("'=Slack alerts"), "formula not escaped");
  assert.equal(text.trim().split("\n").length, 2);
});

await check("dashboard fits 375px", async () => {
  await dash.setViewportSize({ width: 375, height: 800 });
  await dash.goto(`${BASE}/app/admin/feedback`);
  await dash.getByRole("heading", { name: "Product feedback" }).waitFor();
  await dash.getByText("Avg. satisfaction").waitFor();
  await noSideScroll(dash);
  await shot(dash, "admin-375");
});
await admin.close();
await browser.close();

for (const [status, name, why] of results) console.log(`${status}  ${name}${why ? `  —  ${why}` : ""}`);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
