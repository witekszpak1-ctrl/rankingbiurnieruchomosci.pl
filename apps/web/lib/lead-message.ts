import type { LeadTopic } from "./leads";

/**
 * Gotowa treść wiadomości w formularzu zapytania, żeby nie trzeba było jej pisać od zera. Pusty temat to wiadomość
 * wpisana przed wyborem sprawy. Formy bez rodzaju gramatycznego ("interesuje mnie", "chcę", "proszę").
 * `where` to miasto z przyimkiem, np. "w Krakowie" (inCity).
 */
export function leadMessage(topic: LeadTopic | "", where: string): string {
  switch (topic) {
    case "kupno":
      return `Dzień dobry, interesuje mnie zakup nieruchomości ${where}. Proszę o przesłanie aktualnych ofert i kontakt.`;
    case "sprzedaz":
      return `Dzień dobry, chcę sprzedać nieruchomość ${where}. Proszę o kontakt i przedstawienie oferty współpracy.`;
    case "wynajem":
      return `Dzień dobry, szukam mieszkania do wynajęcia ${where}. Proszę o przesłanie aktualnych ofert i kontakt.`;
    case "najem":
      return `Dzień dobry, chcę oddać w najem nieruchomość ${where}. Proszę o kontakt i przedstawienie oferty współpracy.`;
    case "wycena":
      return `Dzień dobry, proszę o wycenę nieruchomości ${where} i kontakt w tej sprawie.`;
    case "inne":
      return "Dzień dobry, proszę o kontakt w sprawie oferty biura.";
    default:
      return "Dzień dobry, proszę o informacje o aktualnej ofercie biura i kontakt.";
  }
}
