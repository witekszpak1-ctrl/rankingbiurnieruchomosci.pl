import { LOGO_HEIGHT, LOGO_LINE1, LOGO_LINE2, LOGO_RBN, LOGO_WIDTH } from "@/lib/logo-paths";

const NAME = "Ranking Biur Nieruchomości";

/** Pełne logo: ramka z RBN i nazwa w dwóch liniach. Kolor z CSS (currentColor), więc działa też w trybie ciemnym. */
export function Logo() {
  return (
    <svg
      className="site-logo"
      viewBox={`0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}`}
      role="img"
      aria-label={NAME}
      fill="currentColor"
    >
      <rect x="1" y="1" width="122" height="122" fill="none" stroke="currentColor" strokeWidth={2} />
      <path d={LOGO_RBN} />
      <path d={LOGO_LINE1} />
      <path d={LOGO_LINE2} />
    </svg>
  );
}

/** Sam znak: ramka z RBN (miejsca, gdzie obok jest już nazwa serwisu). */
export function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 124 124" fill="currentColor">
        <rect x="2" y="2" width="120" height="120" fill="none" stroke="currentColor" strokeWidth={4} />
        <path d={LOGO_RBN} />
      </svg>
    </span>
  );
}
