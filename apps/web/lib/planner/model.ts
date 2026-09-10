/**
 * Facility hygiene planner.
 *
 * A buyer enters what kind of facility they run and how big it is; we return a monthly consumption
 * estimate, a colour-coded equipment kit and a cleaning schedule.
 *
 * **The numbers are estimates and the page says so.** They come from the coverage a concentrate
 * actually gives at its own dilution and from cleaning frequencies that are standard in each setting —
 * not from a claim about a particular customer's site. A planner that pretends to precision it cannot
 * have would have people ordering to it and running out mid-month.
 */
export interface FacilityType {
  slug: string;
  name: string;
  /** What the size number means for this facility. */
  unitLabel: string;
  unitHint: string;
  /** Litres of ready-to-use solution per unit per clean, by task. */
  tasks: Array<{
    key: string;
    label: string;
    zone: "RED" | "BLUE" | "GREEN" | "YELLOW";
    /** Cleans per month. */
    frequency: number;
    frequencyLabel: string;
    /** Litres of made-up solution per unit, per clean. */
    litresPerUnit: number;
    /** Typical dilution for this task, as the "1:n" denominator. */
    ratio: number;
    /** Category slug to shop for this task. */
    category: string;
  }>;
}

export const FACILITY_TYPES: readonly FacilityType[] = [
  {
    slug: "hotel",
    name: "Hotel or lodge",
    unitLabel: "Guest rooms",
    unitHint: "Rooms let, not total rooms.",
    tasks: [
      { key: "bathroom", label: "Guest bathrooms", zone: "RED", frequency: 30, frequencyLabel: "daily", litresPerUnit: 0.5, ratio: 40, category: "housekeeping" },
      { key: "rooms", label: "Guest rooms and corridors", zone: "BLUE", frequency: 30, frequencyLabel: "daily", litresPerUnit: 0.8, ratio: 40, category: "housekeeping" },
      { key: "kitchen", label: "Kitchen surfaces and food contact", zone: "GREEN", frequency: 60, frequencyLabel: "twice daily", litresPerUnit: 0.15, ratio: 100, category: "disinfection" },
      { key: "laundry", label: "Laundry", zone: "BLUE", frequency: 30, frequencyLabel: "daily", litresPerUnit: 0.3, ratio: 1, category: "laundry" },
    ],
  },
  {
    slug: "restaurant",
    name: "Restaurant or canteen",
    unitLabel: "Covers per day",
    unitHint: "Meals served on a normal day.",
    tasks: [
      { key: "surfaces", label: "Food-contact surfaces", zone: "GREEN", frequency: 60, frequencyLabel: "twice daily", litresPerUnit: 0.02, ratio: 100, category: "disinfection" },
      { key: "degrease", label: "Extraction, fryers and hobs", zone: "GREEN", frequency: 4, frequencyLabel: "weekly", litresPerUnit: 0.06, ratio: 10, category: "specialty" },
      { key: "floors", label: "Kitchen and dining floors", zone: "BLUE", frequency: 30, frequencyLabel: "daily", litresPerUnit: 0.05, ratio: 40, category: "housekeeping" },
      { key: "washroom", label: "Customer washrooms", zone: "RED", frequency: 60, frequencyLabel: "twice daily", litresPerUnit: 0.01, ratio: 40, category: "housekeeping" },
    ],
  },
  {
    slug: "clinic",
    name: "Clinic or hospital ward",
    unitLabel: "Beds",
    unitHint: "Beds in use.",
    tasks: [
      { key: "clinical", label: "Clinical surfaces and bed spaces", zone: "YELLOW", frequency: 60, frequencyLabel: "twice daily", litresPerUnit: 0.4, ratio: 100, category: "disinfection" },
      { key: "floors", label: "Ward floors and corridors", zone: "BLUE", frequency: 30, frequencyLabel: "daily", litresPerUnit: 0.6, ratio: 40, category: "disinfection" },
      { key: "washroom", label: "Washrooms and sluice", zone: "RED", frequency: 60, frequencyLabel: "twice daily", litresPerUnit: 0.3, ratio: 40, category: "housekeeping" },
      { key: "hands", label: "Hand hygiene", zone: "YELLOW", frequency: 30, frequencyLabel: "daily", litresPerUnit: 0.05, ratio: 1, category: "personal-hygiene" },
    ],
  },
  {
    slug: "school",
    name: "School or college",
    unitLabel: "Students",
    unitHint: "Students on site on a normal day.",
    tasks: [
      { key: "classrooms", label: "Classrooms and touch points", zone: "BLUE", frequency: 22, frequencyLabel: "each school day", litresPerUnit: 0.03, ratio: 40, category: "housekeeping" },
      { key: "washroom", label: "Washrooms", zone: "RED", frequency: 44, frequencyLabel: "twice each school day", litresPerUnit: 0.02, ratio: 40, category: "housekeeping" },
      { key: "kitchen", label: "Kitchen and dining", zone: "GREEN", frequency: 22, frequencyLabel: "each school day", litresPerUnit: 0.01, ratio: 100, category: "disinfection" },
    ],
  },
  {
    slug: "office",
    name: "Office or commercial building",
    unitLabel: "Square metres",
    unitHint: "Cleanable floor area.",
    tasks: [
      { key: "floors", label: "Floors and common areas", zone: "BLUE", frequency: 22, frequencyLabel: "each working day", litresPerUnit: 0.012, ratio: 40, category: "housekeeping" },
      { key: "washroom", label: "Washrooms", zone: "RED", frequency: 22, frequencyLabel: "each working day", litresPerUnit: 0.004, ratio: 40, category: "housekeeping" },
      { key: "touchpoints", label: "Desks and touch points", zone: "BLUE", frequency: 22, frequencyLabel: "each working day", litresPerUnit: 0.003, ratio: 100, category: "disinfection" },
    ],
  },
  {
    slug: "factory",
    name: "Factory or processing plant",
    unitLabel: "Square metres",
    unitHint: "Production and welfare area.",
    tasks: [
      { key: "floors", label: "Production floors", zone: "BLUE", frequency: 26, frequencyLabel: "each shift day", litresPerUnit: 0.02, ratio: 40, category: "housekeeping" },
      { key: "degrease", label: "Equipment degreasing", zone: "BLUE", frequency: 4, frequencyLabel: "weekly", litresPerUnit: 0.01, ratio: 10, category: "specialty" },
      { key: "welfare", label: "Washrooms and canteen", zone: "RED", frequency: 26, frequencyLabel: "each shift day", litresPerUnit: 0.006, ratio: 40, category: "housekeeping" },
      { key: "drains", label: "Drains and traps", zone: "BLUE", frequency: 4, frequencyLabel: "weekly", litresPerUnit: 0.002, ratio: 1, category: "specialty" },
    ],
  },
];

export interface TaskEstimate {
  key: string;
  label: string;
  zone: FacilityType["tasks"][number]["zone"];
  frequencyLabel: string;
  /** Litres of made-up solution needed per month. */
  solutionLitres: number;
  /** Litres of concentrate that implies, at the task's dilution. */
  concentrateLitres: number;
  ratio: number;
  category: string;
}

export interface Plan {
  facility: FacilityType;
  units: number;
  tasks: TaskEstimate[];
  totalConcentrateLitres: number;
  /** The zones this facility runs, for the equipment kit. */
  zones: Array<FacilityType["tasks"][number]["zone"]>;
}

export const MAX_UNITS = 100_000;

function round(n: number): number {
  return n < 10 ? Math.round(n * 10) / 10 : Math.round(n);
}

/**
 * Monthly consumption for a facility.
 *
 * A concentrate at 1:n makes (n+1) parts of solution from one part of product, so the concentrate
 * needed is the solution volume divided by (n+1).
 *
 * A product used neat — laundry dosing, alcohol gel, enzyme drain treatment — carries ratio 1 and is
 * NOT divided: you get through exactly the volume you apply. Running it through the same (n+1)
 * arithmetic would halve it, which for hand gel in a ward is the difference between ordering enough
 * and running out in the third week.
 */
export function plan(facilitySlug: string, units: number): Plan | null {
  const facility = FACILITY_TYPES.find((f) => f.slug === facilitySlug);
  if (!facility) return null;
  const n = Math.max(1, Math.min(MAX_UNITS, Math.floor(units)));
  const tasks: TaskEstimate[] = facility.tasks.map((t) => {
    const solutionLitres = t.litresPerUnit * n * t.frequency;
    return {
      key: t.key,
      label: t.label,
      zone: t.zone,
      frequencyLabel: t.frequencyLabel,
      solutionLitres: round(solutionLitres),
      concentrateLitres: round(t.ratio <= 1 ? solutionLitres : solutionLitres / (t.ratio + 1)),
      ratio: t.ratio,
      category: t.category,
    };
  });
  return {
    facility,
    units: n,
    tasks,
    // Summed from the rounded rows, not from the raw figures: the total on the page has to equal the
    // column above it, or the first person to add it up stops trusting the whole plan.
    totalConcentrateLitres: round(tasks.reduce((sum, t) => sum + t.concentrateLitres, 0)),
    zones: [...new Set(facility.tasks.map((t) => t.zone))],
  };
}
