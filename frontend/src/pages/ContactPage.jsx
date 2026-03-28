import { useState } from "react";
import { Button } from "../components/Button";
import { GlassCard } from "../components/GlassCard";
import { sendContactMessage } from "../lib/api";

export function ContactPage({ showToast }) {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSubmittedMessage("");
    setIsSubmitting(true);

    try {
      const payload = await sendContactMessage(form);
      setSubmittedMessage(payload.message || "Message received. We will get back to you soon.");
      setForm({ name: "", email: "", message: "" });
      showToast(payload.message || "Message received.", "success");
    } catch (error) {
      setErrorMessage(error.message || "Failed to send message.");
      showToast(error.message || "Failed to send message.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr]">
      <GlassCard className="space-y-6">
        <p className="section-title">Contact</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">Questions, pilots, or partnership requests.</h1>
        <p className="section-copy">
          Send a message directly from the app. Delivery is handled through the backend contact
          endpoint.
        </p>
      </GlassCard>

      <GlassCard className="space-y-6">
        <div>
          <p className="section-title">Contact form</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Send a message</h2>
        </div>

        {submittedMessage ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {submittedMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-2 text-sm text-gray-300">
            Name
            <input
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              className="field-input"
              required
            />
          </label>
          <label className="grid gap-2 text-sm text-gray-300">
            Email
            <input
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              type="email"
              className="field-input"
              required
            />
          </label>
          <label className="grid gap-2 text-sm text-gray-300">
            Message
            <textarea
              value={form.message}
              onChange={(event) => setField("message", event.target.value)}
              className="field-input min-h-[180px] resize-y"
              required
            />
          </label>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send message"}
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
