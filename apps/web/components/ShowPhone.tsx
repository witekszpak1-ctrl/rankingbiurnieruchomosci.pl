"use client";

import { useState } from "react";

/** Numer telefonu odkrywany po kliknięciu (jak w serwisach z ogłoszeniami), żeby roboty nie zbierały numerów hurtem. */
export function ShowPhone({ phone, label }: { phone: string; label: string }) {
  const [shown, setShown] = useState(false);
  return shown ? (
    <a className="btn-blue" href={`tel:${phone}`}>
      <PhoneIcon /> {label}
    </a>
  ) : (
    <button type="button" className="btn-blue" onClick={() => setShown(true)}>
      <PhoneIcon /> Pokaż numer
    </button>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}
