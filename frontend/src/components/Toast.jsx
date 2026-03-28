// We can use a simple custom toast or a library like react-hot-toast.
// For now, a simple context or static component works.
import { AnimatePresence } from "framer-motion";
import { motion as Motion } from "framer-motion";
import { CheckCircle, Info, XCircle } from "lucide-react";

export function Toast({ message, type = 'info', isVisible, onClose }) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-accent-cyan" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-accent-purple" />
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <Motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          role={type === "error" ? "alert" : "status"}
          aria-live={type === "error" ? "assertive" : "polite"}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-6 py-4 glass-panel rounded-2xl shadow-2xl border-white/10"
        >
          {icons[type]}
          <span className="text-sm font-medium text-white">{message}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notification"
            className="ml-4 text-gray-400 hover:text-white transition-colors"
          >
            &times;
          </button>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}
