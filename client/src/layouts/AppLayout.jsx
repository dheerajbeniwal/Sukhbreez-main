import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../context/authContext";

const links = {
  customer: [["/dashboard", "Discover"], ["/bookings", "Bookings"], ["/notifications", "Notifications"]],
  provider: [["/provider", "Workboard"], ["/provider/profile", "Profile"]],
  admin: [["/admin", "Overview"]],
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const roleLinks = links[user?.role] || [];
  return <div className="app-shell">
    <header className="topbar"><Link className="brand" to="/">Sukh Breeze<span>.</span></Link><div className="topbar-user"><span>{user?.fullName}</span><button className="button button-quiet" onClick={logout}>Sign out</button></div></header>
    <div className="app-frame"><aside className="sidebar"><div className="sidebar-label">{user?.role} space</div><nav>{roleLinks.map(([to, label]) => <NavLink key={to} to={to} end={to === "/dashboard" || to === "/provider" || to === "/admin"}>{label}</NavLink>)}</nav><div className="sidebar-foot">Local care, made clear.</div></aside><main className="content"><Outlet /></main></div>
  </div>;
}
