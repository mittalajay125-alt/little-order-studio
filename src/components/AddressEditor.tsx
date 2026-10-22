import { useState } from "react";
import { LocateFixed, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { addressSchema, emptyAddress, type AddressInput, type SavedAddress } from "@/lib/customer";

const fields: { key: keyof Pick<AddressInput, "label" | "full_name" | "phone" | "house" | "street" | "area" | "city" | "state" | "pin" | "landmark">; label: string; max: number }[] = [
  { key: "label", label: "Label (Home / Work)", max: 40 }, { key: "full_name", label: "Full name", max: 80 },
  { key: "phone", label: "Mobile number", max: 13 }, { key: "house", label: "House / Flat number", max: 100 },
  { key: "street", label: "Street / Road", max: 150 }, { key: "area", label: "Area / Locality", max: 100 },
  { key: "city", label: "City", max: 80 }, { key: "state", label: "State", max: 80 },
  { key: "pin", label: "PIN code", max: 6 }, { key: "landmark", label: "Landmark (optional)", max: 150 },
];
export function AddressEditor({ userId, initial, name, onSaved, onCancel }: { userId: string; initial?: SavedAddress | undefined; name?: string | undefined; onSaved: (address: SavedAddress) => void; onCancel: () => void }) {
  const [form, setForm] = useState<AddressInput>(initial ?? { ...emptyAddress, full_name: name ?? "" });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  async function locate() {
    if (locating) return;
    setLocating(true); setError(""); setLocationMessage(""); setConfirmed(false);
    if (!navigator.geolocation) { setLocationMessage("Location is unavailable. Enter your address manually."); setLocating(false); return; }
    navigator.geolocation.getCurrentPosition(async position => {
      const { latitude, longitude } = position.coords;
      setForm(previous => ({ ...previous, latitude, longitude }));
      try {
        const params = new URLSearchParams({ format: "jsonv2", lat: String(latitude), lon: String(longitude), addressdetails: "1", zoom: "18" });
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error("Address lookup unavailable");
        const data = await response.json() as { address?: Record<string, string> };
        const a = data.address;
        if (!a) throw new Error("No address found");
        setForm(previous => ({ ...previous, house: a["house_number"] ?? previous.house, street: a["road"] ?? previous.street, area: a["suburb"] ?? a["neighbourhood"] ?? a["village"] ?? previous.area, city: a["city"] ?? a["town"] ?? a["county"] ?? previous.city, state: a["state"] ?? previous.state, pin: a["postcode"] ?? previous.pin }));
        setLocationMessage("Address detected. Review the details and confirm before saving.");
      } catch { setLocationMessage("Location detected, but address lookup failed. Enter the address details manually."); }
      finally { setLocating(false); }
    }, () => { setLocating(false); setLocationMessage("Location permission was denied or detection failed. Enter your address manually."); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const parsed = addressSchema.safeParse(form);
    if (!parsed.success) { const issue = parsed.error.issues[0]; setError(`${issue?.path.join(" ")}: ${issue?.message}`); return; }
    if (!confirmed) { setError("Confirm your delivery address before saving."); return; }
    setBusy(true);
    try {
      const values = { ...parsed.data, user_id: userId };
      const query = initial ? supabase.from("customer_addresses").update(values).eq("id", initial.id).eq("user_id", userId) : supabase.from("customer_addresses").insert(values);
      const { data, error } = await query.select().single();
      if (error) { setError(error.message); return; }
      onSaved(data);
    } catch { setError("Your address could not be saved. Please try again."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-4 border-t pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl">{initial ? "Edit address" : "Add address"}</h3><Button type="button" variant="outline" disabled={locating || busy} onClick={locate}><LocateFixed />{locating ? "Finding location…" : "Use Current Location"}</Button></div>
    <p className="text-xs text-muted-foreground">Location lookup shares your coordinates with OpenStreetMap only when you choose it.</p>
    {locationMessage && <p role="status" className="text-sm">{locationMessage}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{fields.map(f => <label className="block text-sm" key={f.key}>{f.label}<input className="mt-1 w-full rounded-md border bg-card px-3 py-2" value={form[f.key]} maxLength={f.max} required={f.key !== "landmark"} inputMode={f.key === "pin" || f.key === "phone" ? "numeric" : "text"} onChange={e => { setForm({ ...form, [f.key]: e.target.value }); setConfirmed(false); }} /></label>)}</div>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required />I confirm this delivery address is correct.</label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button disabled={busy || locating}><Save />{busy ? "Saving…" : "Save address"}</Button><Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button></div>
    <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="block text-xs text-muted-foreground underline">Location data © OpenStreetMap contributors</a>
  </form>;
}