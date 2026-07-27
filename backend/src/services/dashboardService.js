const pool = require("../config/db");

exports.getOverview = async (userId) => {
  const totalsQuery = `
    SELECT
      COALESCE(SUM(ip.current_followers_count), 0)::bigint AS total_followers,
      COALESCE(SUM(ip.current_posts_count), 0)::bigint AS total_posts,
      COALESCE(SUM(ip.current_comments_count), 0)::bigint AS total_comments,
      COALESCE(SUM(ip.current_visible_views_count), 0)::bigint AS total_views,
      MAX(ip.last_scraped_at) AS last_updated
    FROM instagram_profiles ip
    INNER JOIN members m ON m.id = ip.member_id
    WHERE m.user_id = $1
  `;

  const previewProfilesQuery = `
    SELECT
      ip.id,
      ip.member_id,
      m.name AS member_name,
      ip.username,
      ip.profile_name,
      ip.current_followers_count,
      ip.current_posts_count,
      ip.current_comments_count,
      ip.current_visible_views_count,
      ip.last_scraped_at
    FROM instagram_profiles ip
    INNER JOIN members m ON m.id = ip.member_id
    WHERE m.user_id = $1
    ORDER BY ip.current_followers_count DESC, ip.id DESC
    LIMIT 6
  `;

  const memberPreviewQuery = `
    SELECT
      m.id,
      m.name,
      m.notes,
      COUNT(ip.id)::int AS count,
      COALESCE(SUM(ip.current_followers_count), 0)::bigint AS followers,
      COALESCE(SUM(ip.current_posts_count), 0)::bigint AS posts,
      COALESCE(SUM(ip.current_comments_count), 0)::bigint AS comments,
      COALESCE(SUM(ip.current_visible_views_count), 0)::bigint AS views
    FROM members m
    LEFT JOIN instagram_profiles ip ON ip.member_id = m.id
    WHERE m.user_id = $1
    GROUP BY m.id, m.name, m.notes
    ORDER BY followers DESC, m.id DESC
    LIMIT 8
  `;

  const [totalsResult, profilesResult, membersResult] = await Promise.all([
    pool.query(totalsQuery, [userId]),
    pool.query(previewProfilesQuery, [userId]),
    pool.query(memberPreviewQuery, [userId]),
  ]);

  const totalsRow = totalsResult.rows[0] || {};

  return {
    totals: {
      followers: Number(totalsRow.total_followers || 0),
      posts: Number(totalsRow.total_posts || 0),
      comments: Number(totalsRow.total_comments || 0),
      views: Number(totalsRow.total_views || 0),
    },
    lastUpdated: totalsRow.last_updated || null,
    previewProfiles: profilesResult.rows.map((row) => ({
      id: Number(row.id),
      member_id: Number(row.member_id),
      member_name: row.member_name,
      username: row.username,
      profile_name: row.profile_name,
      current_followers_count: Number(row.current_followers_count || 0),
      current_posts_count: Number(row.current_posts_count || 0),
      current_comments_count: Number(row.current_comments_count || 0),
      current_visible_views_count: Number(row.current_visible_views_count || 0),
      last_scraped_at: row.last_scraped_at,
    })),
    memberRows: membersResult.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      notes: row.notes,
      totals: {
        count: Number(row.count || 0),
        followers: Number(row.followers || 0),
        posts: Number(row.posts || 0),
        comments: Number(row.comments || 0),
        views: Number(row.views || 0),
      },
    })),
  };
};