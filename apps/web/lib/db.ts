import { Pool, type PoolClient } from "pg";

// Jedna pula na proces (także przy hot reload w trybie dev).
const globalForPg = globalThis as unknown as { __katalogPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Brak DATABASE_URL. Ustaw zmienną środowiskową (patrz .env.example).");
  }
  return new Pool({ connectionString, max: 5 });
}

export function getPool(): Pool {
  return (globalForPg.__katalogPool ??= createPool());
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query(text, params);
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
