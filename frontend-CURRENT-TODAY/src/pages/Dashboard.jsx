import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import Loading from "../components/Loading";
import { ErrorMessage } from "../components/Feedback";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.products.list(),
      api.stores.list(),
      api.inventory.list(),
      api.inventory.lowStock(),
      api.sales.list(),
    ])
      .then(([products, stores, inventory, lowStock, sales]) => {
        setData({
          products: products.products || [],
          stores: stores.stores || [],
          inventory: inventory.inventory || [],
          lowStock: lowStock.inventory || [],
          sales: sales.sales || [],
        });
      })
      .catch((err) => setError(err.message || "Unable to load dashboard."));
  }, []);

  const metrics = useMemo(() => {
    if (!data) return {};

    const totalUnits = (data.inventory || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const recentActivity = [...(data.sales || [])]
      .sort((a, b) => new Date(b.saleDate || 0) - new Date(a.saleDate || 0))
      .slice(0, 4);
    const topSeller = [...(data.sales || [])].reduce((best, sale) => {
      if (!best || Number(sale.totalAmount || 0) > Number(best.totalAmount || 0)) return sale;
      return best;
    }, null);

    return {
      totalUnits,
      recentActivity,
      topSeller,
      lowStockCount: data.lowStock.length,
    };
  }, [data]);

  if (!data && !error) return <Loading label="Loading overview" />;

  return (
    <>
      <ErrorMessage message={error} />

      <section className="welcome-row dashboard-welcome">
        <div>
          <span className="kicker">Good to see you</span>
          <h2>Admin Dashboard</h2>
          <p className="muted">A live pulse on the operation, without the clutter.</p>
        </div>
        <div className="date-stamp">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date())}</div>
      </section>

      <section className="metric-grid dashboard-overview-grid">
        <Metric label="Products" value={data?.products.length ?? 0} hint="Active catalog" tone="blue" icon="▦" />
        <Metric label="Stores" value={data?.stores.length ?? 0} hint="Connected locations" tone="indigo" icon="⌖" />
        <Metric label="Units on hand" value={metrics.totalUnits ?? 0} hint="Across inventory records" tone="green" icon="▤" />
        <Metric label="Low stock alerts" value={metrics.lowStockCount ?? 0} hint="Needs attention" tone="amber" icon="!" />
      </section>

      <section className="dashboard-grid dashboard-flow-grid">
        <div className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <span className="kicker">Latest activity</span>
              <h3>Recent sales</h3>
            </div>
            <span className="count-label">{data?.sales.length || 0} total</span>
          </div>

          {metrics.recentActivity.length ? (
            <table className="recent-sales-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Store</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentActivity.map((sale) => (
                  <tr key={sale._id}>
                    <td>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(sale.saleDate))}</td>
                    <td>{sale.store?.name || "Store"}</td>
                    <td>₹{Number(sale.totalAmount || 0).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty compact">
              <strong>No recent sales yet.</strong>
            </div>
          )}
        </div>

        <div className="panel stock-watch">
          <div className="panel-heading">
            <div>
              <span className="kicker">Operations</span>
              <h3>Low stock watch</h3>
            </div>
          </div>

          {data?.lowStock?.length ? (
            <div className="stacked-list">
              {data.lowStock.slice(0, 4).map((item) => (
                <div className="watch-item" key={`${item.product?._id || item.productId}-${item.store?._id || item.storeId}`}>
                  <div className="watch-icon" aria-hidden="true">!</div>
                  <div className="watch-copy">
                    <b>{item.product?.name || item.productName || "Product"}</b>
                    <p>{item.store?.name || item.storeName || "Store"}</p>
                    <div className="stock-watch-levels">
                      <span><small>On hand</small><strong>{item.quantity ?? 0}</strong></span>
                      <span><small>Reorder at</small><strong>{item.reorderLevel ?? 0}</strong></span>
                      <span className="status-badge low-stock">Low Stock</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty compact">
              <strong>Everything looks healthy.</strong>
            </div>
          )}

          {metrics.topSeller && (
            <div className="summary-strip dashboard-top-revenue">
              <span className="kicker">Top revenue</span>
              <strong>{metrics.topSeller.product?.name || "Product"}</strong>
              <small>₹{Number(metrics.topSeller.totalAmount || 0).toLocaleString()}</small>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Metric({ label, value, hint, tone, icon }) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <i aria-hidden="true">{icon}</i>
      </div>
      <strong>{value ?? "—"}</strong>
      <small>{hint}</small>
    </div>
  );
}