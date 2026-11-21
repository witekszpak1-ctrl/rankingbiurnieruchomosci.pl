"use client";

import { useState } from "react";

const zl = (v: number) => `${Math.round(v).toLocaleString("pl-PL")} zł`;
const rate = (v: number) => `${v.toLocaleString("pl-PL", { maximumFractionDigits: 2 })}%`;

/**
 * Kalkulator prowizji przy sprzedaży: cena mieszkania razy stawka. Stawki domyślne to mediana i kwartyle
 * z cenników biur (przekazane z serwera), użytkownik może wpisać własną stawkę z oferty biura.
 */
export function CommissionCalculator({
  median,
  p25,
  p75,
  defaultPrice = 600000,
}: {
  median: number | null;
  p25: number | null;
  p75: number | null;
  defaultPrice?: number;
}) {
  const [price, setPrice] = useState(String(defaultPrice));
  const [own, setOwn] = useState(median != null ? String(median).replace(".", ",") : "2");
  const [plusVat, setPlusVat] = useState(true);
  const value = Number(price.replace(/\s/g, "").replace(",", "."));
  const ownRate = Number(own.replace(",", "."));
  const ok = Number.isFinite(value) && value > 0;
  const vat = plusVat ? 1.23 : 1;
  const rows: { label: string; r: number }[] = [];
  if (p25 != null) rows.push({ label: "Tańsza połowa biur (25. percentyl)", r: p25 });
  if (median != null) rows.push({ label: "Typowe biuro (mediana)", r: median });
  if (p75 != null) rows.push({ label: "Droższa połowa biur (75. percentyl)", r: p75 });
  if (Number.isFinite(ownRate) && ownRate > 0 && ownRate <= 10) rows.push({ label: "Twoja stawka", r: ownRate });
  return (
    <div className="calc">
      <div className="calc-fields">
        <label>
          Cena sprzedaży (zł)
          <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} aria-describedby="calc-out" />
        </label>
        <label>
          Stawka z oferty biura (%)
          <input inputMode="decimal" value={own} onChange={(e) => setOwn(e.target.value)} />
        </label>
        <label className="calc-check">
          <input type="checkbox" checked={plusVat} onChange={(e) => setPlusVat(e.target.checked)} />
          Doliczyć 23% VAT (stawka netto)
        </label>
      </div>
      <div className="tablewrap" id="calc-out" aria-live="polite">
        <table>
          <thead>
            <tr>
              <th>Wariant</th>
              <th className="num">Stawka</th>
              <th className="num">Prowizja{plusVat ? " z VAT" : ""}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="num">{rate(row.r)}</td>
                <td className="num">{ok ? zl((value * row.r * vat) / 100) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
