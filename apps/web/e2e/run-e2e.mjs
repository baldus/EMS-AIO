// End-to-end test of the full stack: mock OIDC provider -> Next.js web (production build) ->
// NestJS API (built) -> PostgreSQL (ephemeral database, fictional seed data).
//
// Prerequisites: `pnpm build`, a reachable PostgreSQL (TEST_DATABASE_URL), and Playwright with
// Chromium installed. Run: pnpm --filter @ems/web e2e
// Set E2E_SCREENSHOT_DIR to save screenshots of key screens.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startMockOidcProvider } from "./mock-oidc-provider.mjs";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const db = require(path.join(root, "packages/db/dist/index.js"));
const { chromium } = require("playwright");

const PORTS = { idp: 9400, api: 4100, web: 3100 };
const CLIENT = { id: "ems-web", secret: "e2e-only-client-secret" };
const WEB = `http://localhost:${PORTS.web}`;
const shots = process.env.E2E_SCREENSHOT_DIR;
if (shots) mkdirSync(shots, { recursive: true });

const children = [];
function start(name, cmd, args, cwd, env) {
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  child.on("exit", (code) => {
    if (code && code !== 0 && !child.stopping)
      console.error(`[${name}] exited ${code}\n${log.slice(-3000)}`);
  });
  children.push(child);
  return child;
}

async function waitFor(url, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    if (Date.now() > until) throw new Error(`Timed out waiting for ${url}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

const steps = [];
async function step(name, fn) {
  const t = Date.now();
  await fn();
  steps.push(`  ✓ ${name} (${Date.now() - t}ms)`);
  console.log(steps.at(-1));
}

let ephemeral;
let idp;
let browser;
try {
  ephemeral = await db.createEphemeralTestDatabase();
  const prisma = new db.PrismaClient({ datasourceUrl: ephemeral.url });
  await db.seedDatabase(prisma);
  await prisma.$disconnect();

  idp = await startMockOidcProvider({
    port: PORTS.idp,
    clientId: CLIENT.id,
    clientSecret: CLIENT.secret,
    audience: "ems-api",
    // The PM gets 30-second tokens so every navigation exercises middleware token refresh.
    ttlFor: (email) => (email === "pm@ems.example.com" ? 30 : 300),
  });

  start("api", process.execPath, ["dist/main.js"], path.join(root, "apps/api"), {
    NODE_ENV: "development",
    PORT: String(PORTS.api),
    LOG_LEVEL: "warn",
    DATABASE_URL: ephemeral.url,
    OIDC_ISSUER_URL: idp.issuer,
    OIDC_AUDIENCE: "ems-api",
    AUTH_MFA_AMR_VALUES: "otp,mfa",
    AUTH_EMAIL_LINKING_ENABLED: "true",
    API_DOCS_ENABLED: "false",
    CORS_ORIGINS: WEB,
  });
  start(
    "web",
    process.execPath,
    [
      require.resolve("next/dist/bin/next", { paths: [path.join(root, "apps/web")] }),
      "start",
      "--port",
      String(PORTS.web),
    ],
    path.join(root, "apps/web"),
    {
      NODE_ENV: "production",
      APP_URL: WEB,
      API_BASE_URL: `http://localhost:${PORTS.api}`,
      OIDC_ISSUER_URL: idp.issuer,
      OIDC_CLIENT_ID: CLIENT.id,
      OIDC_CLIENT_SECRET: CLIENT.secret,
      SESSION_SECRET: "e2e-session-secret-0123456789abcdefghijklmnop",
      // The production-mode guard requires https; e2e runs on localhost over http by design.
      E2E_ALLOW_HTTP: "true",
    },
  );
  await waitFor(`http://localhost:${PORTS.api}/health/ready`);
  await waitFor(`${WEB}/healthz`);

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());

  async function signIn(email, { mfa }) {
    await page.goto(`${WEB}/dashboard`);
    await page.waitForURL(/\/login\?returnTo=%2Fdashboard/);
    await page.getByRole("link", { name: /sign in/i }).click();
    await page.waitForURL(new RegExp(`^${idp.issuer}/authorize`));
    await page.fill("#login_email", email);
    if (mfa) await page.check("#mfa");
    await page.click("#approve");
  }
  async function signOut() {
    const responses = [];
    const record = (r) => responses.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    page.on("response", record);
    try {
      await page.getByRole("button", { name: "Sign out" }).first().click();
      await page.waitForURL(/\/login\?reason=signed_out/, { timeout: 10_000 });
    } catch (err) {
      throw new Error(`Sign-out failed at ${page.url()}:\n${responses.join("\n")}\n${err.message}`);
    } finally {
      page.off("response", record);
    }
  }
  const shot = async (name) =>
    shots && page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });

  await step("unauthenticated users are redirected to sign in", async () => {
    await page.goto(`${WEB}/organizations`);
    await page.waitForURL(/\/login\?returnTo=%2Forganizations/);
    await shot("01-login");
  });

  await step("EMS manager signs in with MFA via OIDC (PKCE + state + nonce)", async () => {
    await signIn("manager@ems.example.com", { mfa: true });
    await page.waitForURL(`${WEB}/dashboard`);
    await page.getByRole("heading", { name: /Welcome, Morgan Manager/ }).waitFor();
    await page.getByText("MFA verified").waitFor();
    const cookies = await context.cookies(WEB);
    const session = cookies.filter((c) => c.name.startsWith("ems_session"));
    assert.ok(session.length >= 1, "session cookie set");
    assert.ok(
      session.every((c) => c.httpOnly && c.sameSite === "Lax"),
      "session cookie is httpOnly + SameSite=Lax",
    );
    assert.ok(!cookies.some((c) => c.name === "ems_login"), "login-state cookie cleared");
    await shot("02-dashboard-manager");
  });

  await step("organization list shows seeded fictional data", async () => {
    await page.getByRole("link", { name: "Organizations" }).click();
    await page.getByRole("link", { name: "Harbor Point Automation" }).waitFor();
    await page.getByRole("link", { name: "Copperline Machine Works" }).waitFor();
    await shot("03-organizations");
  });

  await step("create, edit, and archive an organization (audited)", async () => {
    await page.getByRole("link", { name: "New organization" }).click();
    await page.fill('input[name="name"]', "E2E Fixture Fabrication");
    await page.selectOption('select[name="segment"]', "custom_machine_builder");
    await page.fill('input[name="countryCode"]', "us");
    await page.getByRole("button", { name: "Create organization" }).click();
    await page.getByRole("heading", { name: "E2E Fixture Fabrication" }).waitFor();

    await page.fill('input[name="industry"]', "Welding fixtures");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByText("Saved.").waitFor();
    await page.reload();
    assert.equal(await page.inputValue('input[name="industry"]'), "Welding fixtures");
    await page.getByText("Organization updated").waitFor();
    await shot("04-organization-detail");

    await page.getByRole("button", { name: "Archive" }).click();
    await page.getByText(/This organization was archived/).waitFor();
    await page.getByRole("button", { name: "Restore" }).waitFor();
  });

  await step("sign out clears the session", async () => {
    await signOut();
    await page.goto(`${WEB}/dashboard`);
    await page.waitForURL(/\/login/);
  });

  await step("customer admin sees only their own tenant", async () => {
    await signIn("lead@harborpoint.example.com", { mfa: true });
    await page.waitForURL(`${WEB}/dashboard`);
    await page.goto(`${WEB}/organizations`);
    await page.getByRole("link", { name: "Harbor Point Automation" }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Copperline Machine Works" }).count(), 0);
    assert.equal(await page.getByRole("link", { name: "New organization" }).count(), 0);
    await page.goto(`${WEB}/organizations/${db.SEED_IDS.organizations.copperline}`);
    await page
      .getByText(/could not be found|404/i)
      .first()
      .waitFor();
    await page.goto(`${WEB}/projects`);
    await page.getByRole("link", { name: "HPA-2026-001" }).waitFor();
    assert.equal(await page.getByRole("link", { name: "CMW-2026-001" }).count(), 0);
    await shot("05-customer-projects");
    await signOut();
  });

  await step("MFA-required role without MFA is told to step up", async () => {
    await signIn("manager@ems.example.com", { mfa: false });
    await page.waitForURL(`${WEB}/dashboard`);
    await page.getByText("No MFA").waitFor();
    await page.getByText(/Your roles require multi-factor authentication/).waitFor();
    assert.equal(await page.getByRole("link", { name: "Organizations" }).count(), 0);
    await signOut();
  });

  await step("unprovisioned identities are denied after successful IdP login", async () => {
    await signIn("intruder@unknown.example.com", { mfa: true });
    await page.waitForURL(/\/access\?code=USER_NOT_PROVISIONED/);
    await page.getByText(/has not been provisioned/).waitFor();
  });

  await step(
    "mobile viewport renders without overflow; short-lived tokens are refreshed",
    async () => {
      const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      });
      const m = await mobile.newPage();
      await m.goto(`${WEB}/dashboard`);
      await m.getByRole("link", { name: /sign in/i }).click();
      await m.fill("#login_email", "pm@ems.example.com");
      await m.click("#approve");
      await m.waitForURL(`${WEB}/dashboard`);
      const overflow = await m.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      assert.ok(overflow <= 0, `no horizontal scroll (overflow ${overflow}px)`);
      const before = idp.stats.refreshes;
      await m.goto(`${WEB}/projects`);
      await m.getByRole("link", { name: "HPA-2026-001" }).waitFor();
      await m.goto(`${WEB}/organizations`);
      await m.getByRole("link", { name: "Harbor Point Automation" }).waitFor();
      assert.ok(
        idp.stats.refreshes >= before + 2,
        `tokens refreshed (${idp.stats.refreshes - before})`,
      );
      if (shots)
        await m.screenshot({ path: path.join(shots, "06-mobile-dashboard.png"), fullPage: true });
      await mobile.close();
    },
  );

  console.log(`\nE2E passed: ${steps.length} steps`);
} catch (err) {
  console.error("\nE2E FAILED:", err);
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const c of children) {
    c.stopping = true;
    c.kill("SIGTERM");
  }
  await idp?.close();
  await new Promise((r) => setTimeout(r, 1000));
  if (ephemeral) await db.dropEphemeralTestDatabase(ephemeral);
}
