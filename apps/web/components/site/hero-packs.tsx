import { PackShot } from "@safuney/ui";

/**
 * The hero's right-hand side: a group of packs, standing as they would on a shelf.
 *
 * The old hero left half the fold empty because the design plan reserved it for a photograph that does
 * not exist. An empty half-fold is not restraint, it reads as an unfinished page — and it was the first
 * thing wrong with the site. This uses the same drawn packs as the product grid, so the hero is made of
 * the same material as the catalogue rather than a separate decorative flourish.
 *
 * Sizes and zones are chosen to show the range at a glance: a green food-contact jerrican, a red
 * washroom drum, a blue general-areas bottle. The overlap and the varied baseline are what stop it
 * reading as three icons in a row.
 */
export function HeroPacks() {
  return (
    // 16/9 rather than 4/3: each PackShot's viewBox reserves headroom above the cap and below the
    // base, so a squarer container stacks that padding into visible dead space — most obvious on a
    // phone, where it pushed the trust bar a screen further down.
    <div aria-hidden className="relative isolate mx-auto aspect-[16/9] w-full max-w-xl">
      {/* Transparent, and spaced so no pack's label falls behind the one in front of it. */}
      <div className="absolute left-[2%] top-[-6%] w-[40%]">
        <PackShot packLabel="20 L" unit="L" size={20} zones={["RED"]} transparent />
      </div>
      <div className="absolute left-[31%] top-[-14%] z-10 w-[44%]">
        <PackShot packLabel="5 L" unit="L" size={5} zones={["GREEN"]} transparent />
      </div>
      <div className="absolute right-[3%] top-[2%] w-[31%]">
        <PackShot packLabel="1 L" unit="L" size={1} zones={["BLUE"]} transparent />
      </div>
    </div>
  );
}
