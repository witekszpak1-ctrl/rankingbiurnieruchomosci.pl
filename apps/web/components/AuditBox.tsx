/** Mały blok na profilu: odsyła do darmowego audytu widoczności firmy w odpowiedziach AI (GeoTrace). Patrz lib/audit-link.ts. */
export function AuditBox({ href, firmName }: { href: string; firmName: string }) {
  return (
    <aside className="audit-box" aria-label="Audyt widoczności w AI">
      <b>Sprawdź, czy ChatGPT i Gemini polecają tę firmę</b>
      <p>Darmowy audyt widoczności {firmName} w odpowiedziach asystentów AI.</p>
      <a className="btn-outline" href={href} rel="noopener">
        Zobacz audyt
      </a>
    </aside>
  );
}
