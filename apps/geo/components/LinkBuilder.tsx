"use client";

import { useState } from "react";

import { affiliateLink } from "@/lib/affiliate";

export function LinkBuilder({ origin, code }: { origin: string; code: string }) {
  const [campaign, setCampaign] = useState("");
  const [to, setTo] = useState("/");
  const [copied, setCopied] = useState(false);
  const link = affiliateLink(origin, code, { campaign, to });
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <code className="link" id="aff-link">{link}</code>
      <div className="grid">
        <label>
          Kampania (opcjonalnie, np. facebook, newsletter)
          <input id="campaign" type="text" value={campaign} onChange={(e) => setCampaign(e.target.value)} maxLength={60} />
        </label>
        <label>
          Strona docelowa
          <select id="to" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="/">Strona główna</option>
            <option value="/rejestracja">Załóż konto</option>
            <option value="/partner">Program partnerski</option>
          </select>
        </label>
      </div>
      <div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(link).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        >
          {copied ? "Skopiowano" : "Kopiuj link"}
        </button>
      </div>
    </div>
  );
}
