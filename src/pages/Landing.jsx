import { motion as Motion } from "framer-motion";
import { ArrowRight, BadgeCheck, ChartSpline, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "../assets/hero.png";
import { GlassCard } from "../components/GlassCard";
import { buttonStyles, cn } from "../lib/ui";

const features = [
  {
    title: "Cited market proof",
    desc: "Every research card stays attached to a source link so judges and founders can verify the claim.",
    icon: ChartSpline,
  },
  {
    title: "Deployable output",
    desc: "Each run creates a public landing page and tracks real waitlist behavior instead of fake metrics.",
    icon: Rocket,
  },
  {
    title: "Decision with teeth",
    desc: "The workflow ends with a blunt Go, Pivot, or Kill recommendation grounded in evidence.",
    icon: BadgeCheck,
  },
];

const steps = [
  "Drop in a startup idea.",
  "Run research, hypothesis, and launch generation.",
  "Share the public landing page to collect real demand.",
  "Read the decision when signal starts to appear.",
];

export function Landing() {
  return (
    <div className="page-shell mx-auto flex max-w-7xl flex-col gap-24 px-6 py-16">
      <section className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-8">
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-accent-purple/20 bg-accent-purple/10 px-4 py-2 text-sm font-semibold text-accent-purple shadow-[0_0_15px_rgba(124,58,237,0.28)]"
          >
            <Sparkles className="h-4 w-4" />
            AI startup validation workflow
          </Motion.div>

          <Motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="max-w-4xl text-5xl font-bold tracking-tight text-white text-glow sm:text-6xl lg:text-8xl"
          >
            Do not generate plans.
            <span className="mt-3 block bg-gradient-to-r from-accent-purple to-accent-cyan bg-clip-text text-transparent">
              Test startup demand.
            </span>
          </Motion.h1>

          <Motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="max-w-2xl text-lg leading-8 text-gray-300"
          >
            ValidationEngine turns a raw concept into sourced market research, a live launch page,
            waitlist capture, and a decision that is tied to actual behavior.
          </Motion.p>

          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="flex flex-wrap gap-4"
          >
            <Link to="/dashboard" className={cn(buttonStyles("primary"), "px-8 py-4 text-base")}>
              Open dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://vercel.com/docs"
              target="_blank"
              rel="noreferrer"
              className={cn(buttonStyles("secondary"), "px-8 py-4 text-base")}
            >
              View deployment docs
            </a>
          </Motion.div>

          <div className="grid gap-3 sm:grid-cols-3">
            {["Live landing pages", "Email-verified accounts", "Research-backed decisions"].map((item) => (
              <div key={item} className="glass-panel rounded-2xl px-4 py-4 text-sm text-gray-200">
                {item}
              </div>
            ))}
          </div>
        </div>

        <Motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.55 }}
          className="relative"
        >
          <div className="absolute inset-x-12 top-10 -z-10 h-40 rounded-full bg-accent-cyan/20 blur-[90px]" />
          <GlassCard className="overflow-hidden border-white/15 bg-white/6 p-4 shadow-[0_24px_80px_rgba(5,8,18,0.45)]">
            <img
              src={heroImage}
              alt="ValidationEngine dashboard preview"
              className="w-full rounded-[1.5rem] border border-white/10 object-cover"
            />
          </GlassCard>
        </Motion.div>
      </section>

      <section id="features" className="space-y-6">
        <div className="space-y-3">
          <p className="section-title">What ships in one run</p>
          <h2 className="max-w-2xl text-3xl font-semibold text-white sm:text-4xl">
            One frontend, one dashboard, one repeatable validation loop.
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {features.map((feature, index) => {
            const FeatureIcon = feature.icon;

            return (
            <Motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: index * 0.08 }}
            >
              <GlassCard hoverable className="flex h-full flex-col gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-accent-cyan shadow-[0_0_20px_rgba(6,182,212,0.18)]">
                  <FeatureIcon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                <p className="leading-7 text-gray-400">{feature.desc}</p>
              </GlassCard>
            </Motion.div>
            );
          })}
        </div>
      </section>

      <section id="how" className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <GlassCard className="space-y-5">
          <p className="section-title">How it works</p>
          <h2 className="text-3xl font-semibold text-white">Validation, not startup theater.</h2>
          <p className="section-copy">
            The product does the parts founders usually duct-tape together: market context, landing
            copy, waitlist capture, and a final readout that does not hide behind vague summaries.
          </p>
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-gray-300">
            Useful for hackathons, founder MVP screens, accelerator demos, or internal idea
            triage.
          </div>
        </GlassCard>

        <div className="grid gap-4">
          {steps.map((step, index) => (
            <GlassCard key={step} className="flex items-start gap-4 p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold text-accent-cyan">
                {index + 1}
              </div>
              <div>
                <h3 className="mb-1 text-lg font-semibold text-white">{step}</h3>
                <p className="text-sm leading-7 text-gray-400">
                  {index === 0 && "The system stores your run so the dashboard can resume later."}
                  {index === 1 && "Research, hypothesis, and page generation happen in sequence."}
                  {index === 2 && "Every landing page tracks visits and waitlist submissions."}
                  {index === 3 && "The dashboard converts those signals into a clear recommendation."}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_24px_70px_rgba(5,8,18,0.35)] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <p className="section-title">Account layer</p>
          <h2 className="text-3xl font-semibold text-white">Email verification and profile state are now part of the same app.</h2>
          <p className="section-copy">
            Sign up, verify, sign in, update your profile, and move back into the validation
            dashboard without switching frontend stacks.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="glass-panel rounded-3xl p-5">
            <ShieldCheck className="mb-4 h-6 w-6 text-accent-cyan" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Auth</p>
            <p className="mt-2 text-gray-200">Email verification, sign in, sign up, and profile routes.</p>
          </div>
          <div className="glass-panel rounded-3xl p-5">
            <Rocket className="mb-4 h-6 w-6 text-accent-purple" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Deploy</p>
            <p className="mt-2 text-gray-200">Single Vite frontend with Vercel routing and runtime backend config.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
