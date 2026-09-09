import Link from "next/link";
import { ButtonLink, ZONES, ZoneBand } from "@safuney/ui";
import { site } from "@/config/site";
import { getZoneCounts } from "@/lib/catalogue";
import { getSetting } from "@/lib/settings";
import { messages } from "@/lib/i18n/messages";
import { TrustStrip } from "@/components/site/trust-strip";

export const revalidate = 3600;

export default async function SwahiliHome() {
  const t = messages("sw");
  const [zoneCounts, kraPin, vatNumber] = await Promise.all([getZoneCounts(), getSetting("company.kraPin"), getSetting("company.vatNumber")]);

  return (
    <>
      <section aria-labelledby="hero-sw" className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-page gap-8 px-5 py-12 md:grid-cols-12 md:px-6 md:py-20">
          <div className="md:col-span-7">
            <h1 id="hero-sw" className="max-w-[34rem] text-display">
              {t("home.title")}
            </h1>
          </div>
          <div className="flex flex-col gap-6 md:col-span-5 md:pt-2">
            <p className="max-w-[30rem] text-body text-ink-muted">{t("home.lead")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/products">{t("home.browse")}</ButtonLink>
              <ButtonLink href="/quote" variant="secondary">
                {t("home.quote")}
              </ButtonLink>
            </div>
            <p className="text-caption text-ink-muted">
              Ukurasa wa bidhaa uko kwa Kiingereza kwa sasa.{" "}
              <Link href="/" className="text-accent underline">
                English
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="zones-sw" className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-24">
        <h2 id="zones-sw" className="text-h2">
          {t("zones.heading")}
        </h2>
        <p className="mt-2 max-w-[62ch] text-ink-muted">
          Taasisi hupanga usafi kwa rangi ili vifaa vya chooni visifike jikoni. Kila bidhaa hapa ina rangi ya
          eneo lake, na neno limeandikwa kando yake kila mara.
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ZONES.map((z) => {
            const count = zoneCounts?.[z.key] ?? 0;
            return (
              <li key={z.key} className="border border-line bg-surface">
                <ZoneBand zones={[z.key]} />
                <div className="p-5">
                  <p className="text-h4 text-ink">{t(`zone.${z.key}` as const)}</p>
                  <p className="mt-2 text-small text-ink-muted">
                    {count > 0 ? `Bidhaa ${count}` : "Bidhaa zinakaguliwa"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-auto max-w-page px-5 pb-16 md:px-6">
        <h2 className="text-h2">Tunaowahudumia</h2>
        <p className="mt-6 max-w-[62ch] text-ink-muted">{site.industries.join(", ")}.</p>
      </section>

      <TrustStrip facts={{ kraPin, vatNumber }} />
    </>
  );
}
