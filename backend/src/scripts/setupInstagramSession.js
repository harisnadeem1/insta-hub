const path = require("path");
const { chromium } = require("playwright");

async function setupInstagramSession() {
  const userDataDir = path.join(process.cwd(), ".pw-instagram-session");

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1366, height: 900 },
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = context.pages()[0] || (await context.newPage());

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });

    window.chrome = window.chrome || { runtime: {} };

    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });

    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
  });

  await page.goto("https://www.instagram.com/accounts/login/", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  console.log("Instagram browser opened.");
  console.log("Log in manually in the browser viewer.");
  console.log("When login is complete, use the admin page button: Mark Session Complete.");

  await new Promise(() => {});
}

setupInstagramSession().catch((error) => {
  console.error("Failed to set up Instagram session:", error);
  process.exit(1);
});