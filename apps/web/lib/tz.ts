/** Strefa czasowa, w której panel pokazuje godziny i dzieli dni (harmonogramy automatu działają w czasie polskim). */
export const ADMIN_TZ = process.env.ADMIN_TIMEZONE || "Asia/Bangkok";
export const ADMIN_TZ_LABEL = ADMIN_TZ === "Asia/Bangkok" ? "czas tajski" : ADMIN_TZ === "Europe/Warsaw" ? "czas polski" : ADMIN_TZ;
