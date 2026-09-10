import Image from "next/image";

import multiklin from "@/public/products/saf-multiklin.webp";
import sanibac from "@/public/products/sanibac.webp";
import safshine from "@/public/products/safshine.webp";

/**
 * The hero's right-hand side: three packs off Safuney's own shelf.
 *
 * These are the catalogue's own photographs, cut out of the July 2024 PDF (ADR 0016), not drawings
 * and not stock imagery — a 20 L multi-purpose drum, a 5 L germicidal handwash and a 15 kg destainer
 * pail, chosen because the three silhouettes and the three colours read as a range rather than as one
 * product photographed three times.
 *
 * The group is capped at 32 rem so each image lands close to its own pixel size. The catalogue's
 * bitmaps are around 130 px wide; blown up to fill a hero they go soft, and a soft photograph of a
 * real pack looks worse than the drawing it replaced.
 */
export function HeroPacks() {
  return (
    <div aria-hidden className="relative isolate mx-auto aspect-[16/10] w-full max-w-[32rem]">
      <div className="absolute bottom-0 left-[3%] w-[34%]">
        <Image src={multiklin} alt="" sizes="(min-width: 640px) 174px, 34vw" className="h-auto w-full" />
      </div>
      <div className="absolute bottom-0 left-[36%] z-10 w-[27%]">
        <Image src={sanibac} alt="" sizes="(min-width: 640px) 138px, 27vw" className="h-auto w-full" priority />
      </div>
      <div className="absolute bottom-0 right-[4%] w-[31%]">
        <Image src={safshine} alt="" sizes="(min-width: 640px) 159px, 31vw" className="h-auto w-full" />
      </div>
    </div>
  );
}
