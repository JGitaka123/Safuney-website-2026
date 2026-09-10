/**
 * A short name, a code and an accent for each range, for the "shop by range" cards — the way Alliance
 * Chemical badges its families ACD, SOL, BAS. The accents are decorative and never carry meaning on
 * their own (the range name is always written beside them), and they are deliberately not the four
 * zone colours, which stay reserved for zones (plan §2.2). Every text colour here is at least 4.5:1 on
 * white.
 *
 * Full class strings, so Tailwind can see them.
 */
export interface RangeMeta {
  short: string;
  code: string;
  border: string;
  text: string;
  badge: string;
}

export const RANGE_META: Record<string, RangeMeta> = {
  warewashing: { short: "Warewashing", code: "WW", border: "border-l-amber-600", text: "text-amber-700", badge: "bg-amber-50 text-amber-800 ring-amber-200" },
  disinfection: { short: "Disinfection", code: "DIS", border: "border-l-violet-600", text: "text-violet-700", badge: "bg-violet-50 text-violet-800 ring-violet-200" },
  specialty: { short: "Speciality", code: "SPC", border: "border-l-sky-600", text: "text-sky-700", badge: "bg-sky-50 text-sky-800 ring-sky-200" },
  "personal-hygiene": { short: "Personal hygiene", code: "PH", border: "border-l-rose-600", text: "text-rose-700", badge: "bg-rose-50 text-rose-800 ring-rose-200" },
  housekeeping: { short: "Housekeeping", code: "HK", border: "border-l-blue-600", text: "text-blue-700", badge: "bg-blue-50 text-blue-800 ring-blue-200" },
  "process-hygiene": { short: "Process hygiene", code: "PRC", border: "border-l-teal-600", text: "text-teal-700", badge: "bg-teal-50 text-teal-800 ring-teal-200" },
  laundry: { short: "Laundry", code: "LDY", border: "border-l-indigo-600", text: "text-indigo-700", badge: "bg-indigo-50 text-indigo-800 ring-indigo-200" },
  bactro: { short: "Bactro biological", code: "BIO", border: "border-l-emerald-600", text: "text-emerald-700", badge: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  equipment: { short: "Equipment", code: "EQP", border: "border-l-slate-500", text: "text-slate-700", badge: "bg-slate-100 text-slate-800 ring-slate-300" },
};

export function rangeMeta(slug: string): RangeMeta {
  return (
    RANGE_META[slug] ?? { short: slug, code: slug.slice(0, 3).toUpperCase(), border: "border-l-slate-500", text: "text-slate-700", badge: "bg-slate-100 text-slate-800 ring-slate-300" }
  );
}
