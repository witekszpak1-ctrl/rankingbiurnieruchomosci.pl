import { cache } from "react";

import { affiliateByUser } from "./affiliate-repo";
import { normalizeDomain, type AuditResult } from "./audit";
import { tryLoadAudit } from "./audit-cache";
import { query } from "./db";
import { primaryAccount, setupSteps, attentionItems, type AttentionItem, type PanelAccount, type PanelFacts, type SetupStep } from "./panel";

/** Dane pulpitu i paska bocznego zalogowanego użytkownika. Tylko odczyt; jedna kopia na żądanie (React cache). */

export type PanelContext = {
  facts: PanelFacts;
  primary: PanelAccount | null;
  domain: string | null;
  affiliateCode: string | null;
  audit: AuditResult | null;
  steps: SetupStep[];
  attention: AttentionItem[];
};

export const loadPanelContext = cache(async (userId: string): Promise<PanelContext> => {
  const [accounts, aff] = await Promise.all([
    query<PanelAccount>(
      `select a.id, a.name, a.primary_domain as domain, s.plan_id as "planId", p.name as "planName", s.status
         from geo.accounts a
         left join lateral (select plan_id, status from geo.subscriptions where account_id = a.id order by created_at desc limit 1) s on true
         left join geo.plans p on p.id = s.plan_id
        where a.owner_user_id = $1 order by a.created_at`,
      [userId],
    ),
    affiliateByUser(userId),
  ]);
  let clicks = 0;
  if (aff) {
    const r = await query<{ n: number }>(`select count(*)::int as n from geo.affiliate_clicks where affiliate_id = $1`, [aff.id]);
    clicks = r[0]?.n ?? 0;
  }
  const facts: PanelFacts = { accounts, hasAffiliate: Boolean(aff), affiliateClicks: clicks };
  const primary = primaryAccount(accounts);
  const domain = normalizeDomain(primary?.domain ?? null);
  const audit = await tryLoadAudit(domain);
  return {
    facts,
    primary,
    domain,
    affiliateCode: aff?.code ?? null,
    audit,
    steps: setupSteps({ ...facts, accounts: accounts.map((a) => ({ ...a, domain: normalizeDomain(a.domain) })) }, audit),
    attention: attentionItems(facts, audit),
  };
});
