/** Шапка и подвал чека. Чек не фискальный: фискализацию (soliq) нужно подключать отдельно. */
export function ReceiptHead({ brand, location }: { brand: string; location: { name: string; address: string | null; phone: string | null } }) {
  return (
    <header className="text-center">
      <p className="text-[18px] font-black">{brand}</p>
      <p>{location.name}</p>
      {location.address && <p className="text-[11px]">{location.address}</p>}
      {location.phone && <p className="text-[11px]">{location.phone}</p>}
    </header>
  );
}
export const ReceiptFoot = ({ note }: { note?: string }) => (
  <footer className="mt-3 text-center text-[11px]">
    {note && <p className="mb-1 font-bold">{note}</p>}
    <p>Спасибо, что выбрали нас!</p>
    <p>Не является фискальным документом</p>
  </footer>
);
