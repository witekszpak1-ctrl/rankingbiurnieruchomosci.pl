"use client";

import { useState } from "react";

/** Pole z kodem do skopiowania jednym przyciskiem (np. kod odznaki). Bez schowka zaznacza tekst do skopiowania ręcznie. */
export function CopyCode({ code, label = "Kod do wklejenia" }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-code">
      <label>
        <span className="sr-only">{label}</span>
        <textarea readOnly rows={4} value={code} onFocus={(e) => e.currentTarget.select()} />
      </label>
      <button
        type="button"
        className="btn-outline"
        onClick={async (e) => {
          const area = e.currentTarget.parentElement?.querySelector("textarea");
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            area?.select();
          }
        }}
      >
        {copied ? "Skopiowano" : "Kopiuj kod"}
      </button>
    </div>
  );
}
