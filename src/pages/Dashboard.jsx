import { useState } from "react";
import { ExternalLink, LoaderCircle, RefreshCw, Sparkles, Target, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { GlassCard } from "../components/GlassCard";
import { Skeleton } from "../components/Skeleton";
import { useValidationEngine } from "../hooks/useValidationEngine";
import { getStoredUser } from "../lib/session";
import { buttonStyles, cn } from "../lib/ui";

function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center opacity-80">
      <Zap className="mb-4 h-11 w-11 text-accent-cyan drop-shadow-[0_0_15px_rgba(6,182,212,0.55)]" />
      <p className="max-w-sm text-gray-400">{text}</p>
    </div>
  );
}

export function Dashboard({ showToast }) {
  const { payload, submitIdea, refreshIdeaState, isLoading, error, apiBaseUrl } = useValidationEngine();
  const [ideaText, setIdeaText] = useState("");
  const user = getStoredUser();

  async function handleSubmit(event) {
    event.preventDefault();
    if (!ideaText.trim()) {
      return;
    }

    try {
      showToast("Running validation workflow...", "info");
      await submitIdea(ideaText.trim());
      setIdeaText("");
      showToast("Validation run created. Your landing page is live.", "success");
    } catch (requestError) {
      showToast(requestError.message || "Failed to start validation", "error");
    }
  }

  const analytics = payload?.analytics || {
    visits: 0,
    signups: 0,
    conversionRate: 0,
    interviewRequests: 0,
  };

  const decisionTone =
    payload?.decision?.decision === "go"
      ? "text-green-400"
      : payload?.decision?.decision === "kill"
        ? "text-red-400"
        : payload?.decision?.decision === "pivot"
          ? "text-orange-400"
          : "text-slate-200";

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[320px_1fr]">
      <aside className="sticky top-28 space-y-6 self-start">
        <GlassCard className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-title">Environment</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Frontend now speaks to one backend.</h2>
            </div>
            <Sparkles className="h-5 w-5 text-accent-cyan" />
          </div>

          <div className="grid gap-3 text-sm">
            <div className="glass-panel rounded-2xl px-4 py-3 text-gray-300">
              <span className="block text-xs uppercase tracking-[0.18em] text-gray-500">API base</span>
              <span className="mt-2 block break-all text-sm text-white">
                {apiBaseUrl || "Resolving..."}
              </span>
            </div>
            <div className="glass-panel rounded-2xl px-4 py-3 text-gray-300">
              <span className="block text-xs uppercase tracking-[0.18em] text-gray-500">Account</span>
              <span className="mt-2 block text-white">{user?.email || "Guest session"}</span>
            </div>
          </div>

          {payload?.landingPage?.url ? (
            <a href={payload.landingPage.url} target="_blank" rel="noreferrer" className="block">
              <span className={cn(buttonStyles("primary"), "flex w-full")}>
                Open live page
                <ExternalLink className="h-4 w-4" />
              </span>
            </a>
          ) : (
            <p className="text-sm leading-7 text-gray-400">
              Launch a run to generate a public waitlist page and start collecting real interest.
            </p>
          )}
        </GlassCard>

        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Run status</h2>
            <button
              type="button"
              onClick={() => refreshIdeaState(false)}
              className="rounded-full border border-white/10 p-2 text-gray-300 transition-colors hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="status-chip">{payload?.idea ? `Idea #${payload.idea.id}` : "No idea"}</span>
            <span className="status-chip">{payload?.mode?.aiMode || "Awaiting run"}</span>
            <span className="status-chip">{payload?.mode?.researchMode || "No research mode"}</span>
            <span className="status-chip">{payload?.idea?.status || "Idle"}</span>
          </div>

          <div className="grid gap-3">
            {(payload?.progress || []).map((step) => (
              <div key={step.key} className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                <span className="text-sm text-gray-300">{step.label}</span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-cyan">
                  {step.status}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </aside>

      <main className="space-y-8">
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <GlassCard className="space-y-6">
            <div className="space-y-3">
              <p className="section-title">Launch a run</p>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Validation dashboard
              </h1>
              <p className="section-copy max-w-2xl">
                Submit one idea, generate research and landing copy, then use the public URL to
                measure actual signup intent.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={ideaText}
                onChange={(event) => setIdeaText(event.target.value)}
                placeholder="Example: An AI copilot that helps SaaS founders validate pricing and early demand before they build."
                className="field-input min-h-[160px] resize-y"
                required
              />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Running workflow
                    </>
                  ) : (
                    <>
                      Start validation
                      <Target className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="text-sm text-gray-500">
                  Research, hypothesis, landing page, and decision update in the same run.
                </p>
              </div>
            </form>

            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            {payload?.idea?.text ? (
              <div className="rounded-3xl border border-white/10 bg-black/20 px-5 py-4">
                <span className="text-xs uppercase tracking-[0.18em] text-gray-500">Current idea</span>
                <p className="mt-2 leading-7 text-gray-200">{payload.idea.text}</p>
              </div>
            ) : null}
          </GlassCard>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Visitors", value: analytics.visits },
              { label: "Signups", value: analytics.signups },
              { label: "Conversion", value: `${analytics.conversionRate}%` },
              { label: "Interviews", value: analytics.interviewRequests },
            ].map((metric) => (
              <GlassCard key={metric.label} className="p-6">
                <p className="text-sm uppercase tracking-[0.18em] text-gray-500">{metric.label}</p>
                <p className="mt-4 text-4xl font-semibold tracking-tight text-white">{metric.value}</p>
              </GlassCard>
            ))}
            {!user ? (
              <GlassCard className="sm:col-span-2">
                <p className="section-title">Account</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Save your profile for longer-lived use.</h2>
                <p className="mt-3 text-gray-400">
                  Dashboard runs work without sign-in, but account routes now live in the same frontend.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link to="/signup" className={buttonStyles("primary")}>
                    Create account
                  </Link>
                  <Link to="/signin" className={cn(buttonStyles("secondary"), "inline-flex")}>
                    Sign in
                  </Link>
                </div>
              </GlassCard>
            ) : null}
          </div>
        </section>

        <section className="grid gap-8 xl:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Hypothesis</h2>
            <GlassCard className="min-h-[320px]">
              {!payload?.hypothesis ? (
                isLoading ? (
                  <div className="grid gap-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : (
                  <EmptyState text="Start a validation run to generate a target user, problem statement, and value proposition." />
                )
              ) : (
                <div className="space-y-6">
                  {[
                    ["Target user", payload.hypothesis.targetUser],
                    ["Problem", payload.hypothesis.problemStatement],
                    ["Value proposition", payload.hypothesis.valueProposition],
                    ["Evidence summary", payload.hypothesis.evidenceSummary],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</p>
                      <p className="leading-7 text-gray-200">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Decision</h2>
            <GlassCard className="min-h-[320px]">
              {!payload?.decision ? (
                <EmptyState text="Decision output appears after the system has enough context to score the idea." />
              ) : (
                <div className="space-y-6">
                  <div className="border-b border-white/10 pb-6">
                    <p className={`text-4xl font-semibold uppercase tracking-[0.24em] ${decisionTone}`}>
                      {payload.decision.displayDecision || payload.decision.decision}
                    </p>
                    <p className="mt-3 leading-7 text-gray-300">{payload.decision.summary}</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Confidence</p>
                      <p className="mt-2 text-lg font-medium text-white">{payload.decision.confidence}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Evidence</p>
                      <p className="mt-2 text-lg font-medium text-white">{payload.decision.evidenceStatus}</p>
                    </div>
                  </div>
                </div>
              )}
            </GlassCard>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">Market intel</h2>
            <span className="status-chip">{payload?.mode?.researchMode || "No run yet"}</span>
          </div>

          {!payload?.research?.length ? (
            <GlassCard>
              <EmptyState text="Research cards appear here once the engine has scanned the market and stored source links." />
            </GlassCard>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {payload.research.map((item, index) => (
                <GlassCard key={`${item.competitor}-${index}`} className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{item.competitor || "Competitor"}</h3>
                      <p className="mt-2 text-sm uppercase tracking-[0.18em] text-accent-purple">
                        {item.pricing || "Pricing unavailable"}
                      </p>
                    </div>
                    {item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/10 p-2 text-gray-300 transition-colors hover:text-white"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                  <p className="flex-grow leading-7 text-gray-300">
                    {item.positioning || item.summary || "Positioning summary unavailable."}
                  </p>
                </GlassCard>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
