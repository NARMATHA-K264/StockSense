import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import Loading from "../components/Loading";
import { EmptyState, ErrorMessage } from "../components/Feedback";

const filterOptions = ["ALL", "OUT_OF_STOCK", "CRITICAL", "LOW", "ADEQUATE", "INSUFFICIENT_DATA"];
const statusLabels = {
  OUT_OF_STOCK: "Out of stock",
  CRITICAL: "Critical",
  LOW: "Low",
  ADEQUATE: "Adequate",
  INSUFFICIENT_DATA: "No Data",
};
const riskOrder = {
  OUT_OF_STOCK: 0,
  CRITICAL: 1,
  LOW: 2,
  ADEQUATE: 3,
  INSUFFICIENT_DATA: 4,
};

const safeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeStatus = (status) => {
  if (status === null || status === undefined) return "ADEQUATE";
  const normalized = String(status).trim().toUpperCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (normalized === "NO_DATA" || normalized === "INSUFFICIENT_DATA") return "INSUFFICIENT_DATA";
  return normalized;
};

const getStatusMeta = (status) => {
  const normalized = normalizeStatus(status);
  const label = statusLabels[normalized] || normalized.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const className = {
    OUT_OF_STOCK: "risk-badge out-of-stock",
    CRITICAL: "risk-badge critical",
    LOW: "risk-badge low",
    ADEQUATE: "risk-badge adequate",
    INSUFFICIENT_DATA: "risk-badge no-data",
  }[normalized] || "risk-badge adequate";

  return { normalized, label, className };
};

const formatValue = (value, fallback = "—") => {
  const numeric = safeNumber(value);
  return numeric === null ? fallback : numeric.toLocaleString();
};

export default function Replenishment() {
  const [data, setData] = useState(null);
  const [horizon, setHorizon] = useState("7");
  const [filter, setFilter] = useState("ALL");
  const [sort, setSort] = useState("replenishment");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (days = horizon) => {
    setLoading(true);
    setError("");
    api
      .replenishment(`?planningHorizonDays=${days}`)
      .then((result) => setData(result))
      .catch((err) => {
        const message = err?.status === 502 ? "Unable to load inventory risk analysis. Risk service is currently unavailable." : err?.message || "Unable to load inventory risk analysis.";
        setError(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const applyHorizon = (event) => {
    event.preventDefault();
    setSelected(null);
    load(horizon);
  };

  const items = useMemo(
    () =>
      (Array.isArray(data?.items) ? data.items : []).map((item) => ({
        ...item,
        status: normalizeStatus(item.status),
      })),
    [data]
  );

  const summaryCards = useMemo(() => {
    const counts = {
      totalItems: Array.isArray(data?.items) ? data.items.length : 0,
      outOfStock: 0,
      critical: 0,
      low: 0,
      adequate: 0,
      noData: 0,
    };

    for (const item of items) {
      const status = normalizeStatus(item.status);
      if (status === "OUT_OF_STOCK") counts.outOfStock += 1;
      else if (status === "CRITICAL") counts.critical += 1;
      else if (status === "LOW") counts.low += 1;
      else if (status === "ADEQUATE") counts.adequate += 1;
      else if (status === "INSUFFICIENT_DATA") counts.noData += 1;
    }

    return counts;
  }, [data, items]);

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => filter === "ALL" || normalizeStatus(item.status) === filter);

    return [...filtered].sort((left, right) => {
      if (sort === "replenishment") {
        const leftValue = safeNumber(left.recommendedReplenishment) ?? -Infinity;
        const rightValue = safeNumber(right.recommendedReplenishment) ?? -Infinity;
        return rightValue - leftValue;
      }

      if (sort === "quantity") {
        const leftValue = safeNumber(left.currentQuantity) ?? Number.POSITIVE_INFINITY;
        const rightValue = safeNumber(right.currentQuantity) ?? Number.POSITIVE_INFINITY;
        return leftValue - rightValue;
      }

      if (sort === "cover") {
        const leftValue = safeNumber(left.daysOfCover) ?? Number.POSITIVE_INFINITY;
        const rightValue = safeNumber(right.daysOfCover) ?? Number.POSITIVE_INFINITY;
        return leftValue - rightValue;
      }

      return (riskOrder[normalizeStatus(left.status)] ?? 99) - (riskOrder[normalizeStatus(right.status)] ?? 99);
    });
  }, [filter, items, sort]);

  const hasNoData = items.some((item) => normalizeStatus(item.status) === "INSUFFICIENT_DATA");

  if (loading && !data) return <Loading label="Analyzing inventory risk..." />;

  return (
    <>
      <section className="page-intro risk-page-intro">
        <div>
          <span className="kicker">CONTROL / RISK</span>
          <h2>Inventory Risk &amp; Replenishment</h2>
          <p className="muted">Understand which stock positions need attention and why.</p>
        </div>

        <form className="risk-horizon" onSubmit={applyHorizon}>
          <label>Planning window</label>
          <div className="planning-window-options">
            {[7, 14, 30].map((value) => (
              <button
                key={value}
                type="button"
                className={String(value) === String(horizon) ? "planning-button active" : "planning-button"}
                onClick={() => setHorizon(String(value))}
              >
                {value} Days
              </button>
            ))}
            <button type="submit" className="primary risk-analyze-button">
              Analyze
            </button>
          </div>
        </form>
      </section>

      <ErrorMessage message={error} />

      {loading && data && <div className="risk-loading-inline">Analyzing inventory risk...</div>}

      {!error && data && !items.length && <EmptyState title="No inventory items found." />}

      {!error && data && items.length > 0 && (
        <>
          <section className="risk-summary-grid">
            <Metric label="Total Items" value={summaryCards.totalItems} tone="green" />
            <Metric label="Out of Stock" value={summaryCards.outOfStock} tone="red" />
            <Metric label="Critical" value={summaryCards.critical} tone="red" />
            <Metric label="Low Stock" value={summaryCards.low} tone="amber" />
            <Metric label="Adequate" value={summaryCards.adequate} tone="blue" />
            <Metric label="No Data" value={summaryCards.noData} tone="slate" />
          </section>

          <div className="risk-toolbar">
            <div className="risk-filters">
              {filterOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? "filter-button active" : "filter-button"}
                  onClick={() => setFilter(value)}
                >
                  {value === "ALL" ? "All" : value === "INSUFFICIENT_DATA" ? "No Data" : statusLabels[value]}
                </button>
              ))}
            </div>

            <div className="risk-sort-block">
              <label htmlFor="risk-sort">Sort by:</label>
              <select id="risk-sort" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="replenishment">Most to replenish</option>
                <option value="quantity">Lowest stock</option>
                <option value="cover">Lowest cover</option>
              </select>
            </div>

            <div className="risk-count">
              {visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}
            </div>
          </div>

          {hasNoData && <div className="risk-note">Forecast unavailable — more sales history is required.</div>}

          {visibleItems.length ? (
            <div className="table-panel risk-table-panel">
              <table className="risk-table">
                <thead>
                  <tr>
                    <th>Product / Store</th>
                    <th>Current</th>
                    <th>Reorder</th>
                    <th>Forecast</th>
                    <th>Cover</th>
                    <th>Risk</th>
                    <th>Recommended</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => {
                    const statusMeta = getStatusMeta(item.status);
                    const recommended = safeNumber(item.recommendedReplenishment);
                    const forecast = safeNumber(item.forecastDemand);
                    const current = safeNumber(item.currentQuantity);
                    const reorder = safeNumber(item.reorderLevel);
                    const cover = safeNumber(item.daysOfCover);

                    return (
                      <tr key={`${item.productId}:${item.storeId}`}>
                        <td className="product-store-cell">
                          <div className="product-name">{item.productName || "Product"}</div>
                          <div className="product-meta">{item.sku || "—"}</div>
                          <div className="product-meta muted">{item.storeName || "Store"}</div>
                        </td>
                        <td>{formatValue(current)}</td>
                        <td>{formatValue(reorder)}</td>
                        <td>{forecast === null ? "—" : formatValue(forecast)}</td>
                        <td>{cover === null ? "—" : `${cover} days`}</td>
                        <td>
                          <span className={statusMeta.className}>{statusMeta.label}</span>
                        </td>
                        <td>{recommended === null ? "—" : `${recommended.toLocaleString()} units`}</td>
                        <td className="actions-cell">
                          <button type="button" className="text-link" onClick={() => setSelected(item)}>
                            Details →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No products match this risk filter." />
          )}
        </>
      )}

      {selected && <RiskDetails item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <i>↗</i>
      </div>
      <strong>{value ?? 0}</strong>
      <small>Current analysis</small>
    </div>
  );
}

function RiskDetails({ item, onClose }) {
  const statusMeta = getStatusMeta(item.status);
  const recommendation = safeNumber(item.recommendedReplenishment);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal risk-detail">
        <div className="modal-head">
          <div>
            <span className="kicker">EXPLAINED RECOMMENDATION</span>
            <h2>{item.productName || "Product"}</h2>
            <p className="muted">{item.storeName || "Store"}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="risk-detail-status">
          <span className={statusMeta.className}>{statusMeta.label}</span>
          <b>{recommendation === null ? "Recommendation unavailable" : `${recommendation.toLocaleString()} units recommended`}</b>
        </div>

        <div className="explanation-grid">
          <Explain label="Current quantity" value={formatValue(safeNumber(item.currentQuantity))} />
          <Explain label="Reorder level" value={formatValue(safeNumber(item.reorderLevel))} />
          <Explain label="Forecast demand" value={safeNumber(item.forecastDemand) === null ? "No history" : formatValue(item.forecastDemand)} />
          <Explain label="Safety stock" value={safeNumber(item.safetyStock) === null ? "—" : formatValue(item.safetyStock)} />
          <Explain label="Target stock" value={safeNumber(item.targetStock) === null ? "—" : formatValue(item.targetStock)} />
          <Explain label="Days of cover" value={safeNumber(item.daysOfCover) === null ? "—" : `${safeNumber(item.daysOfCover)} days`} />
        </div>

        <p className="form-note">
          Target stock combines forecast demand for the selected planning window with a two-day safety buffer. Recommendations are informational only; no order is placed.
        </p>
      </div>
    </div>
  );
}

function Explain({ label, value }) {
  return (
    <div className="explain-item">
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}