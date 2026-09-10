import Image from "next/image";
import { Icon } from "./icons";

import multiklin from "@/public/products/saf-multiklin.webp";
import quartsan from "@/public/products/saf-quartsan.webp";
import sanibac from "@/public/products/sanibac.webp";
import safshine from "@/public/products/safshine.webp";
import greaseBuster from "@/public/products/grease-buster.webp";

/**
 * Five packs off Safuney's own shelf on a white stage: the hero picture, in the slot where Alliance
 * Chemical shows its warehouse.
 *
 * The pack shots are the catalogue's own cut-outs (ADR 0016), about 480 px tall, so each is drawn at
 * or under its own pixel height; blown up past that they go soft.
 */
function Stage() {
  return (
    <div aria-hidden className="bg-stage relative isolate aspect-[5/4] overflow-hidden rounded-[20px] shadow-lift ring-1 ring-white/10">
      {/* The shelf the packs stand on. */}
      <div className="absolute inset-x-[6%] bottom-[11%] h-[5%] rounded-[50%] bg-ink/10 blur-md" />
      <div className="absolute bottom-[13%] left-[4%] w-[21%]">
        <Image src={quartsan} alt="" sizes="(min-width: 768px) 120px, 20vw" className="h-auto w-full" />
      </div>
      <div className="absolute bottom-[13%] left-[20%] z-10 w-[29%]">
        <Image src={multiklin} alt="" sizes="(min-width: 768px) 170px, 28vw" className="h-auto w-full" priority />
      </div>
      <div className="absolute bottom-[13%] left-[45%] z-20 w-[20%]">
        <Image src={sanibac} alt="" sizes="(min-width: 768px) 116px, 20vw" className="h-auto w-full" />
      </div>
      <div className="absolute bottom-[13%] left-[60%] z-10 w-[24%]">
        <Image src={greaseBuster} alt="" sizes="(min-width: 768px) 140px, 24vw" className="h-auto w-full" />
      </div>
      <div className="absolute bottom-[13%] right-[1%] w-[23%]">
        <Image src={safshine} alt="" sizes="(min-width: 768px) 134px, 23vw" className="h-auto w-full" />
      </div>
    </div>
  );
}

/** The stage, optionally with the two floating facts (how far a drum goes, how fast a price comes back). */
export function HeroStage({ cards = true }: { cards?: boolean } = {}) {
  return (
    <div className="relative mx-auto w-full max-w-[36rem]">
      <Stage />
      {cards ? (
        <>
          <div className="absolute -left-3 top-5 hidden max-w-[17rem] items-start gap-3 rounded-card bg-surface p-4 text-ink shadow-lift sm:flex md:-left-8">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-wash text-accent">
              <Icon name="droplet" className="size-5" />
            </span>
            <p className="text-small">
              <span className="block text-h4 tnum">5 L makes 505 L</span>
              <span className="text-ink-muted">SAF MULTIKLIN at 1:100 for general cleaning</span>
            </p>
          </div>
          <div className="absolute -bottom-5 right-3 flex max-w-[17rem] items-start gap-3 rounded-card bg-surface p-4 text-ink shadow-lift md:-right-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cta/20 text-brand-green-ink">
              <Icon name="clock" className="size-5" />
            </span>
            <p className="text-small">
              <span className="block text-h4">Priced in 1 working day</span>
              <span className="text-ink-muted">Send a list, or a photo of your store</span>
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
