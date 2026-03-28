import { useEffect, useState } from "react";
import { ArrowRight, MailCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { GlassCard } from "../components/GlassCard";
import { signupUser } from "../lib/api";
import { loadApiBaseUrl } from "../lib/runtime";
import { buttonStyles, cn } from "../lib/ui";

export function SignUpPage({ showToast }) {
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState({ type: "info", text: "" });
  const [verificationUrl, setVerificationUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadApiBaseUrl().then(setApiBaseUrl);
  }, []);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: "info", text: "" });
    setVerificationUrl("");

    try {
      const payload = await signupUser(form);
      setMessage({
        type: "success",
        text: payload.message || "Account created. Verify your email before signing in.",
      });
      setVerificationUrl(payload.developmentVerificationUrl || "");
      setForm({ name: "", email: "", password: "" });
      showToast("Account created. Check your email for the verification link.", "success");
    } catch (error) {
      setMessage({ type: "error", text: error.message });
      showToast(error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 lg:grid-cols-[0.95fr_1.05fr]">
      <GlassCard className="space-y-6">
        <p className="section-title">Account setup</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">Create your account once, keep your profile with the same frontend.</h1>
        <p className="section-copy">
          Sign up, verify your email, then use the same React app for dashboard runs and profile
          management.
        </p>

        <div className="grid gap-3">
          {[
            "Email verification before sign in",
            "Secure cookie-backed account access",
            "Same Vercel-ready frontend for auth and dashboard",
          ].map((item) => (
            <div key={item} className="glass-panel rounded-2xl px-4 py-3 text-gray-200">
              {item}
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-title">Sign up</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Start with your email.</h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-gray-400">
            {apiBaseUrl || "Loading API"}
          </div>
        </div>

        {message.text ? (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              message.type === "success"
                ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                : "border border-red-500/20 bg-red-500/10 text-red-100"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-2 text-sm text-gray-300">
            Name
            <input
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              type="text"
              className="field-input"
              placeholder="Ayush"
              maxLength={120}
            />
          </label>

          <label className="grid gap-2 text-sm text-gray-300">
            Email
            <input
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              type="email"
              className="field-input"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="grid gap-2 text-sm text-gray-300">
            Password
            <input
              value={form.password}
              onChange={(event) => setField("password", event.target.value)}
              type="password"
              className="field-input"
              placeholder="At least 10 characters with letters and numbers"
              required
            />
          </label>

          <Button type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? "Creating account" : "Create account"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        {verificationUrl ? (
          <div className="flex flex-wrap gap-3">
            <a
              href={verificationUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonStyles("secondary"), "inline-flex")}
            >
              <MailCheck className="h-4 w-4" />
              Open verification link
            </a>
            <Link to="/signin" className={cn(buttonStyles("ghost"), "inline-flex")}>
              Go to sign in
            </Link>
          </div>
        ) : null}

        <p className="text-sm text-gray-400">
          Already have an account?{" "}
          <Link to="/signin" className="font-semibold text-accent-cyan">
            Sign in
          </Link>
          .
        </p>
      </GlassCard>
    </div>
  );
}
