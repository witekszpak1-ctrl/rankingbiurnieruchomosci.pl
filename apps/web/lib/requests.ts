/** Zgłoszenia ze strony /dla-firm (korekta, usunięcie wpisu, inne): walidacja i dostęp do bazy. */

import { query } from "./db";

export const REQUEST_KINDS = ["correction", "removal", "other"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_STATUSES = ["new", "in_progress", "done", "rejected"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const KIND_LABEL: Record<RequestKind, string> = {
  correction: "Korekta danych",
  removal: "Usunięcie wpisu",
  other: "Inna sprawa",
};

export const STATUS_LABEL: Record<RequestStatus, string> = {
  new: "nowe",
  in_progress: "w toku",
  done: "załatwione",
  rejected: "odrzucone",
};

/** Limity przeciw zalewaniu formularza: globalnie i z jednego adresu e-mail, na godzinę. */
export const LIMIT_PER_HOUR = 20;
export const LIMIT_PER_EMAIL_PER_HOUR = 3;

export function isValidNip(nip: string): boolean {
  if (!/^\d{10}$/.test(nip)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(nip[i]), 0);
  const control = sum % 11;
  return control !== 10 && control === Number(nip[9]);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type RequestInput = { kind: RequestKind; nip: string | null; email: string; message: string };
export type ErrorCode = "kind" | "nip" | "email" | "message";
export type Validation = { ok: true; value: RequestInput } | { ok: false; code: ErrorCode };

export function validateRequestInput(raw: {
  kind?: unknown;
  nip?: unknown;
  email?: unknown;
  message?: unknown;
}): Validation {
  const kind = String(raw.kind ?? "");
  if (!(REQUEST_KINDS as readonly string[]).includes(kind)) return { ok: false, code: "kind" };

  const nip = String(raw.nip ?? "").replace(/[\s-]/g, "");
  if (nip && !isValidNip(nip)) return { ok: false, code: "nip" };

  const email = String(raw.email ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, code: "email" };

  const message = String(raw.message ?? "").replace(/\r\n/g, "\n").trim();
  if (message.length < 10 || message.length > 2000) return { ok: false, code: "message" };

  return { ok: true, value: { kind: kind as RequestKind, nip: nip || null, email, message } };
}

export async function countRecentRequests(email: string): Promise<{ total: number; byEmail: number }> {
  const rows = await query<{ total: number; byEmail: number }>(
    `select count(*)::int as total, (count(*) filter (where requester_email = $1))::int as "byEmail"
     from requests where created_at > now() - interval '1 hour'`,
    [email],
  );
  return rows[0] ?? { total: 0, byEmail: 0 };
}

export async function insertRequest(value: RequestInput): Promise<void> {
  await query(
    `insert into requests (kind, nip, requester_email, message) values ($1, $2, $3, $4)`,
    [value.kind, value.nip, value.email, value.message],
  );
}

export type RequestRow = {
  id: string;
  kind: RequestKind;
  nip: string | null;
  email: string;
  message: string;
  status: RequestStatus;
  adminNote: string | null;
  handledBy: string | null;
  handledAt: Date | null;
  createdAt: Date;
};

export async function listRequests(status: string): Promise<RequestRow[]> {
  return query<RequestRow>(
    `select id, kind, nip, requester_email as email, message, status, admin_note as "adminNote",
            handled_by as "handledBy", handled_at as "handledAt", created_at as "createdAt"
     from requests where ($1::text = '' or status = $1)
     order by (status = 'new') desc, created_at desc limit 200`,
    [status],
  );
}

/** Liczba nowych zgłoszeń do panelu. Gdy tabeli jeszcze nie ma (migracja niezastosowana), zwraca 0. */
export async function countNewRequests(): Promise<number> {
  try {
    const rows = await query<{ n: number }>("select count(*)::int as n from requests where status = 'new'");
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}
