const pool = require("../config/db");

function normalizeName(name) {
  return String(name || "").trim();
}

function normalizeNotes(notes) {
  const value = String(notes || "").trim();
  return value || null;
}

exports.getMembersDashboard = async (userId) => {
  const summaryQuery = `
    SELECT
      COUNT(DISTINCT m.id)::int AS total_members,
      COUNT(ip.id)::int AS total_accounts,
      COALESCE(SUM(ip.current_followers_count), 0)::bigint AS total_followers,
      COALESCE(SUM(ip.current_posts_count), 0)::bigint AS total_posts,
      COALESCE(SUM(ip.current_comments_count), 0)::bigint AS total_comments,
      COALESCE(SUM(ip.current_visible_views_count), 0)::bigint AS total_views
    FROM members m
    LEFT JOIN instagram_profiles ip ON ip.member_id = m.id
    WHERE m.user_id = $1
  `;

  const membersQuery = `
    SELECT
      m.id,
      m.name,
      m.notes,
      COUNT(ip.id)::int AS profile_count,
      COALESCE(SUM(ip.current_followers_count), 0)::bigint AS followers,
      COALESCE(SUM(ip.current_posts_count), 0)::bigint AS posts,
      COALESCE(SUM(ip.current_comments_count), 0)::bigint AS comments,
      COALESCE(SUM(ip.current_visible_views_count), 0)::bigint AS views,
      MAX(ip.last_scraped_at) AS last_scraped_at
    FROM members m
    LEFT JOIN instagram_profiles ip ON ip.member_id = m.id
    WHERE m.user_id = $1
    GROUP BY m.id, m.name, m.notes
    ORDER BY m.created_at DESC
  `;

  const profilesQuery = `
    SELECT
      ip.id,
      ip.member_id,
      ip.username,
      ip.current_followers_count
    FROM instagram_profiles ip
    INNER JOIN members m ON m.id = ip.member_id
    WHERE m.user_id = $1
    ORDER BY ip.created_at DESC
  `;

  const [summaryResult, membersResult, profilesResult] = await Promise.all([
    pool.query(summaryQuery, [userId]),
    pool.query(membersQuery, [userId]),
    pool.query(profilesQuery, [userId]),
  ]);

  const summaryRow = summaryResult.rows[0] || {};

  const profilesByMember = profilesResult.rows.reduce((acc, profile) => {
    if (!acc[profile.member_id]) {
      acc[profile.member_id] = [];
    }

    acc[profile.member_id].push({
      id: Number(profile.id),
      username: profile.username,
      current_followers_count: Number(profile.current_followers_count || 0),
    });

    return acc;
  }, {});

  const members = membersResult.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    notes: row.notes,
    profile_count: Number(row.profile_count || 0),
    followers: Number(row.followers || 0),
    posts: Number(row.posts || 0),
    comments: Number(row.comments || 0),
    views: Number(row.views || 0),
    last_scraped_at: row.last_scraped_at,
    profiles: (profilesByMember[row.id] || []).slice(0, 3),
  }));

  return {
    summary: {
      totalMembers: Number(summaryRow.total_members || 0),
      totalAccounts: Number(summaryRow.total_accounts || 0),
      totalFollowers: Number(summaryRow.total_followers || 0),
      totalPosts: Number(summaryRow.total_posts || 0),
      totalComments: Number(summaryRow.total_comments || 0),
      totalViews: Number(summaryRow.total_views || 0),
    },
    members,
  };
};

exports.createMember = async ({ userId, name, notes }) => {
  const cleanName = normalizeName(name);
  const cleanNotes = normalizeNotes(notes);

  if (!cleanName) {
    const error = new Error("Member name is required");
    error.statusCode = 400;
    throw error;
  }

  const existingQuery = `
    SELECT id
    FROM members
    WHERE user_id = $1 AND LOWER(name) = LOWER($2)
    LIMIT 1
  `;

  const existingResult = await pool.query(existingQuery, [userId, cleanName]);

  if (existingResult.rows.length > 0) {
    const error = new Error("Member name already exists");
    error.statusCode = 409;
    throw error;
  }

  const insertQuery = `
    INSERT INTO members (user_id, name, notes)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, name, notes, created_at, updated_at
  `;

  const result = await pool.query(insertQuery, [userId, cleanName, cleanNotes]);

  return result.rows[0];
};

exports.updateMember = async ({ userId, memberId, name, notes }) => {
  const cleanName = normalizeName(name);
  const cleanNotes = normalizeNotes(notes);

  if (!cleanName) {
    const error = new Error("Member name is required");
    error.statusCode = 400;
    throw error;
  }

  const memberCheckQuery = `
    SELECT id
    FROM members
    WHERE id = $1 AND user_id = $2
    LIMIT 1
  `;

  const memberCheck = await pool.query(memberCheckQuery, [memberId, userId]);

  if (memberCheck.rows.length === 0) {
    const error = new Error("Member not found");
    error.statusCode = 404;
    throw error;
  }

  const duplicateQuery = `
    SELECT id
    FROM members
    WHERE user_id = $1
      AND LOWER(name) = LOWER($2)
      AND id <> $3
    LIMIT 1
  `;

  const duplicateResult = await pool.query(duplicateQuery, [userId, cleanName, memberId]);

  if (duplicateResult.rows.length > 0) {
    const error = new Error("Another member with this name already exists");
    error.statusCode = 409;
    throw error;
  }

  const updateQuery = `
    UPDATE members
    SET
      name = $1,
      notes = $2,
      updated_at = NOW()
    WHERE id = $3 AND user_id = $4
    RETURNING id, user_id, name, notes, created_at, updated_at
  `;

  const result = await pool.query(updateQuery, [cleanName, cleanNotes, memberId, userId]);

  return result.rows[0];
};

exports.deleteMember = async ({ userId, memberId }) => {
  const deleteQuery = `
    DELETE FROM members
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `;

  const result = await pool.query(deleteQuery, [memberId, userId]);

  if (result.rows.length === 0) {
    const error = new Error("Member not found");
    error.statusCode = 404;
    throw error;
  }

  return true;
};