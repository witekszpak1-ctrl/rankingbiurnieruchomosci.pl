/** Token, którym middleware podpisuje zgłoszenia wejść do /api/analityka/hit (Web Crypto: działa w edge i w Node). */
export async function hitToken(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`rbn-hit:${secret}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
