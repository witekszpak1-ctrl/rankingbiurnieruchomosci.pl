// Użycie: npm run hash-password -- 'twoje-haslo'
// Wynik wpisz do zmiennej ADMIN_PASSWORD_HASH. Ten sam algorytm co lib/password.ts.
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Podaj hasło jako argument: npm run hash-password -- 'haslo'");
  process.exit(1);
}
const N = 16384, R = 8, P = 1, KEY_LENGTH = 32;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, KEY_LENGTH, { N, r: R, p: P });
console.log(`scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`);
