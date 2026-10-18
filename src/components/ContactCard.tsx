import { useQuery } from "@tanstack/react-query";
import { MapPin, Phone, Instagram } from "lucide-react";
import { settingsQuery } from "@/lib/shop";

export function ContactCard() {
  const { data } = useQuery(settingsQuery);
  if (!data) return null;
  const has = data.contact_phone || data.contact_whatsapp || data.stall_address || data.instagram;
  if (!has) return null;
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-warm">
      <h3 className="mb-3 text-lg font-semibold">Contact us</h3>
      <ul className="space-y-2 text-sm">
        {data.contact_phone && (
          <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-caramel" />
            <a href={`tel:${data.contact_phone}`} className="underline-offset-2 hover:underline">{data.contact_phone}</a></li>
        )}
        {data.contact_whatsapp && (
          <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-caramel" />
            <a href={`https://wa.me/${data.contact_whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="hover:underline">WhatsApp {data.contact_whatsapp}</a></li>
        )}
        {data.stall_address && (
          <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-caramel" />{data.stall_address}</li>
        )}
        {data.instagram && (
          <li className="flex items-center gap-2"><Instagram className="h-4 w-4 text-caramel" />{data.instagram}</li>
        )}
      </ul>
    </div>
  );
}
