import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { dashboardPathForRole, useAuth } from "../context/AuthContext";
import { ErrorMessage } from "../components/Feedback";
import stockSenseLogin from "../assets/stock-sense-login.jpg";
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.email.trim()) return setError("Email is required");
    if (!form.password) return setError("Password is required");

    setBusy(true);

    try {
      const result = await login(form);
      navigate(dashboardPathForRole(result.user.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="brand brand-lockup">
          <span className="brand-mark">S</span>
          <span>StockSense</span>
        </div>

        <div className="auth-visual-wrap">
          <img
            className="auth-visual"
            src={stockSenseLogin}
            alt="Organized retail shelving and stocked inventory"
          />
        </div>

        <div className="auth-promise">
          <h1>
            Know your stock.
            <br />
            <span>Run your store smarter.</span>
          </h1>
          <p>Real-time inventory visibility for modern retail teams.</p>

          <div className="auth-badges">
            <span>Live Inventory</span>
            <span>Smart Forecasting</span>
            <span>Store Insights</span>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-form">
          <div className="auth-form-header">
            <span className="kicker">Welcome back</span>
            <h2>Sign in to StockSense</h2>
            <p className="muted">Manage your inventory and keep your store moving.</p>
          </div>

          <form onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Your password"
                autoComplete="current-password"
              />
            </label>

            <ErrorMessage message={error} />

            <button type="submit" className="primary full" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
              <span>→</span>
            </button>
          </form>

          <p className="auth-switch">Your account is managed by your StockSense administrator.</p>
        </div>
      </div>
    </div>
  );
}

