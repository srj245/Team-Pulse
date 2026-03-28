import { motion as Motion } from "framer-motion";
import { buttonStyles, cn } from "../lib/ui";

export function Button({ children, variant = "primary", className, disabled = false, ...props }) {
  return (
    <Motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={cn(buttonStyles(variant), className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </Motion.button>
  );
}
