const pool = require("../config/db");

const instagramScrapeService = require("./instagramScrapeService");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

function normalizeOptionalText(value) {
  const cleaned = String(value || "").trim();
  return cleaned || null;
}

async function getOwnedProfile(userId, profileId) {
  const query = `
    SELECT
      ip.id,
      ip.member_id,
      ip.username,
      ip.profile_url,
      ip.profile_name,
      ip.is_public,
      ip.is_active,
      ip.current_followers_count,
      ip.current_posts_count,
      ip.current_comments_count,
      ip.current_visible_views_count,
      ip.last_scraped_at,
      ip.created_at,
      ip.updated_at,
      m.name AS member_name
    FROM instagram_profiles ip
    INNER JOIN members m ON m.id = ip.member_id
    WHERE ip.id = $1
      AND m.user_id = $2
    LIMIT 1
  `;

  const result = await pool.query(query, [profileId, userId]);

  if (result.rows.length === 0) {
    throw createError("Profile not found", 404);
  }

  return result.rows[0];
}

async function getOwnedMember(userId, memberId) {
  const query = `
    SELECT id, user_id, name
    FROM members
    WHERE id = $1 AND user_id = $2
    LIMIT 1
  `;

  const result = await pool.query(query, [memberId, userId]);

  if (result.rows.length === 0) {
    throw createError("Member not found", 404);
  }

  return result.rows[0];
}

exports.getProfilesDashboard = async (userId) => {
  const summaryQuery = `
    SELECT
      COUNT(ip.id)::int AS total_profiles,
      COALESCE(SUM(ip.current_followers_count), 0)::bigint AS total_followers,
      COALESCE(SUM(ip.current_posts_count), 0)::bigint AS total_posts,
      COALESCE(SUM(ip.current_comments_count), 0)::bigint AS total_comments,
      COALESCE(SUM(ip.current_visible_views_count), 0)::bigint AS total_views
    FROM instagram_profiles ip
    INNER JOIN members m ON m.id = ip.member_id
    WHERE m.user_id = $1
  `;

  const membersQuery = `
    SELECT
      id,
      name
    FROM members
    WHERE user_id = $1
    ORDER BY name ASC
  `;

  const profilesQuery = `
    SELECT
      ip.id,
      ip.member_id,
      m.name AS member_name,
      ip.username,
      ip.profile_url,
      ip.profile_name,
      ip.is_public,
      ip.is_active,
      COALESCE(ip.current_followers_count, 0)::bigint AS current_followers_count,
      COALESCE(ip.current_posts_count, 0)::bigint AS current_posts_count,
      COALESCE(ip.current_comments_count, 0)::bigint AS current_comments_count,
      COALESCE(ip.current_visible_views_count, 0)::bigint AS current_visible_views_count,
      ip.last_scraped_at
    FROM instagram_profiles ip
    INNER JOIN members m ON m.id = ip.member_id
    WHERE m.user_id = $1
    ORDER BY ip.created_at DESC
  `;

  const snapshotsQuery = `
    SELECT
      pss.id,
      pss.instagram_profile_id,
      COALESCE(pss.followers_count, 0)::bigint AS followers_count,
      COALESCE(pss.posts_count, 0)::bigint AS posts_count,
      COALESCE(pss.comments_count, 0)::bigint AS comments_count,
      COALESCE(pss.visible_views_count, 0)::bigint AS visible_views_count,
      pss.scraped_at,
      pss.source,
      pss.raw_payload
    FROM profile_stats_snapshots pss
    INNER JOIN instagram_profiles ip ON ip.id = pss.instagram_profile_id
    INNER JOIN members m ON m.id = ip.member_id
    WHERE m.user_id = $1
    ORDER BY pss.scraped_at DESC
  `;

  const [summaryResult, membersResult, profilesResult, snapshotsResult] = await Promise.all([
    pool.query(summaryQuery, [userId]),
    pool.query(membersQuery, [userId]),
    pool.query(profilesQuery, [userId]),
    pool.query(snapshotsQuery, [userId]),
  ]);

  const summaryRow = summaryResult.rows[0] || {};

  const snapshotsByProfile = snapshotsResult.rows.reduce((acc, row) => {
    const profileId = Number(row.instagram_profile_id);

    if (!acc[profileId]) {
      acc[profileId] = [];
    }

    if (acc[profileId].length < 6) {
      acc[profileId].push({
        id: Number(row.id),
        followers_count: Number(row.followers_count || 0),
        posts_count: Number(row.posts_count || 0),
        comments_count: Number(row.comments_count || 0),
        visible_views_count: Number(row.visible_views_count || 0),
        scraped_at: row.scraped_at,
        source: row.source,
        raw_payload: row.raw_payload,
      });
    }

    return acc;
  }, {});

  return {
    summary: {
      totalProfiles: Number(summaryRow.total_profiles || 0),
      totalFollowers: Number(summaryRow.total_followers || 0),
      totalPosts: Number(summaryRow.total_posts || 0),
      totalComments: Number(summaryRow.total_comments || 0),
      totalViews: Number(summaryRow.total_views || 0),
    },
    members: membersResult.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
    })),
    profiles: profilesResult.rows.map((row) => ({
      id: Number(row.id),
      member_id: Number(row.member_id),
      member_name: row.member_name,
      username: row.username,
      profile_url: row.profile_url,
      profile_name: row.profile_name,
      is_public: row.is_public,
      is_active: row.is_active,
      current_followers_count: Number(row.current_followers_count || 0),
      current_posts_count: Number(row.current_posts_count || 0),
      current_comments_count: Number(row.current_comments_count || 0),
      current_visible_views_count: Number(row.current_visible_views_count || 0),
      last_scraped_at: row.last_scraped_at,
      snapshots: snapshotsByProfile[Number(row.id)] || [],
    })),
  };
};

exports.createProfile = async ({ userId, memberId, username, profileName, profileUrl }) => {
  if (!memberId) {
    throw createError("Member is required", 400);
  }

  const cleanUsername = normalizeUsername(username);
  const cleanProfileName = normalizeOptionalText(profileName);
  const cleanProfileUrl = normalizeOptionalText(profileUrl);

  if (!cleanUsername) {
    throw createError("Username is required", 400);
  }

  await getOwnedMember(userId, memberId);

  const duplicateQuery = `
    SELECT ip.id
    FROM instagram_profiles ip
    INNER JOIN members m ON m.id = ip.member_id
    WHERE m.user_id = $1
      AND LOWER(ip.username) = LOWER($2)
    LIMIT 1
  `;

  const duplicateResult = await pool.query(duplicateQuery, [userId, cleanUsername]);

  if (duplicateResult.rows.length > 0) {
    throw createError("Profile username already exists", 409);
  }

  const insertQuery = `
    INSERT INTO instagram_profiles (
      member_id,
      username,
      profile_url,
      profile_name,
      is_public,
      is_active,
      current_followers_count,
      current_posts_count,
      current_comments_count,
      current_visible_views_count,
      last_scraped_at,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, true, true, 0, 0, 0, 0, NULL, NOW(), NOW())
    RETURNING
      id,
      member_id,
      username,
      profile_url,
      profile_name,
      is_public,
      is_active,
      current_followers_count,
      current_posts_count,
      current_comments_count,
      current_visible_views_count,
      last_scraped_at,
      created_at,
      updated_at
  `;

  const result = await pool.query(insertQuery, [
    memberId,
    cleanUsername,
    cleanProfileUrl,
    cleanProfileName,
  ]);

  return result.rows[0];
};

exports.updateProfile = async ({ userId, profileId, payload }) => {
  const existing = await getOwnedProfile(userId, profileId);

  const allowedFields = {
    profile_name:
      typeof payload.profile_name === "string"
        ? payload.profile_name.trim() || null
        : existing.profile_name,
    is_active:
      typeof payload.is_active === "boolean" ? payload.is_active : existing.is_active,
    is_public:
      typeof payload.is_public === "boolean" ? payload.is_public : existing.is_public,
  };

  const query = `
    UPDATE instagram_profiles
    SET
      profile_name = $1,
      is_active = $2,
      is_public = $3,
      updated_at = NOW()
    WHERE id = $4
    RETURNING
      id,
      member_id,
      username,
      profile_url,
      profile_name,
      is_public,
      is_active,
      current_followers_count,
      current_posts_count,
      current_comments_count,
      current_visible_views_count,
      last_scraped_at,
      created_at,
      updated_at
  `;

  const result = await pool.query(query, [
    allowedFields.profile_name,
    allowedFields.is_active,
    allowedFields.is_public,
    profileId,
  ]);

  return result.rows[0];
};

exports.refreshProfile = async ({ userId, profileId }) => {
  console.log("1. refreshProfile service start", { userId, profileId });

  const existing = await getOwnedProfile(userId, profileId);
  console.log("2. existing profile found", {
    profileId: existing.id,
    username: existing.username,
  });

  const scraped = await instagramScrapeService.scrapePublicProfile({
    username: existing.username,
  });
  console.log("3. scrape complete", {
    username: scraped.username,
    followers_count: scraped.followers_count,
    posts_count: scraped.posts_count,
    comments_count: scraped.comments_count,
    visible_views_count: scraped.visible_views_count,
    source: scraped.source,
  });

  const client = await pool.connect();
  console.log("4. db client acquired");

  try {
    await client.query("BEGIN");
    console.log("5. transaction started");

    const updateQuery = `
      UPDATE instagram_profiles
      SET
        profile_url = $1,
        profile_name = $2,
        is_public = $3,
        current_followers_count = $4,
        current_posts_count = $5,
        current_comments_count = $6,
        current_visible_views_count = $7,
        last_scraped_at = NOW(),
        updated_at = NOW()
      WHERE id = $8
      RETURNING
        id,
        member_id,
        username,
        profile_url,
        profile_name,
        is_public,
        is_active,
        current_followers_count,
        current_posts_count,
        current_comments_count,
        current_visible_views_count,
        last_scraped_at,
        created_at,
        updated_at
    `;

    console.log("6. before profile update query");

    const updatedResult = await client.query(updateQuery, [
      scraped.profile_url,
      scraped.profile_name,
      scraped.is_public,
      scraped.followers_count,
      scraped.posts_count,
      scraped.comments_count,
      scraped.visible_views_count,
      profileId,
    ]);

    console.log("7. profile update complete", {
      rowCount: updatedResult.rowCount,
      updatedId: updatedResult.rows[0]?.id,
    });

    const snapshotInsertQuery = `
      INSERT INTO profile_stats_snapshots (
        instagram_profile_id,
        followers_count,
        posts_count,
        comments_count,
        visible_views_count,
        scraped_at,
        source,
        raw_payload
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
    `;

    console.log("8. before snapshot insert");

    await client.query(snapshotInsertQuery, [
      profileId,
      scraped.followers_count,
      scraped.posts_count,
      scraped.comments_count,
      scraped.visible_views_count,
      scraped.source,
      JSON.stringify(scraped.raw_payload),
    ]);

    console.log("9. snapshot insert complete");

    await client.query("COMMIT");
    console.log("10. commit complete");

    return updatedResult.rows[0];
  } catch (error) {
    console.error("refreshProfile service error:", error);

    try {
      await client.query("ROLLBACK");
      console.log("11. rollback complete");
    } catch (rollbackError) {
      console.error("rollback error:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
    console.log("12. db client released");
  }
};

exports.getProfileById = async ({ userId, profileId }) => {
  try {
    return await getOwnedProfile(userId, profileId);
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
};