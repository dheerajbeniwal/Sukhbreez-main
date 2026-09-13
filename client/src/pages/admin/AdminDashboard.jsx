import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import api from "../../services/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  PageHeader,
  StatusPill,
} from "../../components/Shared";

const useAdminData = (load, dependencies = []) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = () => {
    setLoading(true);
    setError(null);
    load().then(setData).catch(setError).finally(() => setLoading(false));
  };
  useEffect(reload, dependencies);
  return { data, error, loading, reload };
};

const responseData = (promise) => promise.then(({ data }) => data.data);
export default function AdminDashboard() {
  return (
    <Routes>
      <Route index element={<AdminOverview />} />
      <Route path="categories" element={<Categories />} />
      <Route path="providers" element={<Providers />} />
      <Route path="bookings" element={<Bookings />} />
      <Route path="payments" element={<Payments />} />
      <Route path="reviews" element={<Reviews />} />
    </Routes>
  );
}

function AdminOverview() {
  return (
    <>
      <PageHeader eyebrow="Admin space" title="Platform overview" />
      <div className="dashboard-grid">
        {[
          ["categories", "Categories", "Manage the service catalogue."],
          ["providers", "Providers", "Review applications and account status."],
          ["bookings", "Bookings", "Monitor and reassign service requests."],
          ["payments", "Payments", "Verify cash and record settlements."],
          ["reviews", "Reviews", "Moderate customer feedback."],
        ].map(([path, title, text]) => (
          <Link className="profile-panel" key={path} to={`/admin/${path}`}>
            <strong>{title}</strong><span>{text}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

function AdminHeader({ eyebrow, title, children }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title}>{children}</PageHeader>
      <nav className="filter-row admin-tabs">
        {[
          ["categories", "Categories"],
          ["providers", "Providers"],
          ["bookings", "Bookings"],
          ["payments", "Payments"],
          ["reviews", "Reviews"],
        ].map(([path, label]) => <NavLink className={({ isActive }) => isActive ? "filter active" : "filter"} key={path} to={`/admin/${path}`}>{label}</NavLink>)}
      </nav>
    </>
  );
}

function AdminState({ loading, error, data, retry, children, empty = false }) {
  if (loading) return <LoadingState label="Loading admin data" />;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (empty) return <EmptyState title="Nothing here yet" text="No records match this view." />;
  return children(data);
}

function Categories() {
  const { data, error, loading, reload } = useAdminData(() => responseData(api.get("/categories/admin")));
  const [form, setForm] = useState({ name: "", description: "" });
  const [editing, setEditing] = useState(null);
  const [actionError, setActionError] = useState(null);
  const save = async (event) => {
    event.preventDefault();
    setActionError(null);
    try {
      if (editing) await api.patch(`/categories/${editing.id}`, form);
      else await api.post("/categories", form);
      setForm({ name: "", description: "" }); setEditing(null); reload();
    } catch (error) { setActionError(error); }
  };
  const toggle = async (category) => {
    try { await api.patch(`/categories/${category.id}/status`, { isActive: !category.isActive }); reload(); }
    catch (error) { setActionError(error); }
  };
  return <><AdminHeader eyebrow="Admin / Catalogue" title="Categories" /><form className="profile-panel form-stack" onSubmit={save}><h2>{editing ? "Edit category" : "Create category"}</h2><input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />{actionError && <ErrorState error={actionError} />}<div><button className="button">{editing ? "Save changes" : "Create category"}</button>{editing && <button type="button" className="button button-light" onClick={() => { setEditing(null); setForm({ name: "", description: "" }); }}>Cancel</button>}</div></form><AdminState loading={loading} error={error} data={data} retry={reload} empty={!data?.categories?.length}>{({ categories }) => <div className="work-list">{categories.map((category) => <article className="work-card" key={category.id}><div><h3>{category.name}</h3><p>{category.description || "No description"}</p></div><div className="work-card-action"><StatusPill value={category.isActive ? "active" : "inactive"} /><button className="button button-light button-small" onClick={() => { setEditing(category); setForm({ name: category.name, description: category.description || "" }); }}>Edit</button><button className="button button-small" onClick={() => toggle(category)}>{category.isActive ? "Deactivate" : "Activate"}</button></div></article>)}</div>}</AdminState></>;
}

function Providers() {
  const { data, error, loading, reload } = useAdminData(() => responseData(api.get("/providers/admin?page=1&limit=50")));
  const [actionError, setActionError] = useState(null);
  const [charges, setCharges] = useState({});
  const update = async (id, path, body) => { setActionError(null); try { await api.patch(`/providers/admin/${id}/${path}`, body); reload(); } catch (nextError) { setActionError(nextError); } };
  const saveCharge = async (provider) => {
    const value = Number(charges[provider.id] ?? provider.startingCharge);
    await update(provider.id, "starting-charge", { startingCharge: value });
  };
  return <><AdminHeader eyebrow="Admin / Moderation" title="Providers" />{actionError && <ErrorState error={actionError} />}<AdminState loading={loading} error={error} data={data} retry={reload} empty={!data?.providers?.length}>{({ providers }) => <div className="work-list">{providers.map((provider) => <article className="work-card" key={provider.id}><div><span className="card-kicker">{provider.categories?.map((c) => c.name).join(", ")}</span><h3>{provider.fullName}</h3><p><Money value={provider.startingCharge} /> · {provider.experience} years</p><label className="field"><span>Starting charge</span><input type="number" min="0.01" step="0.01" value={charges[provider.id] ?? provider.startingCharge ?? ""} onChange={(event) => setCharges({ ...charges, [provider.id]: event.target.value })} /></label><button className="button button-small" onClick={() => saveCharge(provider)}>Save charge</button></div><div className="work-card-action"><StatusPill value={provider.approvalStatus} /><StatusPill value={provider.accountStatus} /><button className="button button-small" disabled={provider.approvalStatus === "approved"} onClick={() => update(provider.id, "approval", { approvalStatus: "approved" })}>Approve</button><button className="button button-light button-small" disabled={provider.approvalStatus === "rejected"} onClick={() => update(provider.id, "approval", { approvalStatus: "rejected" })}>Reject</button><button className="button button-light button-small" onClick={() => update(provider.id, "status", { accountStatus: provider.accountStatus === "active" ? "blocked" : "active" })}>{provider.accountStatus === "active" ? "Deactivate" : "Activate"}</button></div></article>)}</div>}</AdminState></>;
}

function Bookings() {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useAdminData(() => responseData(api.get(`/bookings/admin?page=1&limit=50${status ? `&status=${status}` : ""}`)), [status]);
  const [providers, setProviders] = useState([]);
  const [actionError, setActionError] = useState(null);
  useEffect(() => { responseData(api.get("/providers/admin?page=1&limit=50")).then((result) => setProviders(result.providers || [])).catch(setActionError); }, []);
  const reassign = async (bookingId, providerId) => { try { await api.patch(`/bookings/admin/${bookingId}/reassign-provider`, { providerId }); reload(); } catch (nextError) { setActionError(nextError); } };
  return <><AdminHeader eyebrow="Admin / Operations" title="Bookings"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["pending", "accepted", "in_progress", "completed", "cancelled", "rejected"].map((value) => <option key={value}>{value}</option>)}</select></AdminHeader>{actionError && <ErrorState error={actionError} />}<AdminState loading={loading} error={error} data={data} retry={reload} empty={!data?.bookings?.length}>{({ bookings }) => <div className="work-list">{bookings.map((booking) => <article className="work-card" key={booking.id}><div><span className="card-kicker">{booking.bookingId}</span><h3>{booking.customer?.fullName} → {booking.provider?.fullName || "Unassigned"}</h3><p>{booking.category?.name} · <Money value={booking.amount} /></p></div><div className="work-card-action"><StatusPill value={booking.status} /><select defaultValue="" onChange={(e) => e.target.value && reassign(booking.id, e.target.value)}><option value="">Reassign provider</option>{providers.filter((p) => p.id !== booking.provider?.id).map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div></article>)}</div>}</AdminState></>;
}

function Payments() {
  const { data, error, loading, reload } = useAdminData(() => Promise.all([responseData(api.get("/payments/admin?page=1&limit=50")), responseData(api.get("/payments/admin/commission"))]).then(([payments, commission]) => ({ ...payments, commissionPercentage: commission.commissionPercentage })));
  const [commission, setCommission] = useState("");
  const [actionError, setActionError] = useState(null);
  useEffect(() => { if (data) setCommission(String(data.commissionPercentage)); }, [data]);
  const saveCommission = async (event) => { event.preventDefault(); try { await api.patch("/payments/admin/commission", { commissionPercentage: Number(commission) }); reload(); } catch (nextError) { setActionError(nextError); } };
  const verify = async (id) => { try { await api.patch(`/payments/admin/${id}/verify`); reload(); } catch (nextError) { setActionError(nextError); } };
  const settle = async (id) => { const reference = window.prompt("Settlement reference"); if (!reference?.trim()) return; try { await api.patch(`/payments/admin/${id}/settle`, { settlementReference: reference.trim() }); reload(); } catch (nextError) { setActionError(nextError); } };
  return <><AdminHeader eyebrow="Admin / Finance" title="Payments" /><form className="profile-panel" onSubmit={saveCommission}><label className="field"><span>Commission percentage</span><input type="number" min="0" max="100" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} /></label><button className="button">Save commission</button></form>{actionError && <ErrorState error={actionError} />}<AdminState loading={loading} error={error} data={data} retry={reload} empty={!data?.payments?.length}>{({ payments }) => <div className="work-list">{payments.map((payment) => <article className="work-card" key={payment.id}><div><span className="card-kicker">{payment.paymentMethod}</span><h3><Money value={payment.amount} /></h3><p>{payment.paymentStatus} · {payment.settlementStatus}</p></div><div className="work-card-action">{payment.paymentMethod === "cash" && payment.paymentStatus === "pending" && <button className="button button-small" onClick={() => verify(payment.id)}>Verify cash</button>}{payment.paymentStatus === "verified" && payment.settlementStatus === "pending" && <button className="button button-light button-small" onClick={() => settle(payment.id)}>Settle</button>}</div></article>)}</div>}</AdminState></>;
}

function Reviews() {
  const { data, error, loading, reload } = useAdminData(() => responseData(api.get("/reviews/admin?page=1&limit=50")));
  const [actionError, setActionError] = useState(null);
  const remove = async (id) => { if (!window.confirm("Delete this review?")) return; try { await api.delete(`/reviews/admin/${id}`); reload(); } catch (nextError) { setActionError(nextError); } };
  return <><AdminHeader eyebrow="Admin / Moderation" title="Reviews" />{actionError && <ErrorState error={actionError} />}<AdminState loading={loading} error={error} data={data} retry={reload} empty={!data?.reviews?.length}>{({ reviews }) => <div className="work-list">{reviews.map((review) => <article className="work-card" key={review.id}><div><h3>{review.rating} / 5</h3><p>{review.comment || "No comment provided."}</p></div><button className="button button-light button-small" onClick={() => remove(review.id)}>Delete</button></article>)}</div>}</AdminState></>;
}
