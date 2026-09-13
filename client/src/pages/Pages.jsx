import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/authContext";
import { EmptyState, ErrorState, LoadingState, Money, Notice, PageHeader, PasswordField, ProviderCard, StatusPill } from "../components/Shared";

const unwrap = (promise, setData, setError, setLoading) => {
  setLoading(true); setError(null);
  promise.then(({ data }) => setData(data.data)).catch(setError).finally(() => setLoading(false));
};

export function HomePage() {
  const { user } = useAuth();
  return <section className="landing"><div className="landing-copy"><span className="eyebrow">Sukh Breeze / Local services</span><h1>Good help, close to home.</h1><p>Find trusted local providers, book with a clear server-set price, and keep every update in one calm place.</p><div className="landing-actions">{user ? <Link className="button" to={user.role === "customer" ? "/dashboard" : "/provider"}>Open your workspace</Link> : <><Link className="button" to="/login">Sign in</Link><Link className="button button-light" to="/register">Create account</Link></>}</div></div><div className="landing-note"><span>01</span><strong>Price clarity</strong><p>The amount shown after booking comes from the provider profile on the server.</p></div></section>;
}

const mobilePattern = /^[6-9]\d{9}$/;
const validationError = (errors) => ({
  response: { data: { message: "Please correct the highlighted fields.", errors } },
});

const validateLoginForm = (form) => {
  const errors = {};
  if (!mobilePattern.test(form.mobile))
    errors.mobile = "A valid 10-digit Indian mobile number is required.";
  if (typeof form.password !== "string" || form.password.length < 8)
    errors.password = "Password must be at least 8 characters.";
  return Object.keys(errors).length ? validationError(errors) : null;
};

const validateRegistrationForm = (form, role) => {
  const errors = {};
  if (form.fullName.trim().length < 2) errors.fullName = "Full name is required.";
  if (!mobilePattern.test(form.mobile))
    errors.mobile = "A valid 10-digit Indian mobile number is required.";
  if (form.password.length < 8)
    errors.password = "Password must be at least 8 characters.";
  if (form.password !== form.confirmPassword)
    errors.confirmPassword = "Passwords do not match.";
  if (role === "provider") {
    if (!form.categoryName.trim()) errors.categoryName = "Category is required.";
    if (!form.experience && form.experience !== 0)
      errors.experience = "Experience is required.";
    if (!form.address.trim()) errors.address = "Address is required.";
  }
  return Object.keys(errors).length ? validationError(errors) : null;
};

export function LoginPage() {
  const { login } = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const [form, setForm] = useState({ mobile: "", password: "" }); const [role, setRole] = useState("customer"); const [error, setError] = useState(null); const [loading, setLoading] = useState(false);
  const submit = async (event) => { event.preventDefault(); const clientError = validateLoginForm(form); if (clientError) { setError(clientError); return; } setLoading(true); setError(null); try { const user = await login(form, role); navigate(location.state?.from?.pathname || (user.role === "customer" ? "/dashboard" : "/provider"), { replace: true }); } catch (nextError) { setError(nextError); } finally { setLoading(false); } };
  return <AuthPanel eyebrow="Welcome back" title="Come on in."><form className="form-stack" onSubmit={submit}><RoleSwitch value={role} onChange={setRole} /><Field label="Mobile number"><input required inputMode="numeric" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="10-digit mobile number" /></Field><PasswordField label="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />{error && <ErrorState error={error} />}<button className="button" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button><p className="form-help">New here? <Link to="/register">Create an account</Link></p></form></AuthPanel>;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("customer");
  const [form, setForm] = useState({ fullName: "", mobile: "", password: "", confirmPassword: "", categoryName: "", experience: "", address: "" });
  const [categories, setCategories] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { api.get("/categories").then(({ data }) => setCategories(data.data.categories)).catch(setError).finally(() => setCategoryLoading(false)); }, []);
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const updateCategory = (event) => setForm({ ...form, categoryName: event.target.value });
  const submit = async (event) => {
    event.preventDefault(); const clientError = validateRegistrationForm(form, role); if (clientError) { setError(clientError); return; } setLoading(true); setError(null);
    try {
      const payload = { fullName: form.fullName, mobile: form.mobile, password: form.password, confirmPassword: form.confirmPassword };
      if (role === "provider") {
        const category = categories.find((item) => item.name.toLowerCase() === form.categoryName.trim().toLowerCase());
        if (!category) { setError({ response: { data: { message: "Choose a category from the available list or enter its exact name." } } }); return; }
        Object.assign(payload, { categoryId: category.id, experience: Number(form.experience), address: form.address });
      }
      await register(payload, role);
      navigate("/login", { state: { notice: role === "provider" ? "Your provider application is ready. Sign in after approval." : "Account created. Sign in to continue." } });
    } catch (nextError) { setError(nextError); } finally { setLoading(false); }
  };
  return <AuthPanel eyebrow="Start here" title="Make home feel easier."><form className="form-stack" onSubmit={submit}><RoleSwitch value={role} onChange={setRole} /><Field label="Full name"><input required value={form.fullName} onChange={update("fullName")} /></Field><Field label="Mobile number"><input required inputMode="numeric" minLength="10" maxLength="10" value={form.mobile} onChange={update("mobile")} /></Field>{role === "provider" && <><Field label="Service category"><input required disabled={categoryLoading || categories.length === 0} list="service-categories" value={form.categoryName} onChange={updateCategory} placeholder={categoryLoading ? "Loading categories..." : "Choose or type a category"} /><datalist id="service-categories">{categories.map((category) => <option key={category.id} value={category.name} />)}</datalist></Field><Field label="Experience in years"><input required type="number" min="0" max="80" value={form.experience} onChange={update("experience")} /></Field><Field label="Service address"><input required value={form.address} onChange={update("address")} /></Field></>}<PasswordField label="Password" value={form.password} onChange={update("password")} minLength={8} /><PasswordField label="Confirm password" value={form.confirmPassword} onChange={update("confirmPassword")} minLength={8} />{error && <ErrorState error={error} />}<button className="button" disabled={loading || (role === "provider" && (categoryLoading || categories.length === 0))}>{loading ? "Creating..." : "Create account"}</button><p className="form-help">Already have an account? <Link to="/login">Sign in</Link></p></form></AuthPanel>;
}

function AuthPanel({ eyebrow, title, children }) { return <div className="auth-page"><div className="auth-aside"><Link className="brand" to="/">Sukh Breeze<span>.</span></Link><p>Reliable help starts with a clear next step.</p></div><section className="auth-card"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{children}</section></div>; }
function RoleSwitch({ value, onChange }) { return <div className="segmented"><button type="button" className={value === "customer" ? "active" : ""} onClick={() => onChange("customer")}>Customer</button><button type="button" className={value === "provider" ? "active" : ""} onClick={() => onChange("provider")}>Provider</button></div>; }
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }

export function CustomerDashboard() {
  const [categories, setCategories] = useState([]); const [providers, setProviders] = useState([]); const [categoryId, setCategoryId] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  const load = () => { setLoading(true); setError(null); Promise.all([api.get("/categories"), api.get(`/providers?page=1&limit=20${categoryId ? `&categoryId=${categoryId}` : ""}`)]).then(([categoriesResponse, providersResponse]) => { setCategories(categoriesResponse.data.data.categories); setProviders(providersResponse.data.data.providers); }).catch(setError).finally(() => setLoading(false)); };
  useEffect(load, [categoryId]);
  return <><PageHeader eyebrow="Customer workspace" title="What can we make easier today?"><Link className="button" to="/bookings">View bookings</Link></PageHeader><section className="toolbar"><div><span className="section-label">Browse by category</span><div className="filter-row"><button className={!categoryId ? "filter active" : "filter"} onClick={() => setCategoryId("")}>All services</button>{categories.map((category) => <button key={category.id} className={categoryId === category.id ? "filter active" : "filter"} onClick={() => setCategoryId(category.id)}>{category.name}</button>)}</div></div></section>{loading ? <LoadingState label="Finding available providers" /> : error ? <ErrorState error={error} onRetry={load} /> : providers.length ? <div className="provider-list">{providers.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}</div> : <EmptyState title="No providers available" text="Try another category or check back shortly." />}</>;
}

export function ProviderDetailPage() {
  const { id } = useParams(); const navigate = useNavigate(); const [provider, setProvider] = useState(null); const [form, setForm] = useState({ problemDescription: "", fullAddress: "", city: "", pincode: "", serviceDate: "", preferredTime: "" }); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(null);
  useEffect(() => { api.get(`/providers/${id}`).then(({ data }) => setProvider(data.data.provider)).catch(setError).finally(() => setLoading(false)); }, [id]);
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(null); try { await api.post("/bookings", { categoryId: provider.category.id, providerId: provider.id, problemDescription: form.problemDescription, address: { fullAddress: form.fullAddress, city: form.city, pincode: form.pincode }, serviceDate: form.serviceDate, preferredTime: form.preferredTime }); navigate("/bookings"); } catch (nextError) { setError(nextError); } finally { setSaving(false); } };
  if (loading) return <LoadingState label="Loading provider" />; if (error) return <ErrorState error={error} />;
  return <><PageHeader eyebrow={provider.category?.name} title={provider.fullName}><Link className="button button-light" to="/dashboard">Back to browse</Link></PageHeader><div className="detail-grid"><section className="detail-intro"><div className="avatar avatar-large">{provider.fullName?.slice(0, 1)}</div><p>{provider.bio || "A local professional ready to help with your next home service."}</p><div className="metric-row"><div><strong><Money value={provider.startingCharge} /></strong><span>starting charge</span></div><div><strong>{Number(provider.ratingAverage || 0).toFixed(1)}</strong><span>{provider.totalReviews || 0} reviews</span></div><div><strong>{provider.totalCompletedJobs || 0}</strong><span>completed jobs</span></div></div><Notice>Online payment is coming soon. Cash on service is available after completion.</Notice></section><form className="booking-form" onSubmit={submit}><h2>Request a visit</h2><Field label="What needs attention?"><textarea required maxLength="2000" value={form.problemDescription} onChange={(e) => setForm({ ...form, problemDescription: e.target.value })} /></Field><Field label="Full address"><input required value={form.fullAddress} onChange={(e) => setForm({ ...form, fullAddress: e.target.value })} /></Field><div className="field-row"><Field label="City"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field><Field label="Pincode"><input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></Field></div><div className="field-row"><Field label="Service date"><input required type="date" min={new Date().toISOString().slice(0, 10)} value={form.serviceDate} onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} /></Field><Field label="Preferred time"><input required placeholder="10:00-12:00" value={form.preferredTime} onChange={(e) => setForm({ ...form, preferredTime: e.target.value })} /></Field></div>{error && <ErrorState error={error} />}<button className="button" disabled={saving}>{saving ? "Sending request..." : "Request booking"}</button></form></div></>;
}

export function BookingsPage() {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); const [notice, setNotice] = useState("");
  const load = () => unwrap(api.get("/bookings/my?page=1&limit=20"), setData, setError, setLoading);
  useEffect(load, []);
  const cancel = async (id) => { setNotice(""); try { await api.patch(`/bookings/${id}/cancel`, { cancellationReason: "Plans changed" }); setNotice("Booking cancelled."); load(); } catch (nextError) { setError(nextError); } };
  if (loading) return <LoadingState label="Loading bookings" />; if (error) return <ErrorState error={error} onRetry={load} />;
  const bookings = data?.bookings || [];
  return <><PageHeader eyebrow="Customer workspace" title="Your bookings"><Link className="button" to="/dashboard">Book a service</Link></PageHeader>{notice && <Notice tone="success">{notice}</Notice>}{bookings.length ? <div className="booking-list">{bookings.map((booking) => <BookingCard key={booking.id} booking={booking} onCancel={cancel} />)}</div> : <EmptyState title="Nothing booked yet" text="Choose a provider and request your first visit." action={<Link className="text-link" to="/dashboard">Browse providers</Link>} />}</>;
}

function BookingCard({ booking, onCancel }) { const [review, setReview] = useState({ rating: 5, comment: "" }); const [existingReview, setExistingReview] = useState(null); const [reviewed, setReviewed] = useState(false); const [reviewLoading, setReviewLoading] = useState(booking.status === "completed"); const [reviewError, setReviewError] = useState(null); useEffect(() => { if (booking.status !== "completed") return undefined; let active = true; api.get(`/reviews/booking/${booking.id}`).then(({ data }) => { if (active) setExistingReview(data.data.review); }).catch((error) => { if (active && error.response?.status !== 404) setReviewError(error); }).finally(() => { if (active) setReviewLoading(false); }); return () => { active = false; }; }, [booking.id, booking.status]); const submitReview = async (e) => { e.preventDefault(); try { await api.post("/reviews", { bookingId: booking.id, rating: Number(review.rating), comment: review.comment }); setReviewed(true); } catch (error) { setReviewError(error); } }; const hasReview = Boolean(existingReview) || reviewed; return <article className="booking-card"><div className="booking-card-top"><div><span className="card-kicker">{booking.bookingId}</span><h3>{booking.category?.name || "Home service"}</h3><p>{booking.provider?.fullName || "Provider assigned"}</p></div><StatusPill value={booking.status} /></div><div className="booking-meta"><span>Service {new Date(booking.serviceDate).toLocaleDateString("en-IN")}</span><strong><Money value={booking.amount} /></strong></div>{booking.status === "pending" && <button className="button button-light" onClick={() => onCancel(booking.id)}>Cancel booking</button>}{booking.status === "completed" && reviewLoading && <span className="review-status">Checking review...</span>}{booking.status === "completed" && !reviewLoading && existingReview && <div className="review-readonly"><strong>Your review: {existingReview.rating} / 5</strong><span>{existingReview.comment || "No comment provided."}</span></div>}{booking.status === "completed" && !reviewLoading && !hasReview && <form className="review-form" onSubmit={submitReview}><strong>How did it go?</strong><select value={review.rating} onChange={(e) => setReview({ ...review, rating: e.target.value })}><option value="5">5 / Excellent</option><option value="4">4 / Good</option><option value="3">3 / Okay</option><option value="2">2 / Poor</option><option value="1">1 / Bad</option></select><input placeholder="A short note (optional)" value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} /><button className="button button-small">Send review</button>{reviewError && <span className="inline-error">{reviewError.response?.data?.message || "Review could not be sent."}</span>}</form>}{reviewed && <Notice tone="success">Review submitted.</Notice>}{reviewError && existingReview === null && !reviewLoading && <span className="inline-error">{reviewError.response?.data?.message || "Review status could not be loaded."}</span>}</article>; }

export function NotificationsPage() { const [data, setData] = useState(null); const [unread, setUnread] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); const load = () => { setLoading(true); Promise.all([api.get("/notifications?page=1&limit=30"), api.get("/notifications/unread-count")]).then(([list, count]) => { setData(list.data.data); setUnread(count.data.data.count); }).catch(setError).finally(() => setLoading(false)); }; useEffect(load, []); const markRead = async (id) => { try { await api.patch(`/notifications/${id}/read`); load(); } catch (nextError) { setError(nextError); } }; if (loading) return <LoadingState label="Loading notifications" />; if (error) return <ErrorState error={error} onRetry={load} />; return <><PageHeader eyebrow="Your updates" title="Notifications"><span className="count-badge">{unread} unread</span></PageHeader>{data?.notifications?.length ? <div className="notification-list">{data.notifications.map((notification) => <article className={notification.isRead ? "notification read" : "notification"} key={notification.id}><div><span className="card-kicker">{notification.type.replaceAll("_", " ")}</span><h3>{notification.title}</h3><p>{notification.message}</p></div>{!notification.isRead && <button className="text-link" onClick={() => markRead(notification.id)}>Mark read</button>}</article>)}</div> : <EmptyState title="All quiet" text="New booking and payment updates will appear here." />}</>; }

export function ProviderDashboard() { const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); const load = () => { setLoading(true); Promise.all([api.get("/bookings/provider/requests?page=1&limit=20"), api.get("/bookings/provider/active?page=1&limit=20"), api.get("/bookings/provider/history?page=1&limit=20")]).then(([requests, active, history]) => setData({ requests: requests.data.data.bookings, active: active.data.data.bookings, history: history.data.data.bookings })).catch(setError).finally(() => setLoading(false)); }; useEffect(load, []); const transition = async (id, action, body) => { try { await api.patch(`/bookings/${id}/${action}`, body); load(); } catch (nextError) { setError(nextError); } }; const cash = async (bookingId) => { try { await api.post("/payments/cash/received", { bookingId }); load(); } catch (nextError) { setError(nextError); } }; if (loading) return <LoadingState label="Loading your workboard" />; if (error) return <ErrorState error={error} onRetry={load} />; return <><PageHeader eyebrow="Provider workspace" title="Your workboard"><Link className="button button-light" to="/provider/profile">Profile settings</Link></PageHeader><ProviderColumn title="New requests" bookings={data.requests} action={(booking) => <><button className="button button-small" onClick={() => transition(booking.id, "accept")}>Accept</button><button className="button button-light button-small" onClick={() => transition(booking.id, "reject", { rejectionReason: "Schedule unavailable" })}>Decline</button></>} /><ProviderColumn title="Active visits" bookings={data.active} action={(booking) => <>{booking.status === "accepted" && <button className="button button-small" onClick={() => transition(booking.id, "start")}>Start visit</button>}{booking.status === "in_progress" && <button className="button button-small" onClick={() => transition(booking.id, "complete")}>Complete visit</button>}</>} /><ProviderColumn title="History" bookings={data.history} action={(booking) => booking.status === "completed" && <button className="button button-light button-small" onClick={() => cash(booking.id)}>Report cash received</button>} /></>; }
function ProviderColumn({ title, bookings, action }) { return <section className="work-section"><div className="section-heading"><h2>{title}</h2><span>{bookings.length}</span></div>{bookings.length ? <div className="work-list">{bookings.map((booking) => <article className="work-card" key={booking.id}><div><span className="card-kicker">{booking.bookingId}</span><h3>{booking.customer?.fullName || "Customer"}</h3><p>{booking.address?.fullAddress}</p></div><div className="work-card-action"><StatusPill value={booking.status} />{action(booking)}</div></article>)}</div> : <EmptyState title="Nothing here" text="New work will appear when a booking changes state." />}</section>; }

export function ProviderProfilePage() { const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); useEffect(() => unwrap(api.get("/providers/me"), setData, setError, setLoading), []); if (loading) return <LoadingState />; if (error) return <ErrorState error={error} />; const profile = data.profile; return <><PageHeader eyebrow="Provider profile" title={data.user.fullName}><span className="status-pill">{profile.approvalStatus}</span></PageHeader><section className="profile-panel"><div><span className="section-label">Category</span><strong>{data.category?.name}</strong></div><div><span className="section-label">Starting charge</span><strong><Money value={profile.startingCharge} /></strong></div><div><span className="section-label">Rating</span><strong>{Number(profile.ratingAverage || 0).toFixed(1)} / 5</strong></div><div><span className="section-label">Availability</span><strong>{profile.availability ? "Available" : "Unavailable"}</strong></div></section></>; }

export function AdminPage() { return <><PageHeader eyebrow="Admin space" title="Platform overview" /><Notice>Admin dashboard operations are intentionally limited in Phase 8. The existing backend remains the source of truth for moderation and settlements.</Notice></>; }
