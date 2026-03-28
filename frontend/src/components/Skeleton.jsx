import { motion as Motion } from "framer-motion";

export function Skeleton({ className }) {
  return (
    <Motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
      className={`bg-slate-800/50 rounded-lg ${className}`}
    />
  );
}
