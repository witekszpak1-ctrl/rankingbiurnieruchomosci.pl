import { Pool, type PoolClient } from "pg";

// Jedna pula na proces. Aplikacja GEO łączy się rolą geo_app (GEO_DATABASE_URL), nie rolą portali.
const g = globalThis as unknown as { __geoPool?: Pool };

export function getPool(): Pool {
  if (!g.__geoPool) {
    const connectionString = process.env.GEO_DATABASE_URL;
    if (!connectionString) throw new Error("Brak GEO_DATABASE_URL (patrz apps/geo/README.md).");
    g.__geoPool = new Pool({ connectionString, max: 5 });
  }
  return g.__geoPool;
}

export type Db = Pick<PoolClient, "query">;

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = [], db?: Db): Promise<T[]> {
  const result = await (db ?? getPool()).query(text, params);
  return result.rows as T[];
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const value = await fn(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
