"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Porównywarka biur: pole wyboru przy biurze (najwyżej 3) i pasek "Porównaj wybrane" na dole ekranu.
 * Wybór trzymamy w przeglądarce (localStorage), więc działa między stronami miast.
 */
type Item = { id: string; name: string };

const KEY = "porownaj";
const EVENT = "porownaj-zmiana";
export const COMPARE_MAX = 3;

function read(): Item[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x.id === "string").slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

function write(items: Item[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, COMPARE_MAX)));
  } catch {
    // brak dostępu do pamięci przeglądarki: porównywarka działa tylko na tej stronie
  }
  window.dispatchEvent(new Event(EVENT));
}

function useSelection(): Item[] {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return items;
}

export function CompareToggle({ id, name }: Item) {
  const items = useSelection();
  const checked = items.some((x) => x.id === id);
  const full = !checked && items.length >= COMPARE_MAX;
  return (
    <label className="compare-toggle" title={full ? `Możesz porównać najwyżej ${COMPARE_MAX} biura` : undefined}>
      <input
        type="checkbox"
        checked={checked}
        disabled={full}
        onChange={() => write(checked ? items.filter((x) => x.id !== id) : [...items, { id, name }])}
        aria-label={`Porównaj: ${name}`}
      />
      <span>Porównaj</span>
    </label>
  );
}

export function CompareBar() {
  const items = useSelection();
  if (items.length === 0) return null;
  return (
    <div className="compare-bar" role="region" aria-label="Porównanie biur">
      <span>
        Wybrane do porównania ({items.length}/{COMPARE_MAX}): {items.map((x) => x.name).join(", ")}
      </span>
      <span className="compare-actions">
        {items.length >= 2 ? (
          <Link className="compare-go" href={`/porownaj?biura=${items.map((x) => x.id).join(",")}`}>
            Porównaj wybrane
          </Link>
        ) : (
          <span className="note">Wybierz jeszcze co najmniej jedno biuro</span>
        )}
        <button type="button" onClick={() => write([])}>
          Wyczyść
        </button>
      </span>
    </div>
  );
}
