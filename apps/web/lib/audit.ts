import type { PoolClient } from "pg";

export type AuditEntry = {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

/** Zapisuje wpis audytu w tej samej transakcji, w której zmieniamy dane. */
export async function writeAudit(client: PoolClient, entry: AuditEntry): Promise<void> {
  await client.query(
    `insert into audit_log (actor, action, entity_type, entity_id, before, after)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      entry.actor,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
    ],
  );
}
