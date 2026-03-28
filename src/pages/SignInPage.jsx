import { useEffect, useState } from "react";
import { ArrowRight, MailCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { GlassCard } from "../components/GlassCard";
import { resendVerificationEmail, signInUser } from "../lib/api";
import { loadApiBaseUrl } from "../lib/runtime";
import { buttonStyles, cn } from "../lib/ui";

export function SignInPage({ showToast }) {
  const navigate = useNavigate();
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState({ type: "info", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    loadApiBaseUrl().then(setApiBaseUrl);
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: "info", text: "" });

    try {
      await signInUser({ email, password });
      showToast("Signed in.", "success");
      navigate("/profile");
    } catch (error) {
      setMessage({ type: "error", text: error.message });
      showToast(error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendVerification() {
    setIsResending(true);
    setMessage({ type: "info", text: "" });

    try {
      const payload = await resendVerificationEmail(email);
      const suffix = payload.developmentVerificationUrl
        ? ` Open: ${payload.developmentVerificationUrl}`
        : "";
      const text = `${payload.message || "Verification email sent."}${suffix}`;
      setMessage({ type: "success", text });
      showToast(payload.message || "Verification email sent.", "success");
    } catch (error) {
      setMessage({ type: "error", text: error.message });
      showToast(error.message, "error");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr]">
      <GlassCard className="space-y-6">
        <p className="section-title">Sign in</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">Access your dashboard, profile, and account state.</h1>
        <p className="section-copy">
          Sign in after verifying your email. If the inbox link is missing, resend it from this
          screen.
        </p>

        <div className="glass-panel rounded-3xl p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Resolved API</p>
          <p className="mt-3 break-all text-sm text-white">{apiBaseUrl || "Loading API base..."}</p>
        </div>
      </GlassCard>

      <GlassCard className="space-y-6">
        <div>
          <p className="section-title">Account access</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Sign in to continue.</h2>
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
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="field-input"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="grid gap-2 text-sm text-gray-300">
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="field-input"
              placeholder="Your password"
              required
            />
          </label>

          <Button type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? "Signing in" : "Sign in"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={isResending || !email.trim()}
            onClick={handleResendVerification}
          >
            <MailCheck className="h-4 w-4" />
            {isResending ? "Sending..." : "Resend verification"}
          </Button>
          <Link to="/signup" className={cn(buttonStyles("ghost"), "inline-flex")}>
            Create account
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
