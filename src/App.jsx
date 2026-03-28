import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { Toast } from "./components/Toast";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { SignUpPage } from "./pages/SignUpPage";
import { SignInPage } from "./pages/SignInPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ContactPage } from "./pages/ContactPage";
import { ContentPage } from "./pages/ContentPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { contentPages } from "./content/pages";

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.hash, location.pathname]);

  return null;
}

function RouteAliases({ element, paths }) {
  return paths.map((path) => <Route key={path} path={path} element={element} />);
}

export default function App() {
  const [toast, setToast] = useState({
    isVisible: false,
    message: "",
    type: "info",
  });

  const showToast = (message, type = "info") => {
    setToast({
      isVisible: true,
      message,
      type,
    });
  };

  useEffect(() => {
    if (!toast.isVisible) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setToast((current) => ({ ...current, isVisible: false }));
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [toast.isVisible]);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="fixed top-[-20%] left-[-10%] w-[45rem] h-[45rem] rounded-full bg-accent-purple/12 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-18%] right-[-12%] w-[42rem] h-[42rem] rounded-full bg-accent-cyan/10 blur-[120px] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_36%)] pointer-events-none" />

      <ScrollToTop />
      <Navbar />

      <main className="pt-20 flex-grow relative z-10">
        <Routes>
          {RouteAliases({
            paths: ["/", "/index.html"],
            element: <Landing />,
          })}
          {RouteAliases({
            paths: ["/dashboard", "/dashboard.html"],
            element: <Dashboard showToast={showToast} />,
          })}
          {RouteAliases({
            paths: ["/signup", "/signup.html"],
            element: <SignUpPage showToast={showToast} />,
          })}
          {RouteAliases({
            paths: ["/signin", "/signin.html"],
            element: <SignInPage showToast={showToast} />,
          })}
          {RouteAliases({
            paths: ["/verify-email", "/verify-email.html"],
            element: <VerifyEmailPage showToast={showToast} />,
          })}
          {RouteAliases({
            paths: ["/profile", "/profile.html"],
            element: <ProfilePage showToast={showToast} />,
          })}
          {RouteAliases({
            paths: ["/about", "/about.html"],
            element: <ContentPage page={contentPages.about} />,
          })}
          {RouteAliases({
            paths: ["/privacy", "/privacy.html"],
            element: <ContentPage page={contentPages.privacy} />,
          })}
          {RouteAliases({
            paths: ["/terms", "/terms.html"],
            element: <ContentPage page={contentPages.terms} />,
          })}
          {RouteAliases({
            paths: ["/contact", "/contact.html"],
            element: <ContactPage showToast={showToast} />,
          })}
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />

      <Toast
        {...toast}
        onClose={() => setToast((current) => ({ ...current, isVisible: false }))}
      />
    </div>
  );
}
