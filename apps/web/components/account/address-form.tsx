import { KENYAN_COUNTIES } from "@safuney/config";
import { Input, PhoneInput, Select, Textarea } from "@safuney/ui";
import type { Address } from "@safuney/db";
import { ActionForm } from "./action-form";
import type { ActionResult } from "@/lib/b2b/actions";

/** Add or edit a delivery address (server-rendered form bound to a server action). */
export function AddressForm({ action, address, submitLabel }: { action: (formData: FormData) => Promise<ActionResult>; address?: Address | null; submitLabel: string }) {
  return (
    <ActionForm action={action} submitLabel={submitLabel} className="border border-line bg-surface p-5">
      <Input name="label" label="Label" optional placeholder="Head office, Site 2, Kitchen store" defaultValue={address?.label ?? ""} maxLength={40} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="recipientName" label="Who receives it" defaultValue={address?.recipientName ?? ""} required autoComplete="name" />
        <PhoneInput name="phone" label="Their phone" defaultValue={address?.phone.replace(/^\+254/, "0") ?? ""} required />
        <Select name="county" label="County" defaultValue={address?.county ?? "Nairobi"} required>
          {KENYAN_COUNTIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input name="town" label="Town, estate or area" defaultValue={address?.town ?? ""} required />
      </div>
      <Input name="line1" label="Street, building or unit" optional defaultValue={address?.line1 ?? ""} />
      <Input name="landmark" label="Nearby landmark" optional defaultValue={address?.landmark ?? ""} helper="Helps the driver find the receiving bay." />
      <Textarea name="deliveryNotes" label="Delivery instructions" optional rows={2} defaultValue={address?.deliveryNotes ?? ""} helper="Gate procedures, offloading, who to call." />
      <label className="flex items-center gap-3 text-body text-ink">
        <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault ?? false} className="size-4 accent-accent" />
        Use as the default delivery address
      </label>
    </ActionForm>
  );
}
