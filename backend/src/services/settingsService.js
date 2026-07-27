const bcrypt = require("bcryptjs");
const pool = require("../config/db");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeOptionalText(value) {
  const cleaned = String(value || "").trim();
  return cleaned || null;
}

exports.getSettings = async (userId) => {
  const query = `
    SELECT
      id,
      full_name,
      email
    FROM users
    WHERE id = $1
    LIMIT 1
  `;

  const result = await pool.query(query, [userId]);

  if (result.rows.length === 0) {
    throw createError("User not found", 404);
  }

  const user = result.rows[0];

  return {
    user: {
      id: Number(user.id),
      full_name: user.full_name,
      email: user.email,
    },
  };
};

exports.updateProfile = async ({ userId, fullName, email }) => {
  const cleanFullName = normalizeOptionalText(fullName);
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!cleanFullName) {
    throw createError("Full name is required", 400);
  }

  if (!cleanEmail) {
    throw createError("Email is required", 400);
  }

  const duplicateQuery = `
    SELECT id
    FROM users
    WHERE LOWER(email) = LOWER($1)
      AND id != $2
    LIMIT 1
  `;

  const duplicateResult = await pool.query(duplicateQuery, [cleanEmail, userId]);

  if (duplicateResult.rows.length > 0) {
    throw createError("Email is already in use", 409);
  }

  const query = `
    UPDATE users
    SET
      full_name = $1,
      email = $2,
      updated_at = NOW()
    WHERE id = $3
    RETURNING id, full_name, email, is_active
  `;

  const result = await pool.query(query, [cleanFullName, cleanEmail, userId]);

  if (result.rows.length === 0) {
    throw createError("User not found", 404);
  }

  return {
    id: Number(result.rows[0].id),
    full_name: result.rows[0].full_name,
    email: result.rows[0].email,
    is_active: result.rows[0].is_active,
  };
};

exports.updatePassword = async ({ userId, currentPassword, newPassword }) => {
  if (!currentPassword) {
    throw createError("Current password is required", 400);
  }

  if (!newPassword || String(newPassword).length < 8) {
    throw createError("New password must be at least 8 characters", 400);
  }

  const query = `
    SELECT id, password_hash
    FROM users
    WHERE id = $1
    LIMIT 1
  `;

  const result = await pool.query(query, [userId]);

  if (result.rows.length === 0) {
    throw createError("User not found", 404);
  }

  const user = result.rows[0];
  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);

  if (!isMatch) {
    throw createError("Current password is incorrect", 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await pool.query(
    `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `,
    [hashedPassword, userId]
  );

  return true;
};

exports.deleteAccount = async ({ userId, password }) => {
  if (!password) {
    throw createError("Password is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `
        SELECT id, password_hash
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw createError("User not found", 404);
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      throw createError("Password is incorrect", 400);
    }

    await client.query(
      `
        DELETE FROM profile_stats_snapshots
        WHERE instagram_profile_id IN (
          SELECT ip.id
          FROM instagram_profiles ip
          INNER JOIN members m ON m.id = ip.member_id
          WHERE m.user_id = $1
        )
      `,
      [userId]
    );

    await client.query(
      `
        DELETE FROM instagram_profiles
        WHERE member_id IN (
          SELECT id
          FROM members
          WHERE user_id = $1
        )
      `,
      [userId]
    );

    await client.query(
      `
        DELETE FROM members
        WHERE user_id = $1
      `,
      [userId]
    );

    await client.query(
      `
        DELETE FROM users
        WHERE id = $1
      `,
      [userId]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};