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

function decodeHtmlEntities(value) {
  if (!value || typeof value !== "string") return value || "";
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^instagram\.com\//i, "")
    .replace(/^u\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .split(/[?#/]/)[0];
}

function extractMetaContent(html, attr, attrValue) {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${escapeRegExp(attrValue)}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
    "i"
  );
  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+${attr}=["']${escapeRegExp(attrValue)}["'][^>]*>`,
    "i"
  );

  const match = html.match(pattern) || html.match(reversePattern);
  return match ? decodeHtmlEntities(match[1]).trim() : null;
}

function extractLinkHref(html, relValue) {
  const pattern = new RegExp(
    `<link[^>]+rel=["']${escapeRegExp(relValue)}["'][^>]+href=["']([\\s\\S]*?)["'][^>]*>`,
    "i"
  );
  const reversePattern = new RegExp(
    `<link[^>]+href=["']([\\s\\S]*?)["'][^>]+rel=["']${escapeRegExp(relValue)}["'][^>]*>`,
    "i"
  );

  const match = html.match(pattern) || html.match(reversePattern);
  return match ? decodeHtmlEntities(match[1]).trim() : null;
}

// The profile grid no longer carries per-post comment/view counts (Instagram
// removed those from the embedded/GraphQL profile payload for anonymous
// requests). Individual post shortcodes are still visible as plain anchor
// hrefs in the rendered grid though, so we can pull those and then visit
// each post page individually to get its real comment/view counts.
function extractRecentPostShortcodes(html, limit = 12) {
  if (!html) return [];

  const seen = new Set();
  const results = [];

  const patterns = [
    // <a href="/p/ABC123/"> or <a href='/reel/ABC123'> - either quote style,
    // optionally with a full domain prefix.
    /href=["'](?:https?:\/\/[^"'/]+)?\/(p|reel)\/([A-Za-z0-9_-]{5,})\/?["']/g,
    // Bare URLs anywhere in the HTML/JSON blobs, e.g.
    // "https://www.instagram.com/p/ABC123/" or "/reel/ABC123/"
    /(?:https?:\/\/[^"'\s]*instagram\.com)?\/(p|reel)\/([A-Za-z0-9_-]{5,})\/?/g,
    // Raw JSON field, e.g. "shortcode":"ABC123"
    /"shortcode"\s*:\s*"([A-Za-z0-9_-]{5,})"/g,
  ];

  for (const pattern of patterns) {
    let match;
    let patternMatches = 0;
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
      patternMatches += 1;
      results.push({ shortcode, type });

      if (results.length >= limit) break;
    }
    console.log(`extractRecentPostShortcodes pattern matched ${patternMatches} new shortcode(s)`);
    if (results.length >= limit) break;
  }

  console.log("extractRecentPostShortcodes total", { count: results.length });

  return results;
}

// Individual post pages generally still expose a comment count and (for
// videos/reels) a view count in the page's meta description or inline text,
// even when the profile-level GraphQL payload is masked for anonymous
// requests. We try several patterns since Instagram's markup varies by
// post type and has changed formatting over time.
function parsePostStatsFromHtml(html) {
  if (!html) return { comments_count: 0, views_count: 0 };

  const ogDescription =
    extractMetaContent(html, "property", "og:description") ||
    extractMetaContent(html, "name", "description") ||
    "";

  const text = cleanText(ogDescription);

  // e.g. "1,234 likes, 56 comments - username on Instagram: ..."
  const commentsMatch =
    text.match(/([\d.,]+(?:\s*[KMB])?)\s+comments?/i) ||
    html.match(/"edge_media_to_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/i) ||
    html.match(/"edge_media_to_parent_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/i);

  // e.g. "12,345 views" for reels/videos
  const viewsMatch =
    text.match(/([\d.,]+(?:\s*[KMB])?)\s+views?/i) ||
    html.match(/"video_view_count"\s*:\s*(\d+)/i) ||
    html.match(/"video_play_count"\s*:\s*(\d+)/i);

  return {
    comments_count: commentsMatch ? parseCompactNumber(commentsMatch[1]) : 0,
    views_count: viewsMatch ? parseCompactNumber(viewsMatch[1]) : 0,
  };
}

function extractJsonLd(html) {
  const match = html.match(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i
  );

  if (!match) return null;
  return safeJsonParse(match[1]);
}

function extractScriptContents(html) {
  const scripts = [];
  const matches = html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of matches) {
    const content = match[1] || "";
    if (content.trim()) {
      scripts.push(content);
    }
  }

  return scripts;
}

function hasUsefulProfileCounts(value) {
  return Boolean(
    value?.edge_followed_by?.count ||
      value?.follower_count ||
      value?.edge_owner_to_timeline_media?.count ||
      value?.media_count ||
      value?.posts_count
  );
}

function looksLikeProfileObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.username === "string" &&
      (
        Object.prototype.hasOwnProperty.call(value, "is_private") ||
        Object.prototype.hasOwnProperty.call(value, "full_name") ||
        Object.prototype.hasOwnProperty.call(value, "profile_pic_url") ||
        Object.prototype.hasOwnProperty.call(value, "edge_followed_by") ||
        Object.prototype.hasOwnProperty.call(value, "edge_owner_to_timeline_media") ||
        Object.prototype.hasOwnProperty.call(value, "follower_count") ||
        Object.prototype.hasOwnProperty.call(value, "media_count") ||
        Object.prototype.hasOwnProperty.call(value, "posts_count")
      )
  );
}

function findMatchingProfileObjects(value, expectedUsername, results = []) {
  if (!value || typeof value !== "object") return results;

  if (Array.isArray(value)) {
    for (const item of value) {
      findMatchingProfileObjects(item, expectedUsername, results);
    }
    return results;
  }

  if (looksLikeProfileObject(value)) {
    const currentUsername = normalizeUsername(value.username);
    if (currentUsername === expectedUsername) {
      results.push(value);
    }
  }

  for (const key of Object.keys(value)) {
    findMatchingProfileObjects(value[key], expectedUsername, results);
  }

  return results;
}

function pickBestProfileCandidate(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const withCounts = candidates.filter(hasUsefulProfileCounts);
  if (withCounts.length > 0) {
    withCounts.sort((a, b) => {
      const aScore =
        Number(a?.edge_followed_by?.count || a?.follower_count || 0) +
        Number(a?.edge_owner_to_timeline_media?.count || a?.media_count || a?.posts_count || 0);

      const bScore =
        Number(b?.edge_followed_by?.count || b?.follower_count || 0) +
        Number(b?.edge_owner_to_timeline_media?.count || b?.media_count || b?.posts_count || 0);

      return bScore - aScore;
    });

    return withCounts[0];
  }

  return candidates[0];
}

function tryExtractEmbeddedProfileObject(html, expectedUsername) {
  const scripts = extractScriptContents(html);
  const candidates = [];

  for (const scriptContent of scripts) {
    if (
      expectedUsername &&
      !scriptContent.includes(`"${expectedUsername}"`) &&
      !scriptContent.toLowerCase().includes(expectedUsername)
    ) {
      continue;
    }

    const objectMatches = scriptContent.match(/\{[\s\S]*\}/g) || [];

    for (const rawObject of objectMatches) {
      const parsed = safeJsonParse(rawObject);
      if (!parsed) continue;
      findMatchingProfileObjects(parsed, expectedUsername, candidates);
    }
  }

  const best = pickBestProfileCandidate(candidates);

  console.log("embedded profile candidates", {
    expectedUsername,
    candidateCount: candidates.length,
    bestUsername: best?.username || null,
    bestHasCounts: hasUsefulProfileCounts(best),
  });

  return best;
}

function findProfileInNetworkResponses(responses, expectedUsername) {
  if (!Array.isArray(responses) || !expectedUsername) return null;

  const cleanUsername = normalizeUsername(expectedUsername);
  const candidates = [];

  for (const item of responses) {
    if (!item || typeof item !== "object") continue;
    findMatchingProfileObjects(item.json, cleanUsername, candidates);
  }

  const best = pickBestProfileCandidate(candidates);

  console.log("network profile candidates", {
    expectedUsername: cleanUsername,
    candidateCount: candidates.length,
    bestUsername: best?.username || null,
    bestHasCounts: hasUsefulProfileCounts(best),
  });

  return best;
}

function normalizePostNode(node) {
  if (!node || typeof node !== "object") return null;

  const shortcode = node.shortcode || null;
  const commentsCount =
    Number(node.edge_media_to_comment?.count || node.edge_media_preview_comment?.count || node.comment_count || 0) || 0;
  const visibleViewsCount =
    Number(node.video_view_count || node.video_play_count || node.view_count || 0) || 0;

  let url = null;
  if (shortcode) {
    const prefix = node.is_video ? "/reel/" : "/p/";
    url = `https://www.instagram.com${prefix}${shortcode}/`;
  }

  return {
    shortcode,
    url,
    comments_count: commentsCount,
    visible_views_count: visibleViewsCount,
    is_video: Boolean(node.is_video),
  };
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

function extractCountsFromOgDescription(ogDescription) {
  const text = cleanText(ogDescription);
  if (!text) return null;

  const followersMatch = text.match(/([\d.,]+(?:\s*[KMB])?)\s+Followers/i);
  const followingMatch = text.match(/([\d.,]+(?:\s*[KMB])?)\s+Following/i);
  const postsMatch = text.match(/([\d.,]+(?:\s*[KMB])?)\s+Posts/i);

  return {
    followers_count: followersMatch ? parseCompactNumber(followersMatch[1]) : 0,
    following_count: followingMatch ? parseCompactNumber(followingMatch[1]) : 0,
    posts_count: postsMatch ? parseCompactNumber(postsMatch[1]) : 0,
  };
}

function extractVisibleCount(html, label) {
  const regex = new RegExp(
    `title=["']([\\d.,]+)["'][\\s\\S]{0,300}?${escapeRegExp(label)}`,
    "i"
  );
  const match = html.match(regex);
  if (match) return parseCompactNumber(match[1]);

  const compactRegex = new RegExp(
    `>\\s*([\\d.,]+(?:\\s*[KMB])?)\\s*<[^>]*>\\s*${escapeRegExp(label)}`,
    "i"
  );
  const compactMatch = html.match(compactRegex);
  if (compactMatch) return parseCompactNumber(compactMatch[1]);

  return 0;
}

function extractBioFromHtml(html) {
  const metaDescription = extractMetaContent(html, "name", "description");
  if (metaDescription) {
    const cleaned = cleanText(metaDescription);
    const split = cleaned.split(/\bon Instagram[:"]?\s*/i);
    const bioCandidate = split.length > 1 ? split.slice(1).join(" ") : cleaned;
    return bioCandidate.replace(/^["']|["']$/g, "").trim();
  }

  const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return cleanText(h1Match[1]);

  return null;
}

function extractProfileFromHtmlFallback(html, expectedUsername) {
  const canonicalUrl = extractLinkHref(html, "canonical");
  const alternateUrl = extractMetaContent(html, "property", "al:ios:url");
  const ogUrl = extractMetaContent(html, "property", "og:url");
  const ogTitle = extractMetaContent(html, "property", "og:title");
  const ogDescription = extractMetaContent(html, "property", "og:description");
  const description = extractMetaContent(html, "name", "description");

  const canonicalUsername = normalizeUsername(canonicalUrl);
  const alternateUsername = normalizeUsername(alternateUrl);
  const ogUrlUsername = normalizeUsername(ogUrl);

  const username =
    expectedUsername ||
    canonicalUsername ||
    alternateUsername ||
    ogUrlUsername ||
    normalizeUsername(
      (ogTitle || "").match(/\b([A-Za-z0-9._]+)\s+Instagram/i)?.[1]
    );

  if (!username) return null;

  const titleMatch = cleanText(ogTitle || "").match(/^(.*?)\s+([A-Za-z0-9._]+)\s+Instagram/i);
  const profileName = titleMatch ? cleanText(titleMatch[1]) : null;

  const countsFromOg = extractCountsFromOgDescription(ogDescription || description || "");
  const followersCount =
    extractVisibleCount(html, "followers") ||
    countsFromOg?.followers_count ||
    0;
  const postsCount =
    extractVisibleCount(html, "posts") ||
    countsFromOg?.posts_count ||
    0;

  return {
    username,
    full_name: profileName,
    is_private: false,
    follower_count: followersCount,
    posts_count: postsCount,
    media_count: postsCount,
    biography: extractBioFromHtml(html),
    profile_url: canonicalUrl || ogUrl || `https://www.instagram.com/${username}/`,
  };
}

function buildParsedProfile(profile, jsonLd, expectedUsername) {
  const username =
    profile?.username ||
    normalizeUsername(jsonLd?.alternateName) ||
    expectedUsername ||
    null;

  if (expectedUsername && username && username.toLowerCase() !== expectedUsername) {
    throw createError(
      `Parsed wrong Instagram profile. Expected ${expectedUsername} but got ${username}`,
      409
    );
  }

  const profileName =
    profile?.full_name ||
    jsonLd?.name ||
    null;

  const isPrivate = Boolean(profile?.is_private);
  const followersCount =
    Number(profile?.edge_followed_by?.count || profile?.follower_count || 0) || 0;

  const postsCount =
    Number(
      profile?.edge_owner_to_timeline_media?.count ||
        profile?.media_count ||
        profile?.posts_count ||
        0
    ) || 0;

  const edges = profile?.edge_owner_to_timeline_media?.edges || [];
  const posts = edges
    .map((edge) => normalizePostNode(edge?.node))
    .filter(Boolean);

  return {
    username,
    profile_name: profileName,
    profile_url:
      profile?.profile_url ||
      (username ? `https://www.instagram.com/${username}/` : null),
    is_public: !isPrivate,
    followers_count: followersCount,
    posts_count: postsCount,
    posts,
    raw_payload: {
      profile,
      jsonLd,
    },
  };
}

function parseProfilePage(html, fallbackUsername) {
  if (!html) {
    throw createError("Empty Instagram HTML", 500);
  }

  const expectedUsername = normalizeUsername(fallbackUsername);
  const lowerHtml = html.toLowerCase();

  const jsonLd = extractJsonLd(html);

  const jsonLdUsername = normalizeUsername(jsonLd?.alternateName);
  if (jsonLdUsername && expectedUsername && jsonLdUsername !== expectedUsername) {
    throw createError(
      `Parsed wrong Instagram profile from jsonLd. Expected ${expectedUsername} but got ${jsonLdUsername}`,
      409
    );
  }

  let profile = tryExtractEmbeddedProfileObject(html, expectedUsername);

  if (!profile) {
    profile = extractProfileFromHtmlFallback(html, expectedUsername);
  } else if (!hasUsefulProfileCounts(profile)) {
    // The embedded-JSON search can match a profile-shaped object that isn't
    // actually the main profile node (e.g. a business/monetization-settings
    // blob that happens to have username/full_name/is_private but no
    // follower/post counts at all). Rather than silently accepting that as
    // "success" with zero counts, fall back to the meta-description-based
    // extraction and merge in real counts if it has them.
    console.log(
      "embedded profile candidate lacked follower/post counts - trying meta-description fallback for counts"
    );

    const fallbackProfile = extractProfileFromHtmlFallback(html, expectedUsername);

    if (fallbackProfile && hasUsefulProfileCounts(fallbackProfile)) {
      profile = {
        ...profile,
        follower_count: fallbackProfile.follower_count,
        posts_count: fallbackProfile.posts_count,
        media_count: fallbackProfile.media_count,
        biography: profile.biography || fallbackProfile.biography,
      };
    }
  }

  if (!profile && !jsonLd) {
    if (
      lowerHtml.includes("page not found") ||
      lowerHtml.includes("sorry, this page isn't available")
    ) {
      throw createError("Instagram profile not found", 404);
    }

    if (
      lowerHtml.includes('aria-label="close"') ||
      lowerHtml.includes("sign up and never miss a post") ||
      lowerHtml.includes("by continuing, you agree to instagram's") ||
      lowerHtml.includes("checkpoint") ||
      lowerHtml.includes("suspicious activity") ||
      (lowerHtml.includes("log in") && !lowerHtml.includes("followers")) ||
      (lowerHtml.includes("sign up") && !lowerHtml.includes("followers"))
    ) {
      throw createError("Instagram returned a login wall", 403);
    }

    throw createError("Could not parse Instagram profile page", 500);
  }

  return buildParsedProfile(profile, jsonLd, expectedUsername);
}

module.exports = {
  parseProfilePage,
  findProfileInNetworkResponses,
  buildParsedProfile,
  extractRecentPostShortcodes,
  parsePostStatsFromHtml,
};