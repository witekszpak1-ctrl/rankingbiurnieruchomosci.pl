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
      <Frame />
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
      <svg viewBox={`0 0 ${LOGO_FRAME_SIZE} ${LOGO_FRAME_SIZE}`} fill="currentColor">
        <Frame />
        <path d={LOGO_RBN} />
      </svg>
    </span>
  );
}
