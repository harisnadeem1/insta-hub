const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

function createError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function responseMatchesUsername(json, cleanUsername) {
  const candidates = [
    json?.username,
    json?.user?.username,
    json?.data?.user?.username,
    json?.graphql?.user?.username,
    json?.data?.xdt_api__v1__users__web_profile_info?.user?.username,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());

  return candidates.includes(cleanUsername);
}

function responseHasCounts(json) {
  const user =
    json?.data?.xdt_api__v1__users__web_profile_info?.user ||
    json?.graphql?.user ||
    json?.data?.user ||
    json?.user ||
    json;

  return Boolean(
    user?.edge_followed_by?.count ||
    user?.follower_count ||
    user?.edge_owner_to_timeline_media?.count ||
    user?.media_count ||
    user?.posts_count
  );
}

async function fetchProfilePageWithBrowser(username) {
  const cleanUsername = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");

  if (!cleanUsername) {
    throw createError("Username is required", 400);
  }

  const userDataDir = path.join(process.cwd(), ".pw-instagram-session");
  const debugDir = path.join(process.cwd(), "tmp");

  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }

  const collectedResponses = [];

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
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

  const page = await context.newPage();

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

  page.on("response", async (response) => {
    try {
      const responseUrl = response.url();
      const contentType = response.headers()["content-type"] || "";

      if (!responseUrl.includes("instagram.com")) return;
      if (!contentType.includes("application/json")) return;
      if (response.status() >= 400) return;

      const text = await Promise.race([
        response.text(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("response.text timeout")), 5000)
        ),
      ]);

      const json = safeJsonParse(text);
      if (!json) return;

      const matchesUsername = responseMatchesUsername(json, cleanUsername);
      const hasCounts = responseHasCounts(json);
      const interestingUrl =
        responseUrl.includes("web_profile_info") ||
        responseUrl.includes(cleanUsername);

      if (!interestingUrl && !matchesUsername) return;

      collectedResponses.push({
        url: responseUrl,
        status: response.status(),
        matchesUsername,
        hasCounts,
        json,
      });
    } catch (error) {
      console.log("response capture skipped:", error.message);
    }
  });

  const targetUrl = `https://www.instagram.com/${cleanUsername}/`;

  try {
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);

    const closeButton = page.getByLabel("Close");
    if (await closeButton.count()) {
      await closeButton.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
    }

    await page.mouse.move(200, 250);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(500);
    await page.mouse.wheel(0, -150);
    await page.waitForTimeout(500);

    const finalUrl = page.url();
    const finalTitle = await page.title();

    console.log("browser target username:", cleanUsername);
    console.log("browser final url:", finalUrl);
    console.log("browser page title:", finalTitle);

    const expectedPath = `/${cleanUsername}/`;
    if (!finalUrl.toLowerCase().includes(expectedPath)) {
      throw createError(
        `Browser landed on wrong page. Expected ${expectedPath}, got ${finalUrl}`,
        409
      );
    }

    const html = await page.content();

    fs.writeFileSync(
      path.join(debugDir, `instagram-${cleanUsername}.html`),
      html,
      "utf8"
    );

    fs.writeFileSync(
      path.join(debugDir, `instagram-${cleanUsername}-responses.json`),
      JSON.stringify(
        collectedResponses.map((item) => ({
          url: item.url,
          status: item.status,
          matchesUsername: item.matchesUsername,
          hasCounts: item.hasCounts,
        })),
        null,
        2
      ),
      "utf8"
    );

    await page.screenshot({
      path: path.join(debugDir, `instagram-${cleanUsername}.png`),
      fullPage: true,
    });

    return {
      username: cleanUsername,
      url: targetUrl,
      finalUrl,
      title: finalTitle,
      html,
      responses: collectedResponses,
    };
  } catch (error) {
    throw createError(`Browser scrape failed: ${error.message}`, error.statusCode || 500);
  } finally {
    await context.close();
  }
}

module.exports = {
  fetchProfilePageWithBrowser,
};