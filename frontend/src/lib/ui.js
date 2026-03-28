import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function buttonStyles(variant = "primary") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60";
  const variants = {
    primary:
      "bg-gradient-to-r from-accent-purple to-accent-cyan text-white shadow-[0_0_20px_rgba(124,58,237,0.38)] hover:shadow-[0_0_32px_rgba(6,182,212,0.45)]",
    secondary:
      "bg-white/5 border border-white/10 text-white backdrop-blur-md hover:bg-white/10 hover:border-white/20",
    ghost:
      "bg-transparent border border-transparent text-gray-200 hover:text-white hover:bg-white/6",
    danger:
      "bg-red-500/12 border border-red-500/20 text-red-100 hover:bg-red-500/18 hover:border-red-500/30",
  };

  return cn(base, variants[variant] || variants.primary);
}
