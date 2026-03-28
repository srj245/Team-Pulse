import { Link } from "react-router-dom";
import { GlassCard } from "../components/GlassCard";
import { buttonStyles, cn } from "../lib/ui";

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-3xl px-6 py-16">
      <GlassCard className="w-full space-y-6 text-center">
        <p className="section-title">404</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          This page does not exist.
        </h1>
        <p className="section-copy">
          The URL may be wrong, or the page may have moved.
        </p>
        <div className="flex justify-center">
          <Link to="/" className={cn(buttonStyles("primary"), "inline-flex")}>
            Go home
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
