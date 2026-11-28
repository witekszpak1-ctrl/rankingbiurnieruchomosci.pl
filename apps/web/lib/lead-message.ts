import type { LeadTopic } from "./leads";
import { currentPortal } from "./portal";

/**
 * Gotowa treść wiadomości w formularzu zapytania, żeby nie trzeba było jej pisać od zera. Pusty temat to wiadomość
 * wpisana przed wyborem sprawy. Formy bez rodzaju gramatycznego ("interesuje mnie", "chcę", "proszę").
 * `where` to miasto z przyimkiem, np. "w Krakowie" (inCity).
 */
export function leadMessage(topic: LeadTopic | "", where: string): string {
  return currentPortal().texts.lead.message(topic, where);
}
