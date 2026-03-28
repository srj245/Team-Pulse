import { useEffect, useEffectEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { GlassCard } from "../components/GlassCard";
import { completeOnboarding, getProfile, logoutUser, updateProfile } from "../lib/api";
import { buttonStyles, cn } from "../lib/ui";

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export function ProfilePage({ showToast }) {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const notifyFromEffect = useEffectEvent((text, type) => {
    showToast(text, type);
  });

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const profilePayload = await getProfile();
        if (!isMounted) {
          return;
        }

        setPayload(profilePayload);
        setName(profilePayload.user.name || "");
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          notifyFromEffect("Sign in first to access your profile.", "error");
          navigate("/signin", { replace: true });
          return;
        }

        setMessage(error.message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    try {
      const updatedPayload = await updateProfile({ name });
      setPayload(updatedPayload);
      setName(updatedPayload.user.name || "");
      setMessage("Profile updated.");
      showToast("Profile updated.", "success");
    } catch (error) {
      setMessage(error.message);
      showToast(error.message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCompleteOnboarding() {
    setIsCompleting(true);

    try {
      const updatedPayload = await completeOnboarding();
      setPayload(updatedPayload);
      showToast("Onboarding marked complete.", "success");
    } catch (error) {
      setMessage(error.message);
      showToast(error.message, "error");
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleLogout() {
    await logoutUser();
    navigate("/signin");
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16">
        <GlassCard className="text-gray-300">Loading profile...</GlassCard>
      </div>
    );
  }

  const user = payload?.user;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
      <GlassCard className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-title">User profile</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">Account details</h1>
          </div>
          <div className="flex gap-3">
            <Link to="/dashboard" className={cn(buttonStyles("secondary"), "inline-flex")}>
              Dashboard
            </Link>
            <Button type="button" variant="ghost" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </div>

        {message ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
            {message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-2 text-sm text-gray-300">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              type="text"
              className="field-input"
              placeholder="Your name"
              maxLength={120}
            />
          </label>

          <label className="grid gap-2 text-sm text-gray-300">
            Email
            <input value={user?.email || ""} type="email" className="field-input opacity-70" disabled />
          </label>

          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </GlassCard>

      <GlassCard className="space-y-5">
        <p className="section-title">Status</p>
        <div className="grid gap-3">
          <div className="glass-panel rounded-2xl px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Email verified</p>
            <p className="mt-2 text-lg font-medium text-white">
              {user?.emailVerified ? "Verified" : "Pending"}
            </p>
          </div>
          <div className="glass-panel rounded-2xl px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Plan</p>
            <p className="mt-2 text-lg font-medium text-white">{user?.plan || "free"}</p>
          </div>
          <div className="glass-panel rounded-2xl px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Billing</p>
            <p className="mt-2 text-lg font-medium text-white">{user?.billingStatus || "inactive"}</p>
          </div>
          <div className="glass-panel rounded-2xl px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Created</p>
            <p className="mt-2 text-lg font-medium text-white">{formatDateTime(user?.createdAt)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Onboarding</p>
          <p className="mt-3 text-gray-300">
            {user?.onboardingCompleted
              ? "Onboarding already completed."
              : "Mark onboarding complete when this account is ready for regular use."}
          </p>
          {!user?.onboardingCompleted ? (
            <Button
              type="button"
              onClick={handleCompleteOnboarding}
              disabled={isCompleting}
              className="mt-4"
            >
              {isCompleting ? "Saving..." : "Complete onboarding"}
            </Button>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}
