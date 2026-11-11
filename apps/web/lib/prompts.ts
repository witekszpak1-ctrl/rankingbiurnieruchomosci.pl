import { query } from "./db";

export type PromptSetting = { text: string; updatedAt: Date | null; updatedBy: string | null };

export const PROMPT_KEY = "describe_prompt";
export const PROMPT_DEFAULT_KEY = "describe_prompt_default";

export async function getPrompt(key: string): Promise<PromptSetting | null> {
  const rows = await query<{ value: { text?: string; updated_by?: string }; updatedAt: Date }>(
    `select value, updated_at as "updatedAt" from settings where key = $1`,
    [key],
  ).catch(() => []);
  const row = rows[0];
  if (!row || typeof row.value?.text !== "string") return null;
  return { text: row.value.text, updatedAt: row.updatedAt, updatedBy: row.value.updated_by ?? null };
}
