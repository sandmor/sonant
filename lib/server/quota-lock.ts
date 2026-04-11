import { Pool } from "pg";

const QUOTA_LOCK_NAMESPACE = 72_001;

let cachedPool: Pool | null = null;

function getPool() {
  if (cachedPool) {
    return cachedPool;
  }

  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to enforce quota locking");
  }

  cachedPool = new Pool({
    connectionString,
  });

  return cachedPool;
}

export async function withUserQuotaLock<T>(
  userId: number,
  action: () => Promise<T>,
) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1, $2)", [
      QUOTA_LOCK_NAMESPACE,
      userId,
    ]);

    return await action();
  } finally {
    await client
      .query("SELECT pg_advisory_unlock($1, $2)", [
        QUOTA_LOCK_NAMESPACE,
        userId,
      ])
      .catch(() => undefined);
    client.release();
  }
}
