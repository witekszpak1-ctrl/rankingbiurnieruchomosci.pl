/** Bramka publikacji wpisu: czysta funkcja, żeby dało się ją testować bez bazy. */

export type GateInput = {
  domainVerified: boolean; // domena ma status verified albo jest biurem bez potwierdzenia w rejestrze (niższy ranking)
  hasValidatedDescription: boolean;
  factsCount: number; // bieżące fakty marki
  minFacts: number; // ustawienie publish_min_facts
};

export type GateResult = { ok: boolean; reasons: string[] };

export function evaluateGate(input: GateInput): GateResult {
  const reasons: string[] = [];
  if (!input.domainVerified) reasons.push("Strona nie jest potwierdzona jako biuro nieruchomości.");
  if (!input.hasValidatedDescription) reasons.push("Brak zwalidowanego opisu.");
  if (input.factsCount < input.minFacts) {
    reasons.push(`Za mało faktów: ${input.factsCount} z wymaganych ${input.minFacts}.`);
  }
  return { ok: reasons.length === 0, reasons };
}
