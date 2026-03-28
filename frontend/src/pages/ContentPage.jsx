import { GlassCard } from "../components/GlassCard";

export function ContentPage({ page }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <GlassCard className="h-fit space-y-4 lg:sticky lg:top-28">
          <p className="section-title">{page.eyebrow}</p>
          <h1 className="text-3xl font-semibold text-white">{page.title}</h1>
          <p className="leading-7 text-gray-300">{page.sideNote}</p>
        </GlassCard>

        <GlassCard className="space-y-10">
          <div className="space-y-4">
            <p className="section-copy">{page.intro}</p>
          </div>

          {page.sections.map((section) => (
            <section key={section.heading} className="space-y-4 border-t border-white/10 pt-8 first:border-t-0 first:pt-0">
              <h2 className="text-2xl font-semibold text-white">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="leading-7 text-gray-300">
                  {paragraph}
                </p>
              ))}
              {section.items ? (
                <ul className="grid gap-3 text-gray-300">
                  {section.items.map((item) => (
                    <li key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 leading-7">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </GlassCard>
      </div>
    </div>
  );
}
