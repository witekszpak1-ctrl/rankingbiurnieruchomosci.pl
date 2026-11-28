// Migracje schematu geo (db/geo/*.sql). Uruchamia rola właściciela bazy: GEO_MIGRATE_URL.
// Każdy plik raz, w transakcji, z sumą kontrolną w geo.schema_migrations (zmiana zastosowanego pliku = błąd).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../db/geo");
const url = process.env.GEO_MIGRATE_URL;
if (!url) { console.error("Brak GEO_MIGRATE_URL"); process.exit(1); }
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("create schema if not exists geo");
await client.query("create table if not exists geo.schema_migrations (version text primary key, checksum text not null, applied_at timestamptz not null default now())");
const applied = new Map((await client.query("select version, checksum from geo.schema_migrations")).rows.map((r) => [r.version, r.checksum]));
for (const file of readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()) {
  const version = file.replace(/\.sql$/, "");
  const sql = readFileSync(path.join(dir, file), "utf8");
  const sum = createHash("sha256").update(sql).digest("hex");
  if (applied.has(version)) {
    if (applied.get(version) !== sum) throw new Error(`Migracja ${version} zmieniona po zastosowaniu`);
    continue;
  }
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("insert into geo.schema_migrations (version, checksum) values ($1, $2)", [version, sum]);
    await client.query("commit");
    console.log("zastosowano", version);
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}
await client.end();
