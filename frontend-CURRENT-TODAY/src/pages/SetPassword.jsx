import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ErrorMessage, SuccessMessage } from "../components/Feedback";
import { api } from "../services/api";

export default function SetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Invitation token is missing.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const result = await api.setPassword({ token, password: form.password, confirmPassword: form.confirmPassword });
      setSuccess(result.message || "Your account has been activated successfully.");
      setForm({ password: "", confirmPassword: "" });
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return <div className="auth-page">
    <div className="auth-art">
      <div className="brand"><span className="brand-mark">S</span><span>StockSense</span></div>
      <div className="auth-promise">
        <span className="kicker">TEAM ACCESS</span>
        <h1>Set your StockSense password.</h1>
        <p>Complete your account setup to activate your employee access.</p>
      </div>
    </div>
    <div className="auth-panel">
      <div className="auth-form">
        <span className="kicker">ACTIVATE ACCOUNT</span>
        <h2>Set Your Password</h2>
        <form onSubmit={submit}>
          <label>New Password<input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Create a password" autoComplete="new-password" required /></label>
          <label>Confirm Password<input type="password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} placeholder="Confirm your password" autoComplete="new-password" required /></label>
          <ErrorMessage message={error} />
          <SuccessMessage message={success} />
          <button className="primary full" type="submit" disabled={busy}>{busy ? "Activating..." : "Activate Account"} <span>→</span></button>
        </form>
      </div>
    </div>
  </div>;
}
