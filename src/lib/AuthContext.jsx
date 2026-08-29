import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = no session
  const [profile, setProfile] = useState(null); // includes role
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(null);
  const [idleWarning, setIdleWarning] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadProfile = async () => {
    if (!session?.user?.id) {
      setProfile(null);
      setProfileError("");
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    setProfileError("");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    setProfileLoading(false);
    if (error) {
      setProfileError(error.message);
      return;
    }
    setProfile(data);
  };

  useEffect(() => {
    loadProfile();
  }, [session]);

  // Real session-governance enforcement: read the live auto_logout_minutes
  // value from system_settings (the same value Security Config saves) and
  // sign the user out after that many minutes of no keyboard/mouse/touch
  // activity. Re-fetched on every login so a policy change applies to new
  // sessions without a redeploy.
  useEffect(() => {
    if (!session?.user?.id) {
      setAutoLogoutMinutes(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("system_settings")
      .select("value")
      .eq("key", "auto_logout_minutes")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setAutoLogoutMinutes(data ? Number(data.value) : null);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session?.user?.id || !autoLogoutMinutes || autoLogoutMinutes <= 0) return;

    let idleTimer;
    let warningTimer;
    const warningLeadMs = Math.min(60_000, autoLogoutMinutes * 60_000 * 0.2); // warn in the last 20% of the window, capped at 60s

    const resetTimers = () => {
      setIdleWarning(false);
      clearTimeout(idleTimer);
      clearTimeout(warningTimer);
      warningTimer = setTimeout(() => setIdleWarning(true), autoLogoutMinutes * 60_000 - warningLeadMs);
      idleTimer = setTimeout(async () => {
        await supabase.from("audit_logs").insert({
          actor_id: session.user.id,
          action: "session_auto_logout",
          target_type: "session",
          details: { note: `Idle for ${autoLogoutMinutes} minutes` },
        });
        supabase.auth.signOut();
      }, autoLogoutMinutes * 60_000);
    };

    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetTimers));
    resetTimers();

    return () => {
      clearTimeout(idleTimer);
      clearTimeout(warningTimer);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetTimers));
    };
  }, [session, autoLogoutMinutes]);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signOut = () => supabase.auth.signOut();

  const resetPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

  const updatePassword = (newPassword) =>
    supabase.auth.updateUser({ password: newPassword });

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        profileError,
        profileLoading,
        retryProfile: loadProfile,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        idleWarning,
        autoLogoutMinutes,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
