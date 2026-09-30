import { expect, test } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { E2E } from "./env";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticator } = require(require.resolve("otplib", { paths: [path.join(__dirname, "..", "..", "api")] }));

// Optional visual evidence: E2E_SCREENSHOTS=1 saves full-page screenshots to test-results/.
async function shot(page: import("@playwright/test").Page, name: string) {
  if (process.env.E2E_SCREENSHOTS === "1") {
    await page.screenshot({ path: path.join(__dirname, "..", "test-results", `${name}.png`), fullPage: true });
  }
}

async function readOtp(): Promise<string> {
  const file = path.join(E2E.smsSinkDir, `${E2E.adminPhone.replace(/\D/g, "")}.txt`);
  for (let i = 0; i < 50; i++) {
    if (existsSync(file)) return readFileSync(file, "utf8").trim();
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("OTP was not delivered to the test SMS sink");
}

test("admin console: sign-in → TOTP enrollment → dashboard → moderation → listing → protected API", async ({ page, request, browser }) => {
  // --- security headers, robots, and the auth gate --------------------------------------
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/Disallow: \//);

  const first = await page.goto("/");
  expect(page.url()).toContain("/sign-in"); // no session → sign-in
  const headers = first!.headers();
  expect(headers["content-security-policy"]).toMatch(/frame-ancestors 'none'/);
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-robots-tag"]).toMatch(/noindex/);

  // --- first factor: phone OTP ----------------------------------------------------------
  await page.getByLabel("Phone number").fill(E2E.adminPhone);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("6-digit code sent by SMS").fill(await readOtp());
  await page.getByRole("button", { name: "Continue" }).click();

  // --- mandatory TOTP enrollment (first sign-in) ----------------------------------------
  await page.waitForURL("**/enroll");
  await expect(page.getByAltText("Authenticator enrollment QR code")).toBeVisible();
  await page.getByText("Can’t scan? Enter the key manually").click();
  const secret = (await page.locator("details p.font-mono").innerText()).trim();
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
  await page.getByPlaceholder("6-digit code").fill(authenticator.generate(secret));
  await page.getByRole("button", { name: "Verify and continue" }).click();

  // --- recovery codes shown exactly once ------------------------------------------------
  await expect(page.getByRole("heading", { name: "Save your recovery codes" })).toBeVisible();
  await expect(page.locator("ol li")).toHaveCount(10);
  await page.getByLabel("I have saved these codes somewhere safe.").check();
  await page.getByRole("button", { name: "Continue to the console" }).click();

  // --- dashboard ------------------------------------------------------------------------
  await page.waitForURL(E2E.adminUrl + "/");
  await expect(page.getByRole("heading", { name: "What needs attention" })).toBeVisible();
  await expect(page.getByText("Verified owner queue")).toBeVisible();
  await expect(page.getByText("Not available")).toBeVisible();
  await expect(page.getByText(/^Live · updated/)).toBeVisible(); // dashboard data has loaded
  await page.waitForTimeout(1500);
  await shot(page, "01-dashboard");

  // Browser JavaScript never sees an admin token.
  const exposed = await page.evaluate(() => ({
    cookie: document.cookie,
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage)
  }));
  expect(exposed.cookie).not.toMatch(/ghor_admin/);
  expect(exposed.local + exposed.session).not.toMatch(/eyJ|accessToken|refreshToken/);
  const cookies = await page.context().cookies();
  const adminCookies = cookies.filter((c) => c.name.includes("ghor_admin"));
  expect(adminCookies.length).toBeGreaterThanOrEqual(2);
  for (const c of adminCookies) {
    expect(c.httpOnly).toBe(true);
    expect(c.sameSite).toBe("Strict");
  }

  // --- moderation queue → listing review ------------------------------------------------
  await page.getByRole("link", { name: "Moderation" }).click();
  await page.waitForURL("**/moderation");
  await page.getByRole("link", { name: new RegExp(E2E.listingTitle) }).click();
  await page.waitForURL("**/moderation/*");
  await expect(page.getByRole("heading", { name: E2E.listingTitle })).toBeVisible();
  for (const panel of ["Media", "Risk information", "Owner plan", "Response behaviour", "Changes since last approval"]) {
    await expect(page.getByText(panel, { exact: true })).toBeVisible();
  }
  await shot(page, "02-review");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved — the owner will be notified.")).toBeVisible();

  // --- analytics renders from real data -------------------------------------------------
  await page.getByRole("link", { name: "Analytics" }).click();
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByText("Moderation decisions")).toBeVisible();
  await expect(page.getByText(/Typical day|No approvals/)).toBeVisible();
  await page.waitForTimeout(1500); // let the chart reveal animation finish
  await shot(page, "03-analytics");

  // --- the API is the security boundary -------------------------------------------------
  // Signed-in plain admin: a super_admin-only endpoint is refused by the API.
  const forbidden = await page.request.get("/api/admin/admin-users");
  expect(forbidden.status()).toBe(403);
  // A cross-site POST is refused by the BFF (CSRF).
  const csrf = await page.request.post("/api/admin/listings/bulk-decision", {
    headers: { origin: "https://evil.example" },
    data: {}
  });
  expect(csrf.status()).toBe(403);
  // A fresh browser context without the session gets nothing.
  const anon = await browser.newContext({ baseURL: E2E.adminUrl });
  const unauth = await anon.request.get("/api/admin/dashboard");
  expect(unauth.status()).toBe(401);
  await anon.close();

  // --- sign out ends the session --------------------------------------------------------
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/sign-in**");
  const after = await page.request.get("/api/admin/dashboard");
  expect(after.status()).toBe(401);
  // `next start` runs with NODE_ENV=production, so these are the real __Host- cookies
  // (Secure; HttpOnly; SameSite=Strict; Path=/). The browser only accepts the expiring
  // Set-Cookie if it repeats those attributes — sign-out must actually remove them.
  expect(adminCookies.every((c) => c.name.startsWith("__Host-"))).toBe(true);
  const left = (await page.context().cookies()).filter((c) => c.name.includes("ghor_admin"));
  expect(left.map((c) => c.name)).toEqual([]);
});
