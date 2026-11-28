import { currentPortal } from "@/lib/portal";
import {
  LOGO_FRAME_SIZE,
  LOGO_FRAME_STROKE,
  LOGO_HEIGHT,
  LOGO_LINE1,
  LOGO_LINE2,
  LOGO_RBN,
  LOGO_WIDTH,
} from "@/lib/logo-paths";

const INSET = LOGO_FRAME_STROKE / 2;
const INNER = LOGO_FRAME_SIZE - LOGO_FRAME_STROKE;

function Frame() {
  return (
    <rect
      x={INSET}
      y={INSET}
      width={INNER}
      height={INNER}
      fill="none"
      stroke="currentColor"
      strokeWidth={LOGO_FRAME_STROKE}
    />
  );
}

const PORTAL = currentPortal();
const NAME = PORTAL.brandName;
/** Portal biur nieruchomości ma znak "RBN" narysowany ścieżkami (lib/logo-paths.ts); pozostałe portale mają znak tekstowy. */
const HAS_DRAWN_LOGO = PORTAL.themeId === "nieruchomosci";

/** Znak tekstowy portalu bez własnego rysunku: skrót w ramce i nazwa w dwóch liniach (krój z motywu). */
function Wordmark() {
  const words = NAME.split(" ");
  const half = Math.ceil(words.length / 2);
  return (
    <span className="site-logo wordmark" role="img" aria-label={NAME}>
      <span className="wm-mark" aria-hidden="true">
        {PORTAL.shortName}
      </span>
      <span className="wm-name" aria-hidden="true">
        <span>{words.slice(0, half).join(" ")}</span>
        <span>{words.slice(half).join(" ")}</span>
      </span>
    </span>
  );
}

/** Pełne logo: ramka z RBN i nazwa w dwóch liniach. Kolor z CSS (currentColor), więc działa też w trybie ciemnym. */
export function Logo() {
  if (!HAS_DRAWN_LOGO) return <Wordmark />;
  return (
    <svg
      className="site-logo"
      viewBox={`0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}`}
      role="img"
      aria-label={NAME}
      fill="currentColor"
    >
      <Frame />
      <path d={LOGO_RBN} />
      <path d={LOGO_LINE1} />
      <path d={LOGO_LINE2} />
    </svg>
  );
}

/** Sam znak: ramka z RBN (miejsca, gdzie obok jest już nazwa serwisu). */
export function LogoMark() {
  if (!HAS_DRAWN_LOGO) {
    return (
      <span className="logo-mark logo-mark-text" aria-hidden="true">
        {PORTAL.shortName}
      </span>
    );
  }
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg viewBox={`0 0 ${LOGO_FRAME_SIZE} ${LOGO_FRAME_SIZE}`} fill="currentColor">
        <Frame />
        <path d={LOGO_RBN} />
      </svg>
    </span>
  );
}
