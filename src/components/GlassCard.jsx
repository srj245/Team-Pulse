import { cn } from "../lib/ui";

export function GlassCard({ children, className, hoverable = false }) {
  return (
    <div
      className={cn(
        "glass-card p-8",
        hoverable && "transition-transform duration-300 hover:-translate-y-1",
        className,
      )}
    >
      {children}
    </div>
  );
}
