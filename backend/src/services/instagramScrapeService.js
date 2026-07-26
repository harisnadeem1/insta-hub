const {
  fetchProfilePage,
  fetchProfileInfoJson,
  fetchPostPage,
} = require("./scrapers/instagramHttpScraper");
const {
  fetchProfilePageWithCrawlbase,
} = require("./scrapers/instagramCrawlbaseScraper");
const {
  fetchProfilePageWithBrowser,
} = require("./scrapers/instagramBrowserScraper");
const {
  parseProfilePage,
  findProfileInNetworkResponses,
  extractRecentPostShortcodes,
  parsePostStatsFromHtml,
} = require("./scrapers/instagramParser");

// A username that truly doesn't exist (or a bad request) is the only case
// where trying another scraping method is pointless. Every other error
// (rate limits, login walls, timeouts, missing API keys, parser mismatches,
// etc.) should just mean "try the next method" - previously this only
// happened for a hand-picked allow-list of error messages/codes, which meant
// unexpected errors (e.g. a missing CRAWLBASE_JS_TOKEN) killed the whole
// chain instead of falling through to the next scraper.
// Toggle individual scraping methods on/off via env vars, instead of
// deleting code, so a method can be re-enabled later if it starts working
// again (e.g. once a valid CRAWLBASE_JS_TOKEN is set, or Instagram stops
// rate-limiting the JSON API). Based on observed behavior, the JSON API and
// Crawlbase are OFF by default (they were consistently failing and Crawlbase
// was burning a full 60s timeout every run); the browser scraper - the one
// actually returning real data - stays ON by default.
const METHOD_ENABLED = {
  instagram_web_api: process.env.SCRAPER_ENABLE_JSON_API === "true",
  custom_http_scraper: process.env.SCRAPER_ENABLE_HTTP_SCRAPER === "true",
  crawlbase_html_scraper: process.env.SCRAPER_ENABLE_CRAWLBASE === "true",
  browser_scraper: process.env.SCRAPER_ENABLE_BROWSER !== "false",
};

function isDefinitiveNotFound(error) {
  return Boolean(error) && error.statusCode === 404;
}

function getProfileNode(profile) {
  if (!profile) return null;

  if (profile?.edge_followed_by || profile?.edge_owner_to_timeline_media) {
    return profile;
  }

  if (profile?.user) {
    return profile.user;
  }

  if (profile?.data?.user) {
    return profile.data.user;
  }

  if (profile?.graphql?.user) {
    return profile.graphql.user;
  }

  if (profile?.data?.xdt_api__v1__users__web_profile_info?.user) {
    return profile.data.xdt_api__v1__users__web_profile_info.user;
  }

  return profile;
}

function buildNormalizedProfile(profile, source, requestedUsername) {
  const node = getProfileNode(profile);

  console.log("buildNormalizedProfile start", {
    source,
    requestedUsername,
    parsedUsername: node?.username,
    topLevelKeys: profile ? Object.keys(profile).slice(0, 20) : [],
    nodeKeys: node ? Object.keys(node).slice(0, 20) : [],
  });

  const username = String(node?.username || "").trim().toLowerCase();
  const expected = String(requestedUsername || "").trim().toLowerCase().replace(/^@+/, "");

  if (!username || username !== expected) {
    const error = new Error(
      `Scraper mismatch: expected ${expected}, got ${username || "unknown"}`
    );
    error.statusCode = 409;
    throw error;
  }

  const followersCount =
    Number(
      node?.edge_followed_by?.count ||
      node?.follower_count ||
      node?.followers ||
      0
    ) || 0;

  const postsCount =
    Number(
      node?.edge_owner_to_timeline_media?.count ||
      node?.media_count ||
      node?.posts_count ||
      0
    ) || 0;

  const edges =
    node?.edge_owner_to_timeline_media?.edges ||
    node?.timeline_media?.edges ||
    [];

  const posts = edges.map((edge) => {
    const postNode = edge?.node || {};
    return {
      comments_count:
        Number(
          postNode.edge_media_to_comment?.count ||
          postNode.edge_media_preview_comment?.count ||
          postNode.comment_count ||
          0
        ) || 0,
      visible_views_count:
        Number(
          postNode.video_view_count ||
          postNode.video_play_count ||
          postNode.view_count ||
          postNode.play_count ||
          0
        ) || 0,
    };
  });

  const commentsCount = posts.reduce((sum, post) => sum + Number(post.comments_count || 0), 0);
  const visibleViewsCount = posts.reduce((sum, post) => sum + Number(post.visible_views_count || 0), 0);

  console.log("buildNormalizedProfile success", {
    username,
    followersCount,
    postsCount,
    commentsCount,
    visibleViewsCount,
  });

  return {
    username,
    profile_name: node?.full_name || node?.profile_name || null,
    profile_url: `https://www.instagram.com/${username}/`,
    is_public: !Boolean(node?.is_private),
    followers_count: followersCount,
    posts_count: postsCount,
    comments_count: commentsCount,
    visible_views_count: visibleViewsCount,
    source,
    raw_payload: {
      scraper_source: source,
      scraped_username: requestedUsername,
      scraped_at: new Date().toISOString(),
      parsed_payload: {
        profile,
        normalized_node: node,
      },
    },
  };
}

function withTimeout(promise, ms, label) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out after ${ms}ms`);
      error.statusCode = 504;
      reject(error);
    }, ms);

    if (typeof timer.unref === "function") {
      timer.unref();
    }
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

// Instagram sometimes returns a "successfully parsed" but deliberately
// masked profile object to logged-out/anonymous requests: the right keys
// are present (edge_followed_by, edge_owner_to_timeline_media) but every
// count inside is 0. That's not a parsing failure, so it won't throw - but
// it's also not real data, so we should NOT treat it as success. This gate
// catches that case so we keep trying other methods instead of saving zeros.
function hasMeaningfulCounts(normalized) {
  return (
    Number(normalized?.followers_count || 0) > 0 ||
    Number(normalized?.posts_count || 0) > 0
  );
}

// The profile-level payload (from any of the four methods) no longer
// includes per-post data, so comments_count/visible_views_count always come
// back 0 from buildNormalizedProfile alone. If the raw node we parsed
// happens to include edge_owner_to_timeline_media.edges (some methods still
// return a few), pull shortcodes straight from there. Otherwise fall back to
// scraping shortcodes out of the raw HTML we already fetched.
function getShortcodesFromNode(node) {
  const edges = node?.edge_owner_to_timeline_media?.edges || [];
  return edges
    .map((edge) => edge?.node)
    .filter(Boolean)
    .map((n) => ({ shortcode: n.shortcode, type: n.is_video ? "reel" : "post" }))
    .filter((item) => Boolean(item.shortcode));
}

async function enrichWithRecentPostStats(normalized, shortcodes, limit = 12, concurrency = 2) {
  if (!Array.isArray(shortcodes) || shortcodes.length === 0) {
    console.log("no post shortcodes available to enrich comments/views");
    return normalized;
  }

  const sample = shortcodes.slice(0, limit);
  let totalComments = 0;
  let totalViews = 0;
  let succeeded = 0;

  async function fetchOne({ shortcode, type }) {
    try {
      const { html } = await withTimeout(
        fetchPostPage(shortcode, type, { timeout: 15000, retries: 1 }),
        20000,
        `Post page ${shortcode}`
      );

      const stats = parsePostStatsFromHtml(html);

      console.log("post stats parsed", {
        shortcode,
        comments: stats.comments_count,
        views: stats.views_count,
      });

      totalComments += stats.comments_count;
      totalViews += stats.views_count;
      succeeded += 1;
    } catch (error) {
      console.error(`Failed to fetch stats for post ${shortcode}`, {
        message: error?.message,
        statusCode: error?.statusCode,
      });
    }
  }

  for (let i = 0; i < sample.length; i += concurrency) {
    const batch = sample.slice(i, i + concurrency);
    await Promise.all(batch.map(fetchOne));
  }

  return {
    ...normalized,
    comments_count: totalComments,
    visible_views_count: totalViews,
  };
}

exports.scrapePublicProfile = async ({ username }) => {
  const requestedUsername = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");

  console.log("scrapePublicProfile start", { requestedUsername });

  const attemptErrors = [];
  let bestZeroCountResult = null;

  function recordZeroCountResult(normalized, step) {
    console.log(
      `${step} returned a parsed profile with all-zero counts (likely an anonymous-request placeholder) - trying next method for real data`
    );
    if (!bestZeroCountResult) {
      bestZeroCountResult = normalized;
    }
  }

  // 1. Instagram's own web_profile_info JSON API. This is the primary,
  // fastest, most reliable path for public profiles and gives real
  // followers/posts/comments/views counts directly as JSON - no HTML
  // parsing or guessing needed.
  if (METHOD_ENABLED.instagram_web_api) {
  try {
    console.log("1. trying Instagram web_profile_info JSON API");

    const jsonResult = await withTimeout(
      fetchProfileInfoJson(requestedUsername),
      15000,
      "Instagram web_profile_info API"
    );

    console.log("2. JSON API responded", {
      username: jsonResult?.profile?.username,
    });

    const normalized = buildNormalizedProfile(
      jsonResult.profile,
      "instagram_web_api",
      requestedUsername
    );

    if (hasMeaningfulCounts(normalized)) {
      const shortcodes = getShortcodesFromNode(jsonResult.profile);
      return await enrichWithRecentPostStats(normalized, shortcodes);
    }
    recordZeroCountResult(normalized, "JSON API");
  } catch (error) {
    console.error("JSON API failed", {
      message: error?.message,
      statusCode: error?.statusCode,
    });
    attemptErrors.push({ step: "instagram_web_api", error });

    if (isDefinitiveNotFound(error)) throw error;
  }
  } else {
    console.log("1. skipping Instagram web_profile_info JSON API (disabled)");
  }
  console.log("3. trying HTTP HTML scraper next");

  if (METHOD_ENABLED.custom_http_scraper) {
  try {
    console.log("4. trying HTTP HTML scraper");

    const page = await withTimeout(
      fetchProfilePage(requestedUsername),
      20000,
      "HTTP scraper fetchProfilePage"
    );

    console.log("5. HTTP scraper page fetched", {
      username: page?.username,
      htmlLength: page?.html?.length || 0,
    });

    const parsed = parseProfilePage(page.html, page.username);
    console.log("6. HTTP scraper page parsed");

    const normalized = buildNormalizedProfile(
      parsed.raw_payload.profile,
      "custom_http_scraper",
      requestedUsername
    );

    if (hasMeaningfulCounts(normalized)) {
      const shortcodes = extractRecentPostShortcodes(page.html);
      return await enrichWithRecentPostStats(normalized, shortcodes);
    }
    recordZeroCountResult(normalized, "HTTP HTML scraper");
  } catch (error) {
    console.error("HTTP scraper failed", {
      message: error?.message,
      statusCode: error?.statusCode,
      stack: error?.stack,
    });
    attemptErrors.push({ step: "custom_http_scraper", error });

    if (isDefinitiveNotFound(error)) throw error;
  }
  } else {
    console.log("4. skipping HTTP HTML scraper (disabled)");
  }

  console.log("7. trying Crawlbase next");

  if (METHOD_ENABLED.crawlbase_html_scraper) {
  try {
    const crawlbasePage = await withTimeout(
      fetchProfilePageWithCrawlbase(requestedUsername),
      60000,
      "Crawlbase fetchProfilePageWithCrawlbase"
    );

    console.log("8. Crawlbase page fetched", {
      username: crawlbasePage?.username,
      htmlLength: crawlbasePage?.html?.length || 0,
    });

    const parsed = parseProfilePage(crawlbasePage.html, requestedUsername);
    console.log("9. Crawlbase page parsed");

    const normalized = buildNormalizedProfile(
      parsed.raw_payload.profile,
      "crawlbase_html_scraper",
      requestedUsername
    );

    if (hasMeaningfulCounts(normalized)) {
      const shortcodes = extractRecentPostShortcodes(crawlbasePage.html);
      return await enrichWithRecentPostStats(normalized, shortcodes);
    }
    recordZeroCountResult(normalized, "Crawlbase");
  } catch (error) {
    console.error("Crawlbase scraper failed", {
      message: error?.message,
      statusCode: error?.statusCode,
      stack: error?.stack,
    });
    attemptErrors.push({ step: "crawlbase_html_scraper", error });

    if (isDefinitiveNotFound(error)) throw error;
  }
  } else {
    console.log("8. skipping Crawlbase (disabled)");
  }

  console.log("10. falling back to browser scraper");

  console.log("10. falling back to browser scraper");

if (METHOD_ENABLED.browser_scraper) {
  try {
    const browserPage = await withTimeout(
  fetchProfilePageWithBrowser(requestedUsername, {
    postLimit: Infinity,
    postConcurrency: 1,
  }),
  600000,
  "Browser scraper fetchProfilePageWithBrowser"
);

    console.log("11. browser scraper returned", {
  htmlLength: browserPage?.html?.length || 0,
  responsesCount: browserPage?.responses?.length || 0,
  reportedPostCount: browserPage?.post_stats_meta?.reportedPostCount || 0,
  mainGridCount: browserPage?.post_stats_meta?.mainGridCount || 0,
  reelsTabCount: browserPage?.post_stats_meta?.reelsTabCount || 0,
  processedPostCount:
    browserPage?.post_stats_meta?.processedPostCount ||
    browserPage?.post_stats_meta?.sampledPostCount ||
    0,
  postSuccessCount: browserPage?.post_stats_meta?.postSuccessCount || 0,
  mainGridCoverageRatio: browserPage?.post_stats_meta?.mainGridCoverageRatio ?? null,
  comments_count: browserPage?.comments_count || 0,
  visible_views_count: browserPage?.visible_views_count || 0,
});

    const networkProfile = findProfileInNetworkResponses(
      browserPage.responses,
      requestedUsername
    );

    console.log("12. network profile lookup complete", {
      found: Boolean(networkProfile),
    });

    const hasUsableCounts = Boolean(
      networkProfile?.edge_followed_by?.count ||
      networkProfile?.follower_count ||
      networkProfile?.edge_owner_to_timeline_media?.count ||
      networkProfile?.media_count ||
      networkProfile?.posts_count
    );

    console.log("networkProfile usable counts", {
      hasUsableCounts,
      followerCount:
        networkProfile?.edge_followed_by?.count ??
        networkProfile?.follower_count ??
        null,
      postsCount:
        networkProfile?.edge_owner_to_timeline_media?.count ??
        networkProfile?.media_count ??
        networkProfile?.posts_count ??
        null,
    });

    if (networkProfile && hasUsableCounts) {
      const normalizedNetwork = buildNormalizedProfile(
        networkProfile,
        "custom_browser_network_scraper",
        requestedUsername
      );

      normalizedNetwork.comments_count =
        Number(browserPage?.comments_count || 0);
      normalizedNetwork.visible_views_count =
        Number(browserPage?.visible_views_count || 0);

      normalizedNetwork.raw_payload = {
        ...normalizedNetwork.raw_payload,
        browser_post_stats: {
  reportedPostCount: browserPage?.post_stats_meta?.reportedPostCount || 0,
  mainGridCount: browserPage?.post_stats_meta?.mainGridCount || 0,
  reelsTabCount: browserPage?.post_stats_meta?.reelsTabCount || 0,
  processedPostCount:
    browserPage?.post_stats_meta?.processedPostCount ||
    browserPage?.post_stats_meta?.sampledPostCount ||
    0,
  postSuccessCount: browserPage?.post_stats_meta?.postSuccessCount || 0,
  mainGridCoverageRatio: browserPage?.post_stats_meta?.mainGridCoverageRatio ?? null,
  comments_count: browserPage?.comments_count || 0,
  visible_views_count: browserPage?.visible_views_count || 0,
  shortcodes: browserPage?.shortcodes || [],
},
      };

      return normalizedNetwork;
    }

    console.log("13. network profile missing counts, falling back to browser HTML parse");

    const parsed = parseProfilePage(browserPage.html, requestedUsername);
    console.log("14. browser HTML parsed");

    const normalized = buildNormalizedProfile(
      parsed.raw_payload.profile,
      "custom_browser_html_scraper",
      requestedUsername
    );

    normalized.comments_count =
      Number(browserPage?.comments_count || 0);
    normalized.visible_views_count =
      Number(browserPage?.visible_views_count || 0);

    normalized.raw_payload = {
      ...normalized.raw_payload,
      browser_post_stats: {
  reportedPostCount: browserPage?.post_stats_meta?.reportedPostCount || 0,
  mainGridCount: browserPage?.post_stats_meta?.mainGridCount || 0,
  reelsTabCount: browserPage?.post_stats_meta?.reelsTabCount || 0,
  processedPostCount:
    browserPage?.post_stats_meta?.processedPostCount ||
    browserPage?.post_stats_meta?.sampledPostCount ||
    0,
  postSuccessCount: browserPage?.post_stats_meta?.postSuccessCount || 0,
  mainGridCoverageRatio: browserPage?.post_stats_meta?.mainGridCoverageRatio ?? null,
  comments_count: browserPage?.comments_count || 0,
  visible_views_count: browserPage?.visible_views_count || 0,
  shortcodes: browserPage?.shortcodes || [],
},
    };

    if (hasMeaningfulCounts(normalized)) {
      return normalized;
    }

    if (!bestZeroCountResult) {
      return normalized;
    }

    console.log(
      "15. browser also returned all-zero counts - returning earlier zero-count result"
    );
    return bestZeroCountResult;
  } catch (error) {
    console.error("Browser scraper failed", {
      message: error?.message,
      statusCode: error?.statusCode,
      stack: error?.stack,
    });
    attemptErrors.push({ step: "browser_scraper", error });

    if (isDefinitiveNotFound(error)) throw error;

    if (bestZeroCountResult) {
      console.log(
        "16. browser failed but an earlier method returned a zero-count profile - using that rather than failing entirely"
      );
      return bestZeroCountResult;
    }

    const summary = attemptErrors
      .map((a) => `${a.step}: ${a.error?.statusCode || "?"} ${a.error?.message}`)
      .join(" | ");

    const finalError = new Error(
      `All Instagram scraping methods failed for "${requestedUsername}". ${summary}`
    );
    finalError.statusCode = error?.statusCode || 502;
    finalError.attempts = attemptErrors.map((a) => ({
      step: a.step,
      message: a.error?.message,
      statusCode: a.error?.statusCode,
    }));

    throw finalError;
  }
} else {
  console.log("10. skipping browser scraper (disabled)");
}

  // If we get here, every enabled method either failed or returned a
  // zero-count profile with no better fallback to reach for.
  if (bestZeroCountResult) {
    console.log(
      "17. no method returned meaningful counts - using best zero-count result available"
    );
    return bestZeroCountResult;
  }

  const summary = attemptErrors
    .map((a) => `${a.step}: ${a.error?.statusCode || "?"} ${a.error?.message}`)
    .join(" | ") || "no scraping methods were enabled";

  const finalError = new Error(
    `All enabled Instagram scraping methods failed for "${requestedUsername}". ${summary}`
  );
  finalError.statusCode = 502;
  finalError.attempts = attemptErrors.map((a) => ({
    step: a.step,
    message: a.error?.message,
    statusCode: a.error?.statusCode,
  }));

  throw finalError;
};