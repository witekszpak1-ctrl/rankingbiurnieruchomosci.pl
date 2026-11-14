const STAR = "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z";

/**
 * Gwiazdki oceny 1-5 (zaokrąglone do połówek). Bez definicji SVG z identyfikatorami: wypełnienie to przycięta kopia
 * gwiazdki, więc kilka ocen na stronie (także w ukrytym elemencie) nie psuje się nawzajem.
 */
export function Stars({ value, size = 18 }: { value: number; size?: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="stars" aria-label={`Ocena ${value.toFixed(1)} na 5`} role="img">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = rounded >= i ? 100 : rounded >= i - 0.5 ? 50 : 0;
        return (
          <span key={i} className="star" style={{ width: size, height: size }} aria-hidden="true">
            <svg viewBox="0 0 24 24" width={size} height={size}>
              <path d={STAR} fill="#dfe2e8" />
            </svg>
            {fill > 0 && (
              <span className="star-fill" style={{ width: `${fill}%` }}>
                <svg viewBox="0 0 24 24" width={size} height={size}>
                  <path d={STAR} fill="#f5b301" />
                </svg>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Lekkie gwiazdki do długich list (karta biura): jeden element zamiast pięciu obrazków SVG, żeby strona miasta była lekka. */
export function StarsMini({ value }: { value: number }) {
  return (
    <span className="stars-mini" role="img" aria-label={`Ocena ${value.toFixed(1)} na 5`}>
      <span style={{ width: `${Math.max(0, Math.min(100, (value / 5) * 100))}%` }} />
    </span>
  );
}
