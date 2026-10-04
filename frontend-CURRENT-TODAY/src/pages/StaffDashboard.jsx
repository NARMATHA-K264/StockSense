import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorMessage } from "../components/Feedback";
import Loading from "../components/Loading";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

export default function StaffDashboard() {
  const { user } = useAuth();
  const isCashier = user?.role === "cashier";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const request = isCashier
      ? Promise.all([api.sales.list(), api.products.list(), api.inventory.list()]).then(([sales, products, inventory]) => ({
        sales: sales.sales || [],
        products: products.products || [],
        inventory: inventory.inventory || [],
      }))
      : Promise.all([api.inventory.list(), api.inventory.lowStock(), api.products.list()]).then(([inventory, lowStock, products]) => ({
        inventory: inventory.inventory || [],
        lowStock: lowStock.inventory || [],
        products: products.products || [],
      }));

    request.then(setData).catch((requestError) => setError(requestError.message));
  }, [isCashier]);

  if (!data && !error) return <Loading label="Loading your workspace" />;

  const title = isCashier ? "Sales at a glance" : "Inventory at a glance";
  return <>
    <ErrorMessage message={error} />
    <section className="welcome-row">
      <div><span className="kicker">YOUR WORKSPACE</span><h2>{title}</h2><p className="muted">A clear view of the work in front of you.</p></div>
      <div className="staff-dashboard-links">
        {isCashier && <Link className="secondary-button" to="/sales">Open sales <span aria-hidden="true">→</span></Link>}
        <Link className="secondary-button" to={isCashier ? "/products" : "/inventory"}>{isCashier ? "View products" : "Manage inventory"} <span aria-hidden="true">→</span></Link>
      </div>
    </section>
    {isCashier ? <section className="metric-grid">
      <Metric label="Your sales" value={data.sales.length} hint="Sales recorded by you" tone="green" />
      <Metric label="Products" value={data.products.length} hint="Available catalog" tone="blue" />
      <Metric label="Units on hand" value={data.inventory.reduce((total, item) => total + item.quantity, 0)} hint="Across stores" tone="amber" />
    </section> : <section className="metric-grid">
      <Metric label="Inventory records" value={data.inventory.length} hint="Product / store pairs" tone="green" />
      <Metric label="Low stock items" value={data.lowStock.length} hint="Needs attention" tone="red" />
      <Metric label="Products" value={data.products.length} hint="Catalog items" tone="blue" />
    </section>}
  </>;
}

function Metric({ label, value, hint, tone }) {
  return <div className={`metric-card ${tone}`}><div className="metric-top"><span>{label}</span></div><strong>{value ?? "—"}</strong><small>{hint}</small></div>;
}