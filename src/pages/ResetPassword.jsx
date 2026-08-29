import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    const { error: updateErr } = await updatePassword(password);
    setSaving(false);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setMessage("Password updated. Redirecting to login...");
    setTimeout(() => navigate("/login"), 1800);
  };

  return (
    <div className="bg-background text-on-surface min-h-screen flex items-center justify-center p-4 sm:p-8">
      <main className="w-full max-w-[420px] bg-surface-container border border-surface-border shadow-2xl p-8 lg:p-12 rounded">
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">Set New Password</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-8">
          Choose a new password for your account.
        </p>

        {message ? (
          <div className="bg-primary-container border border-status-success p-3 text-sm text-on-surface font-body-md">
            {message}
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="block font-label-caps text-label-caps text-on-surface-variant" htmlFor="new-password">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-primary-container border border-surface-border text-on-surface font-data-tabular text-data-tabular px-4 py-3 focus:outline-none focus:border-data-focus focus:ring-1 focus:ring-data-focus rounded-none"
                placeholder="••••••••••••••••"
              />
            </div>
            <div className="space-y-2">
              <label className="block font-label-caps text-label-caps text-on-surface-variant" htmlFor="confirm-password">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-primary-container border border-surface-border text-on-surface font-data-tabular text-data-tabular px-4 py-3 focus:outline-none focus:border-data-focus focus:ring-1 focus:ring-data-focus rounded-none"
                placeholder="••••••••••••••••"
              />
            </div>

            {error && (
              <div className="bg-error-container border border-status-critical p-3 text-sm text-on-error-container font-body-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-status-success hover:bg-secondary text-surface-container-lowest font-label-caps text-label-caps font-bold py-4 px-6 transition-colors rounded-none disabled:opacity-60"
            >
              {saving ? "SAVING..." : "UPDATE PASSWORD"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
