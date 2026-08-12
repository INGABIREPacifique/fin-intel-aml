import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate("/dashboard");
  };

  return (
    <div className="bg-background text-on-surface min-h-screen flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(51, 65, 85, 0.1) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      ></div>

      <div className="absolute top-4 left-4 sm:top-8 sm:left-8 flex flex-col gap-1 opacity-50 pointer-events-none">
        <span className="font-data-tabular text-data-tabular text-outline uppercase">
          SYS_NODE: US-EAST-1
        </span>
        <span className="font-data-tabular text-data-tabular text-outline text-[10px]">
          AUTH_PROTOCOL_V4.2
        </span>
      </div>

      <main className="w-full max-w-[1024px] bg-surface-container border border-surface-border shadow-2xl relative z-10 flex flex-col lg:flex-row min-h-[600px] rounded">
        <aside className="w-full lg:w-5/12 bg-surface border-b lg:border-b-0 lg:border-r border-surface-border p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-16">
              <div className="w-10 h-10 bg-primary-container border border-surface-border flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-[24px]">
                  shield_locked
                </span>
              </div>
              <div>
                <h1 className="font-headline-md text-headline-md font-bold tracking-tighter text-on-surface">
                  FIN-INTEL <span className="text-secondary">AML</span>
                </h1>
                <p className="font-data-tabular text-data-tabular text-on-surface-variant text-[11px] uppercase tracking-widest mt-1">
                  Institutional Intelligence System
                </p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 bg-primary-container border border-surface-border">
                <span className="material-symbols-outlined text-status-critical text-[20px] mt-0.5">
                  gavel
                </span>
                <div>
                  <h3 className="font-label-caps text-label-caps text-status-critical uppercase mb-1">
                    Restricted Area
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant text-sm">
                    This system is restricted to authorized personnel only. Unauthorized access is a
                    violation of federal law.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-primary-container border border-surface-border">
                <span className="material-symbols-outlined text-status-warning text-[20px] mt-0.5">
                  policy
                </span>
                <div>
                  <h3 className="font-label-caps text-label-caps uppercase mb-1">
                    Federal Monitoring Active
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant text-sm">
                    All activities on this gateway are logged and subject to continuous surveillance
                    and audit.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative z-10 mt-12 lg:mt-0">
            <div className="flex items-center justify-between border-t border-surface-border pt-4">
              <span className="font-data-tabular text-data-tabular text-on-surface-variant text-[10px]">
                SECURE CONNECTION
              </span>
              <span className="flex items-center gap-1 font-data-tabular text-data-tabular text-status-success text-[10px]">
                <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
                ENCRYPTED
              </span>
            </div>
          </div>
        </aside>

        <section className="w-full lg:w-7/12 bg-surface-container p-8 lg:p-16 flex flex-col justify-center">
          <div className="mb-10">
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">
              Staff Authentication
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Verify identity to establish a secure session.
            </p>
          </div>
          <form className="space-y-6 w-full max-w-[420px]" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="block font-label-caps text-label-caps text-on-surface-variant" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-primary-container border border-surface-border text-on-surface font-data-tabular text-data-tabular px-4 py-3 focus:outline-none focus:border-data-focus focus:ring-1 focus:ring-data-focus transition-colors rounded-none placeholder:text-outline-variant"
                placeholder="you@agency.gov"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block font-label-caps text-label-caps text-on-surface-variant" htmlFor="password">
                  Access Key
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-primary-container border border-surface-border text-on-surface font-data-tabular text-data-tabular px-4 py-3 focus:outline-none focus:border-data-focus focus:ring-1 focus:ring-data-focus transition-colors rounded-none placeholder:text-outline-variant pr-12"
                  placeholder="••••••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">visibility</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-error-container border border-status-critical p-3 text-sm text-on-error-container font-body-md">
                {error}
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-status-success hover:bg-secondary text-surface-container-lowest font-label-caps text-label-caps font-bold py-4 px-6 flex items-center justify-center gap-2 transition-colors border border-transparent focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background rounded-none group disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">
                  login
                </span>
                {loading ? "AUTHENTICATING..." : "INITIATE SECURE LOGIN"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
