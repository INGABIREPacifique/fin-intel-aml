import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function Settings() {
  const { profile, session } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  const handleSaveName = async () => {
    setSavingName(true);
    setNameMessage("");
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", session.user.id);
    setSavingName(false);
    setNameMessage(error ? `Error: ${error.message}` : "Saved. Refresh to see it everywhere.");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordMessage("Password must be at least 6 characters.");
      return;
    }
    setSavingPassword(true);
    setPasswordMessage("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    setPasswordMessage(error ? `Error: ${error.message}` : "Password updated.");
    if (!error) setNewPassword("");
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-8 max-w-2xl">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-8">Settings</h1>

          <div className="bg-surface-container border border-surface-border rounded p-6 mb-6">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">Profile</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">
                  Operator ID
                </label>
                <p className="font-data-tabular text-data-tabular text-on-surface">{profile?.operator_id}</p>
              </div>
              <div>
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">
                  Role
                </label>
                <p className="font-data-tabular text-data-tabular text-secondary">
                  {profile?.role?.replace("_", " ").toUpperCase()}
                </p>
              </div>
              <div>
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">
                  Department
                </label>
                <p className="font-data-tabular text-data-tabular text-on-surface">{profile?.department}</p>
              </div>
              <div>
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">
                  Email
                </label>
                <p className="font-data-tabular text-data-tabular text-on-surface">{session?.user?.email}</p>
              </div>
            </div>
            <div>
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">
                Full Name
              </label>
              <div className="flex gap-2">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="flex-1 bg-primary-container border border-surface-border text-on-surface px-3 py-2 rounded text-sm focus:outline-none focus:border-data-focus"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="bg-secondary text-on-secondary px-4 py-2 rounded font-label-caps text-label-caps font-semibold disabled:opacity-60"
                >
                  {savingName ? "Saving..." : "Save"}
                </button>
              </div>
              {nameMessage && <p className="font-data-tabular text-data-tabular text-status-success mt-2">{nameMessage}</p>}
            </div>
          </div>

          <div className="bg-surface-container border border-surface-border rounded p-6">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">Change Password</h2>
            <div className="flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 characters)"
                className="flex-1 bg-primary-container border border-surface-border text-on-surface px-3 py-2 rounded text-sm focus:outline-none focus:border-data-focus"
              />
              <button
                onClick={handleChangePassword}
                disabled={savingPassword}
                className="bg-secondary text-on-secondary px-4 py-2 rounded font-label-caps text-label-caps font-semibold disabled:opacity-60"
              >
                {savingPassword ? "Updating..." : "Update"}
              </button>
            </div>
            {passwordMessage && <p className="font-data-tabular text-data-tabular text-status-success mt-2">{passwordMessage}</p>}
          </div>
        </main>
      </div>
    </div>
  );
}
