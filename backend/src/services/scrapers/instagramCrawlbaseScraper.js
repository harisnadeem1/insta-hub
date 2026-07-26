const axios = require("axios");

function createError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function fetchProfilePageWithCrawlbase(username) {
  const cleanUsername = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");

  if (!cleanUsername) {
    throw createError("Username is required", 400);
  }

  const token = process.env.CRAWLBASE_JS_TOKEN;
  if (!token) {
    throw createError("CRAWLBASE_JS_TOKEN is missing", 500);
  }

  const targetUrl = `https://www.instagram.com/${cleanUsername}/`;

  const response = await axios.get("https://api.crawlbase.com/", {
    params: {
      token,
      url: targetUrl,
    },
    timeout: 60000,
    responseType: "text",
    validateStatus: () => true,
  });

  if (response.status >= 400) {
    throw createError(
      `Crawlbase request failed with status ${response.status}`,
      response.status
    );
  }

  const html = String(response.data || "");

  return {
    username: cleanUsername,
    url: targetUrl,
    html,
  };
}

module.exports = {
  fetchProfilePageWithCrawlbase,
};