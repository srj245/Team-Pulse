import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-black/20 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-10 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <h3 className="text-white text-lg font-semibold">ValidationEngine</h3>
          <p className="text-gray-400 max-w-md">
            From raw startup idea to grounded proof, live landing page, and a blunt market
            decision.
          </p>
        </div>

        <div>
          <h4 className="text-sm uppercase tracking-[0.18em] text-gray-500 mb-3">Company</h4>
          <div className="grid gap-2 text-gray-300 text-sm">
            <Link to="/about" className="hover:text-white">
              About
            </Link>
            <Link to="/contact" className="hover:text-white">
              Contact
            </Link>
          </div>
        </div>

        <div>
          <h4 className="text-sm uppercase tracking-[0.18em] text-gray-500 mb-3">Legal</h4>
          <div className="grid gap-2 text-gray-300 text-sm">
            <Link to="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
