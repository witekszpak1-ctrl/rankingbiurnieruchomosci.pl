export function Notice({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) return <p className="error" role="alert">{error}</p>;
  if (ok) return <p className="ok" role="status">{ok}</p>;
  return null;
}

export type SP = Promise<Record<string, string | string[] | undefined>>;

export function one(v: string | string[] | undefined): string | null {
  return typeof v === "string" ? v : null;
}
