const axios = require("axios");

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://www.instagram.com/",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url, options = {}) {
  const {
    timeout = 20000,
    retries = 2,
    retryDelayMs = 1500,
    headers = {},
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await axios.get(url, {
        timeout,
        headers: {
          ...DEFAULT_HEADERS,
          ...headers,
        },
        validateStatus: () => true,
      });

      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }

      if (response.status === 404) {
        const error = new Error("Instagram page not found");
        error.statusCode = 404;
        throw error;
      }

      if (response.status === 429) {
        const error = new Error("Instagram rate limited the request");
        error.statusCode = 429;
        throw error;
      }

      lastError = new Error(`Failed to fetch page: ${response.status}`);
      lastError.statusCode = response.status;
    } catch (error) {
      lastError = error;
    }

    if (attempt < retries) {
      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}

async function fetchProfilePage(username) {
  const cleanUsername = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");

  if (!cleanUsername) {
    const error = new Error("Username is required");
    error.statusCode = 400;
    throw error;
  }

  const url = `https://www.instagram.com/${cleanUsername}/`;
  const html = await fetchHtml(url);

  return {
    username: cleanUsername,
    url,
    html,
  };
}

// Instagram's own web frontend calls this endpoint to get profile data as
// clean JSON (followers, posts count, and a page of recent posts with
// comment/view counts) without needing to be logged in, for public profiles.
// This is the data source the rest of the pipeline (getProfileNode in
// instagramScrapeService.js) already expects - it was just never being called.
const WEB_PROFILE_INFO_APP_ID = "936619743392459";

async function fetchProfileInfoJson(username) {
  const cleanUsername = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");

  if (!cleanUsername) {
    const error = new Error("Username is required");
    error.statusCode = 400;
    throw error;
  }

  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(
    cleanUsername
  )}`;

  const response = await axios.get(url, {
    timeout: 15000,
    validateStatus: () => true,
    headers: {
      ...DEFAULT_HEADERS,
      "x-ig-app-id": WEB_PROFILE_INFO_APP_ID,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "*/*",
      Referer: `https://www.instagram.com/${cleanUsername}/`,
    },
  });

  if (response.status === 404) {
    const error = new Error("Instagram profile not found");
    error.statusCode = 404;
    throw error;
  }

  if (response.status === 429) {
    const error = new Error("Instagram rate limited the web_profile_info request");
    error.statusCode = 429;
    throw error;
  }

  if (response.status >= 400) {
    const error = new Error(
      `web_profile_info request failed with status ${response.status}`
    );
    error.statusCode = response.status;
    throw error;
  }

  const body = typeof response.data === "string" ? safeJsonParse(response.data) : response.data;
  const user = body?.data?.user;

  if (!user || !user.username) {
    const error = new Error(
      "web_profile_info response had no user (Instagram likely served a login/challenge wall)"
    );
    error.statusCode = 403;
    throw error;
  }

  return {
    username: cleanUsername,
    url: `https://www.instagram.com/${cleanUsername}/`,
    profile: user,
  };
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function fetchPostPage(shortcode, type = "post", options = {}) {
  const segment = type === "reel" ? "reel" : "p";
  const url = `https://www.instagram.com/${segment}/${shortcode}/`;
  const html = await fetchHtml(url, {
    timeout: options.timeout ?? 15000,
    retries: options.retries ?? 1,
  });

  return { url, html };
}

async function fetchContentPage(pathOrUrl) {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `https://www.instagram.com${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;

  const html = await fetchHtml(url);

  return {
    url,
    html,
  };
}

module.exports = {
  fetchHtml,
  fetchProfilePage,
  fetchProfileInfoJson,
  fetchPostPage,
  fetchContentPage,
};