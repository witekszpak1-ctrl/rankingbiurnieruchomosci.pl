"use client";

import { useState } from "react";

type Props = {
  /** [wartość, etykieta] dla listy spraw. */
  topics: [string, string][];
  /** Gotowa wiadomość dla każdej sprawy; klucz "" to wiadomość przed wyborem sprawy. */
  messages: Record<string, string>;
  /** Pola formularza między wyborem sprawy a wiadomością (imię, e-mail, telefon). */
  children: React.ReactNode;
};

/**
 * Wybór sprawy i pole wiadomości z gotową treścią. Po zmianie sprawy wiadomość podmienia się na pasującą, ale tylko
 * gdy klient jej nie zmieniał (nadal jest jedną z gotowych treści). Bez JavaScriptu zostaje wiadomość domyślna.
 */
export function LeadTopicMessage({ topics, messages, children }: Props) {
  const [message, setMessage] = useState(messages[""] ?? "");
  const templates = Object.values(messages);
  return (
    <>
      <div className="lead-field full">
        <label htmlFor="topic">W jakiej sprawie</label>
        <select
          id="topic"
          name="topic"
          required
          defaultValue=""
          onChange={(e) => {
            const next = messages[e.target.value];
            if (next && templates.includes(message.trim())) setMessage(next);
          }}
        >
          <option value="" disabled>
            wybierz
          </option>
          {topics.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {children}
      <div className="lead-field full">
        <label htmlFor="message">Wiadomość (możesz ją zmienić)</label>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          minLength={10}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
    </>
  );
}
