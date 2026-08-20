import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const adminNavItems = [
  { to: "/admin/general", label: "General" },
  { to: "/admin/security", label: "Security" },
  { to: "/admin/access", label: "User Access" },
  { to: "/admin/integrations", label: "Integrations" },
  { to: "/admin/api-keys", label: "API Keys" },
];

export default function AdminSidebar() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside className="w-[240px] bg-gradient-to-b from-[#1e3a8a] to-[#0f172a] py-4 flex flex-col justify-between min-h-screen shrink-0">
      <div>
        <div className="flex flex-col items-center px-6 pb-8">
          <div className="w-16 h-16 rounded-full border border-white/20 bg-white/10 flex items-center justify-center mb-2">
            <span className="material-symbols-outlined text-white text-[28px]">admin_panel_settings</span>
          </div>
          <h2 className="font-headline-sm text-headline-sm text-white">Admin Console</h2>
          <p className="font-label-caps text-label-caps text-white/60 text-center mt-1">
            REGULATORY CONTROL
          </p>
        </div>
        <nav className="px-4 space-y-1">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 rounded font-label-caps text-label-caps transition-colors ${
                  isActive
                    ? "bg-white/15 border-r-2 border-white text-white font-bold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/15 pt-4 px-4">
        <button
          onClick={() => navigate("/dashboard")}
          className="w-full flex items-center gap-2 px-4 py-3 text-white/60 hover:text-white rounded font-label-caps text-label-caps mb-1"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to App
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-3 text-white/60 hover:text-red-300 rounded font-label-caps text-label-caps"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
