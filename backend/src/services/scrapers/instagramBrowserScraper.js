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

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^instagram\.com\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .split(/[?#/]/)[0];
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

function getUserNode(json) {
  return (
    json?.data?.xdt_api__v1__users__web_profile_info?.user ||
    json?.graphql?.user ||
    json?.data?.user ||
    json?.user ||
    json ||
    null
  );
}

function responseHasCounts(json) {
  const user = getUserNode(json);
  return Boolean(
    user?.edge_followed_by?.count ||
      user?.follower_count ||
      user?.edge_owner_to_timeline_media?.count ||
      user?.media_count ||
      user?.posts_count
  );
}

function parseCompactNumber(value) {
  if (value == null) return 0;
  const raw = String(value).trim().replace(/,/g, "");
  const match = raw.match(/^([\d.]+)\s*([kmb])?$/i);
  if (!match) {
    const digits = raw.replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  }
  const num = Number(match[1] || 0);
  const suffix = (match[2] || "").toLowerCase();
  if (suffix === "k") return Math.round(num * 1000);
  if (suffix === "m") return Math.round(num * 1000000);
  if (suffix === "b") return Math.round(num * 1000000000);
  return Math.round(num);
}

function extractMetaContent(html, attr, attrValue) {
  const escaped = String(attrValue || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${escaped}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
    "i"
  );
  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+${attr}=["']${escaped}["'][^>]*>`,
    "i"
  );
  const match = html.match(pattern) || html.match(reversePattern);
  return match ? match[1].trim() : null;
}

function cleanText(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePostStatsFromHtml(html) {
  if (!html) return { comments_count: 0, views_count: 0 };

  const ogDescription =
    extractMetaContent(html, "property", "og:description") ||
    extractMetaContent(html, "name", "description") ||
    "";

  const text = cleanText(ogDescription);

  const commentsMatch =
    text.match(/([\d.,]+(?:\s*[KMB])?)\s+comments?/i) ||
    html.match(/"edge_media_to_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/i) ||
    html.match(/"edge_media_to_parent_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/i) ||
    html.match(/"comment_count"\s*:\s*(\d+)/i);

  const viewsMatch =
    text.match(/([\d.,]+(?:\s*[KMB])?)\s+views?/i) ||
    html.match(/"video_view_count"\s*:\s*(\d+)/i) ||
    html.match(/"video_play_count"\s*:\s*(\d+)/i) ||
    html.match(/"view_count"\s*:\s*(\d+)/i) ||
    html.match(/"play_count"\s*:\s*(\d+)/i);

  return {
    comments_count: commentsMatch ? parseCompactNumber(commentsMatch[1]) : 0,
    views_count: viewsMatch ? parseCompactNumber(viewsMatch[1]) : 0,
  };
}

function getShortcodesFromHtml(html, limit = Infinity) {
  if (!html) return [];
  const seen = new Set();
  const results = [];
  const patterns = [
    /href=["'](?:https?:\/\/[^"'/]+)?\/(p|reel)\/([A-Za-z0-9_-]{5,})\/?["']/g,
    /(?:https?:\/\/[^"'\s]*instagram\.com)?\/(p|reel)\/([A-Za-z0-9_-]{5,})\/?/g,
    /"shortcode"\s*:\s*"([A-Za-z0-9_-]{5,})"/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let type = "post";
      let shortcode;

      if (match.length >= 3 && match[2]) {
        type = match[1] === "reel" ? "reel" : "post";
        shortcode = match[2];
      } else {
        shortcode = match[1];
      }

      if (!shortcode || seen.has(shortcode)) continue;
      seen.add(shortcode);
      results.push({ shortcode, type });

      if (results.length >= limit) return results;
    }
  }

  return results;
}

async function addStealth(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    window.chrome = window.chrome || { runtime: {} };
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  });
}

async function collectJsonResponses(page, predicate) {
  const collected = [];
  page.on("response", async (response) => {
    try {
      const responseUrl = response.url();
      const contentType = response.headers()["content-type"] || "";
      if (!responseUrl.includes("instagram.com")) return;
      if (!contentType.includes("application/json")) return;
      if (response.status() >= 400) return;
      if (predicate && !predicate(responseUrl)) return;

      const text = await Promise.race([
        response.text(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("response.text timeout")), 5000)
        ),
      ]);
      const json = safeJsonParse(text);
      if (!json) return;
      collected.push({ url: responseUrl, status: response.status(), json });
    } catch {}
  });
  return collected;
}

async function settleInstagramPage(page) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const closeButton = page.getByLabel("Close");
  if (await closeButton.count()) {
    await closeButton.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

function mergeShortcodes(...lists) {
  const seen = new Set();
  const merged = [];

  for (const list of lists) {
    for (const item of list || []) {
      if (!item?.shortcode || seen.has(item.shortcode)) continue;
      seen.add(item.shortcode);
      merged.push(item);
    }
  }

  return merged;
}

async function extractReelStatsFromPage(page) {
  return await page.evaluate(() => {
    function parseCompactNumber(value) {
      if (value == null) return 0;
      const raw = String(value).trim().replace(/,/g, "");
      const match = raw.match(/^([\d.]+)\s*([kmb])?$/i);
      if (!match) {
        const digits = raw.replace(/[^\d]/g, "");
        return digits ? Number(digits) : 0;
      }
      const num = Number(match[1] || 0);
      const suffix = (match[2] || "").toLowerCase();
      if (suffix === "k") return Math.round(num * 1000);
      if (suffix === "m") return Math.round(num * 1000000);
      if (suffix === "b") return Math.round(num * 1000000000);
      return Math.round(num);
    }

    function getNumericText(el) {
      if (!el) return "";
      const spans = Array.from(el.querySelectorAll("span"));
      for (const span of spans) {
        const text = (span.textContent || "").trim();
        if (/^[\d.,]+(?:\s*[KMB])?$/i.test(text)) return text;
      }
      const text = (el.textContent || "").trim();
      const match = text.match(/[\d.,]+(?:\s*[KMB])?/i);
      return match ? match[0] : "";
    }

    const links = Array.from(document.querySelectorAll('a[href*="/reel/"]'));
    const results = [];
    const seen = new Set();

    for (const link of links) {
      const href = link.getAttribute("href") || "";
      const shortcodeMatch = href.match(/\/reel\/([A-Za-z0-9_-]{5,})\/?/i);
      if (!shortcodeMatch) continue;

      const shortcode = shortcodeMatch[1];
      if (seen.has(shortcode)) continue;
      seen.add(shortcode);

      let views_count = 0;
      let comments_count = 0;

      const viewIcon = link.querySelector('svg[aria-label="View Count Icon"]');
      if (viewIcon) {
        const block = viewIcon.closest("div")?.parentElement || viewIcon.closest("div");
        views_count = parseCompactNumber(getNumericText(block));
      }

      const listItems = Array.from(link.querySelectorAll("ul li"));
      const numbers = listItems
        .map((li) => parseCompactNumber(getNumericText(li)))
        .filter((n) => Number.isFinite(n));

      if (numbers.length >= 2) {
        comments_count = numbers[1];
      } else if (numbers.length === 1) {
        comments_count = numbers[0];
      }

      results.push({
        shortcode,
        type: "reel",
        views_count,
        comments_count,
      });
    }

    return results;
  });
}

async function extractMainGridStatsFromPage(page, username) {
  const cleanUsername = String(username || "").toLowerCase();

  return await page.evaluate(async (expectedUsername) => {
    function parseCompactNumber(value) {
      if (value == null) return 0;
      const raw = String(value).trim().replace(/,/g, "");
      const match = raw.match(/^([\d.]+)\s*([kmb])?$/i);
      if (!match) {
        const digits = raw.replace(/[^\d]/g, "");
        return digits ? Number(digits) : 0;
      }
      const num = Number(match[1] || 0);
      const suffix = (match[2] || "").toLowerCase();
      if (suffix === "k") return Math.round(num * 1000);
      if (suffix === "m") return Math.round(num * 1000000);
      if (suffix === "b") return Math.round(num * 1000000000);
      return Math.round(num);
    }

    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function getOverlayCommentCount(anchor) {
      const listItems = Array.from(anchor.querySelectorAll("ul li"));
      const numbers = listItems
        .map((li) => {
          const spans = Array.from(li.querySelectorAll("span"));
          for (const span of spans) {
            const text = (span.textContent || "").trim();
            if (/^[\d.,]+(?:\s*[KMB])?$/i.test(text)) {
              return parseCompactNumber(text);
            }
          }
          const text = (li.textContent || "").trim();
          const match = text.match(/[\d.,]+(?:\s*[KMB])?/i);
          return match ? parseCompactNumber(match[0]) : null;
        })
        .filter((v) => v != null);

      if (numbers.length >= 2) return numbers[1];
      if (numbers.length === 1) return numbers[0];
      return 0;
    }

    const anchors = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
    const results = [];
    const seen = new Set();

    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      const match =
        href.match(new RegExp(`/${expectedUsername}/p/([A-Za-z0-9_-]{5,})/?`, "i")) ||
        href.match(new RegExp(`/${expectedUsername}/reel/([A-Za-z0-9_-]{5,})/?`, "i")) ||
        href.match(/\/p\/([A-Za-z0-9_-]{5,})\/?/i) ||
        href.match(/\/reel\/([A-Za-z0-9_-]{5,})\/?/i);

      if (!match) continue;

      const shortcode = match[1];
      const type = href.includes("/reel/") ? "reel" : "post";
      if (seen.has(shortcode)) continue;
      seen.add(shortcode);

      a.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      a.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await sleep(120);

      const comments_count = getOverlayCommentCount(a);

      results.push({
        shortcode,
        type,
        comments_count,
      });
    }

    return results;
  }, cleanUsername);
}

async function tryOpenReelsTab(page, username) {
  const cleanUsername = normalizeUsername(username);
  const reelsUrl = `https://www.instagram.com/${cleanUsername}/reels/`;

  try {
    await page.goto(reelsUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await settleInstagramPage(page);

await page.mouse.move(300, 400);
await page.mouse.wheel(0, 1200);
await page.waitForTimeout(1000);
await page.mouse.wheel(0, 1200);
await page.waitForTimeout(1000);

const html = await page.content();
const shortcodes = getShortcodesFromHtml(html);
const reelStats = await extractReelStatsFromPage(page);

    return {
      url: reelsUrl,
      html,
      shortcodes: shortcodes.map((item) => ({
        shortcode: item.shortcode,
        type: "reel",
      })),
      reelStats,
    };
  } catch (error) {
    console.log("failed to open reels tab directly", {
      username: cleanUsername,
      message: error?.message,
    });
  }

  try {
    const reelsLink = page.locator('a[href$="/reels/"], a[href*="/reels"]');
    if (await reelsLink.first().count()) {
      await reelsLink.first().click({ force: true }).catch(() => {});
      await settleInstagramPage(page);

      const html = await page.content();
      const shortcodes = getShortcodesFromHtml(html);
      const reelStats = await extractReelStatsFromPage(page);

      return {
        url: page.url(),
        html,
        shortcodes: shortcodes.map((item) => ({
          shortcode: item.shortcode,
          type: "reel",
        })),
        reelStats,
      };
    }
  } catch (error) {
    console.log("failed to open reels tab by clicking", {
      username: cleanUsername,
      message: error?.message,
    });
  }

  return {
    url: null,
    html: "",
    shortcodes: [],
    reelStats: [],
  };
}

async function fetchSinglePostStats(context, debugDir, shortcode, type = "post") {
  const segment = type === "reel" ? "reel" : "p";
  const url = `https://www.instagram.com/${segment}/${shortcode}/`;
  const page = await context.newPage();
  await addStealth(page);
  const responses = await collectJsonResponses(page, (responseUrl) =>
    responseUrl.includes(shortcode) || responseUrl.includes("instagram.com/api/")
  );

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await settleInstagramPage(page);

    const html = await page.content();
    const htmlStats = parsePostStatsFromHtml(html);

    let jsonComments = 0;
    let jsonViews = 0;

    for (const item of responses) {
      const user = getUserNode(item.json);
      const commentCount =
        Number(
          item.json?.edge_media_to_comment?.count ||
            item.json?.edge_media_to_parent_comment?.count ||
            item.json?.comment_count ||
            user?.edge_media_to_comment?.count ||
            user?.edge_media_to_parent_comment?.count ||
            0
        ) || 0;

      const viewCount =
        Number(
          item.json?.video_view_count ||
            item.json?.video_play_count ||
            item.json?.view_count ||
            item.json?.play_count ||
            user?.video_view_count ||
            user?.video_play_count ||
            0
        ) || 0;

      jsonComments = Math.max(jsonComments, commentCount);
      jsonViews = Math.max(jsonViews, viewCount);
    }

    const comments_count = Math.max(htmlStats.comments_count, jsonComments);
    const views_count = Math.max(htmlStats.views_count, jsonViews);

    fs.writeFileSync(
      path.join(debugDir, `instagram-post-${shortcode}.json`),
      JSON.stringify(
        {
          shortcode,
          url,
          htmlStats,
          jsonComments,
          jsonViews,
          responses: responses.map((r) => ({ url: r.url, status: r.status })),
        },
        null,
        2
      ),
      "utf8"
    );

    return { shortcode, comments_count, views_count, url };
  } finally {
    await page.close().catch(() => {});
  }
}

async function fetchProfilePageWithBrowser(username, options = {}) {
  const cleanUsername = normalizeUsername(username);
  if (!cleanUsername) throw createError("Username is required", 400);

  const userDataDir = path.join(process.cwd(), ".pw-instagram-session");
  const debugDir = path.join(process.cwd(), "tmp");
  const postLimit = Number.isFinite(Number(options.postLimit))
    ? Number(options.postLimit)
    : Infinity;
  const postConcurrency = Math.max(1, Number(options.postConcurrency || 1));

  if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

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
  await addStealth(page);
  const collectedResponses = await collectJsonResponses(page, (responseUrl) =>
    responseUrl.includes("web_profile_info") || responseUrl.includes(cleanUsername)
  );

  const targetUrl = `https://www.instagram.com/${cleanUsername}/`;

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await settleInstagramPage(page);

    await page.mouse.move(200, 250);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(500);
    await page.mouse.wheel(0, -150);
    await page.waitForTimeout(500);

    const finalUrl = page.url();
    const finalTitle = await page.title();
    const expectedPath = `/${cleanUsername}/`;

    if (!finalUrl.toLowerCase().includes(expectedPath)) {
      throw createError(
        `Browser landed on wrong page. Expected ${expectedPath}, got ${finalUrl}`,
        409
      );
    }

    const html = await page.content();
    const mainGridShortcodes = getShortcodesFromHtml(
      html,
      Number.isFinite(postLimit) ? postLimit : Infinity
    );
    const mainGridStats = await extractMainGridStatsFromPage(page, cleanUsername);

    const reelsTab = await tryOpenReelsTab(page, cleanUsername);
    const reelsShortcodes = reelsTab.shortcodes || [];
    const reelStats = reelsTab.reelStats || [];

    const shortcodes = mergeShortcodes(mainGridShortcodes, reelsShortcodes);

    const mainGridStatsMap = new Map(
      mainGridStats.map((item) => [item.shortcode, Number(item.comments_count || 0)])
    );

    const reelStatsMap = new Map(
      reelStats.map((item) => [
        item.shortcode,
        {
          comments_count: Number(item.comments_count || 0),
          views_count: Number(item.views_count || 0),
        },
      ])
    );

    console.log("shortcode collection summary", {
      mainGridCount: mainGridShortcodes.length,
      reelsTabCount: reelsShortcodes.length,
      mergedCount: shortcodes.length,
      reelsTabUrl: reelsTab.url,
    });

    let totalComments = 0;
    let totalViews = 0;
    let postSuccessCount = 0;

    const fallbackCandidates = shortcodes.filter((item) => {
  const inReelsTab = reelStatsMap.has(item.shortcode);
  if (inReelsTab) return false;
  const gridComments = mainGridStatsMap.get(item.shortcode) || 0;
  return gridComments <= 0;
});

   for (const item of shortcodes) {
  if (reelStatsMap.has(item.shortcode)) {
    const stats = reelStatsMap.get(item.shortcode) || {
      comments_count: 0,
      views_count: 0,
    };
    totalComments += stats.comments_count;
    totalViews += stats.views_count;
    postSuccessCount += 1;
  } else {
    const gridComments = mainGridStatsMap.get(item.shortcode) || 0;
    totalComments += gridComments;
    postSuccessCount += 1;
  }
}

    for (let i = 0; i < fallbackCandidates.length; i += postConcurrency) {
      const batch = fallbackCandidates.slice(i, i + postConcurrency);
      const results = await Promise.all(
        batch.map((item) =>
          fetchSinglePostStats(context, debugDir, item.shortcode, item.type).catch((error) => ({
            shortcode: item.shortcode,
            error,
          }))
        )
      );

      for (const result of results) {
        if (result?.error) {
          console.error("browser post scrape fallback failed", {
            shortcode: result.shortcode,
            message: result.error?.message,
            statusCode: result.error?.statusCode,
          });
          continue;
        }

        const alreadyCounted = mainGridStatsMap.get(result.shortcode) || 0;
        if (result.comments_count > alreadyCounted) {
          totalComments += result.comments_count - alreadyCounted;
        }
      }

      await page.waitForTimeout(1200);
    }

    fs.writeFileSync(path.join(debugDir, `instagram-${cleanUsername}.html`), html, "utf8");
    fs.writeFileSync(
      path.join(debugDir, `instagram-${cleanUsername}-responses.json`),
      JSON.stringify(
        {
          profileResponses: collectedResponses.map((item) => ({
            url: item.url,
            status: item.status,
            matchesUsername: responseMatchesUsername(item.json, cleanUsername),
            hasCounts: responseHasCounts(item.json),
          })),
          mainGridShortcodes,
          mainGridStats,
          reelsShortcodes,
          reelStats,
          shortcodes,
          fallbackCandidates,
          postSuccessCount,
          totalComments,
          totalViews,
        },
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
      shortcodes,
      comments_count: totalComments,
      visible_views_count: totalViews,
      post_stats_meta: {
        postSuccessCount,
        processedPostCount: shortcodes.length,
        mainGridCount: mainGridShortcodes.length,
        reelsTabCount: reelsShortcodes.length,
        fallbackCount: fallbackCandidates.length,
      },
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