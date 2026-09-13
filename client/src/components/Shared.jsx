import { useState } from "react";
import { Link } from "react-router-dom";

export function LoadingState({ label = "Loading" }) {
  return <div className="state-panel"><span className="spinner" />{label}</div>;
}

export function EmptyState({ title, text, action }) {
  return <div className="state-panel"><strong>{title}</strong><span>{text}</span>{action}</div>;
}

export function ErrorState({ error, onRetry }) {
  const message = error?.response?.data?.message || error?.message || "Something went wrong.";
  const fieldErrors = Object.entries(error?.response?.data?.errors || {});
  return <div className="state-panel state-error"><strong>{message}</strong>{fieldErrors.length > 0 && <ul className="error-list">{fieldErrors.map(([field, detail]) => <li key={field}><strong>{field}:</strong> {detail}</li>)}</ul>}{onRetry && <button className="button button-light" onClick={onRetry}>Try again</button>}</div>;
}

export function Notice({ children, tone = "info" }) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}

export function PageHeader({ eyebrow, title, children }) {
  return <header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div>{children}</header>;
}

export function StatusPill({ value }) {
  return <span className={`status-pill status-${String(value).replaceAll("_", "-")}`}>{String(value).replaceAll("_", " ")}</span>;
}

export function Money({ value }) {
  return <span>INR {Number(value || 0).toLocaleString("en-IN")}</span>;
}

export function PasswordField({ label, value, onChange, required = true, minLength }) {
  const [visible, setVisible] = useState(false);
  return <label className="field"><span>{label}</span><span className="password-control"><input required={required} minLength={minLength} type={visible ? "text" : "password"} value={value} onChange={onChange} /><button type="button" className="password-toggle" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={() => setVisible((current) => !current)}>{visible ? "◉" : "◌"}</button></span></label>;
}

export function ProviderCard({ provider }) {
  return <article className="provider-card">
    <div className="avatar">{provider.fullName?.slice(0, 1) || "P"}</div>
    <div className="provider-card-main"><div className="card-kicker">{provider.category?.name || "Home service"}</div><h3>{provider.fullName}</h3><p>{provider.experience || 0} years experience</p></div>
    <div className="provider-price"><strong><Money value={provider.startingCharge} /></strong><span>{Number(provider.ratingAverage || 0).toFixed(1)} rating</span><Link className="text-link" to={`/providers/${provider.id}`}>View profile</Link></div>
  </article>;
}
