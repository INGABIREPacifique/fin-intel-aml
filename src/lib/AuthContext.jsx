import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

// Persisted per-browser-profile (shared across tabs, same as Supabase's own
// session storage), so multiple tabs of the same browser count as ONE
// session — matching what "concurrent session" means to a real user.
function getClientSessionId() {
  let id = localStorage.getItem("fin_intel_client_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("fin_intel_client_session_id", id);
  }
  return id;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = no session
  const [profile, setProfile] = useState(null); // includes role
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(null);
  const [idleWarning, setIdleWarning] = useState(false);
  const [sessionRevoked, setSessionRevoked] = useState(false);

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

  // Real concurrent-session-limit enforcement (no service_role / admin API
  // needed, so this is safely client-side and RLS-scoped to each user's own
  // rows). On login this device registers itself, trims its own older
  // sessions down to the configured limit, then polls to confirm its own
  // row still exists — if a later login elsewhere trims this device away,
  // it signs itself out within one poll interval.
  useEffect(() => {
    if (!session?.user?.id) {
      setSessionRevoked(false);
      return;
    }

    let cancelled = false;
    let pollInterval;
    const userId = session.user.id;
    const clientSessionId = getClientSessionId();

    async function registerAndTrim() {
      const { error: upsertErr } = await supabase
        .from("active_sessions")
        .upsert(
          { user_id: userId, client_session_id: clientSessionId, last_seen_at: new Date().toISOString() },
          { onConflict: "user_id,client_session_id" }
        );
      if (upsertErr || cancelled) return;

      const { data: limitRow } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "concurrent_session_limit")
        .maybeSingle();
      const limit = limitRow ? Number(limitRow.value) : null;
      if (!limit || limit <= 0 || cancelled) return;

      const { data: sessions } = await supabase
        .from("active_sessions")
        .select("id, client_session_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (!sessions || cancelled) return;

      // Keep the newest `limit` sessions (this device, being freshly
      // upserted, is always among the newest); delete the rest.
      const toRemove = sessions.slice(limit);
      if (toRemove.length > 0) {
        await supabase.from("active_sessions").delete().in("id", toRemove.map((s) => s.id));
        await supabase.from("audit_logs").insert({
          actor_id: userId,
          action: "concurrent_session_limit_enforced",
          target_type: "session",
          details: { note: `Limit ${limit}, removed ${toRemove.length} older session(s)` },
        });
      }
    }

    async function checkStillActive() {
      const { data, error } = await supabase
        .from("active_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("client_session_id", clientSessionId)
        .maybeSingle();
      if (cancelled || error) return; // don't act on a transient network error
      if (!data) {
        setSessionRevoked(true);
        clearInterval(pollInterval);
        localStorage.removeItem("fin_intel_client_session_id");
        await supabase.auth.signOut();
      }
    }

    registerAndTrim();
    pollInterval = setInterval(checkStillActive, 30_000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [session]);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signOut = async () => {
    const result = await supabase.auth.signOut();
    localStorage.removeItem("fin_intel_client_session_id");
    return result;
  };

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
        sessionRevoked,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
