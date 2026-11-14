import Link from "next/link";

import { operator, SERVICE_HOST } from "@/lib/legal";

/** Dane operatora serwisu w dokumentach prawnych. Pokazuje tylko pola uzupełnione w konfiguracji. */
export function OperatorDetails() {
  const op = operator();
  const ids = [op.nip && `NIP ${op.nip}`, op.regon && `REGON ${op.regon}`, op.krs && `KRS ${op.krs}`, op.regNo && `nr rej. ${op.regNo}`].filter(Boolean);
  return (
    <>
      {op.name ? <strong>{op.name}</strong> : <strong>operator serwisu {SERVICE_HOST}</strong>}
      {op.address && <>, {op.address}</>}
      {ids.length > 0 && <>, {ids.join(", ")}</>}
    </>
  );
}

/** Sposób kontaktu z operatorem: e-mail (gdy ustawiony) i zawsze formularz /dla-firm. */
export function OperatorContact() {
  const op = operator();
  return (
    <>
      {op.email && (
        <>
          e-mail <a href={`mailto:${op.email}`}>{op.email}</a> albo{" "}
        </>
      )}
      formularz na stronie <Link href="/dla-firm">Dla biur</Link> (rodzaj zgłoszenia „Inna sprawa”)
      {op.address && <>, albo listownie na adres {op.address}</>}
    </>
  );
}
