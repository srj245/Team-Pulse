import { useEffect, useEffectEvent, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { GlassCard } from "../components/GlassCard";
import { verifyEmail } from "../lib/api";
import { buttonStyles, cn } from "../lib/ui";

export function VerifyEmailPage({ showToast }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState({ type: "info", text: "Verifying your email..." });
  const notify = useEffectEvent((message, type) => {
    showToast(message, type);
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    const storageKey = `validation_engine_verify_email:${token}`;
    if (window.sessionStorage.getItem(storageKey)) {
      return;
    }

    window.sessionStorage.setItem(storageKey, "pending");
    let isMounted = true;

    verifyEmail(token)
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        const text = payload.message || "Email verified.";
        setStatus({ type: "success", text });
        window.sessionStorage.setItem(storageKey, "done");
        notify(text, "success");
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        window.sessionStorage.removeItem(storageKey);
        setStatus({ type: "error", text: error.message });
        notify(error.message, "error");
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const tone =
    status.type === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
      : status.type === "error"
        ? "border-red-500/20 bg-red-500/10 text-red-100"
        : "border-white/10 bg-white/5 text-gray-200";

  return (
    <div className="mx-auto flex max-w-3xl px-6 py-16">
      <GlassCard className="w-full space-y-6">
        <p className="section-title">Email verification</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">Checking your verification link.</h1>

        <div className={`rounded-2xl border px-4 py-4 ${!token ? "border-red-500/20 bg-red-500/10 text-red-100" : tone}`}>
          <div className="flex items-center gap-3">
            {!token ? null : status.type === "success" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : status.type === "info" ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : null}
            <span>{token ? status.text : "Verification token missing from the URL."}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {status.type === "success" ? (
            <Link to="/profile" className={buttonStyles("primary")}>
              Open profile
            </Link>
          ) : null}
          <Link to="/signin" className={cn(buttonStyles("secondary"), "inline-flex")}>
            Go to sign in
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
