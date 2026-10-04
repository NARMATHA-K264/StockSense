import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import Loading from "../components/Loading";
import { EmptyState, ErrorMessage } from "../components/Feedback";
import StoreMap from "../components/StoreMap";

const statusOptions = ["ALL", "CRITICAL", "LOW", "ADEQUATE", "OUT_OF_STOCK"];

const hasValidCoordinates = (store) => {
  const latitude = Number(store.latitude);
  const longitude = Number(store.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
};

const getRiskState = (summary = {}) => {
  if (summary.criticalItems > 0) return "CRITICAL";
  if (summary.outOfStockItems > 0) return "OUT_OF_STOCK";
  if (summary.lowStockItems > 0) return "LOW";
  return "ADEQUATE";
};

export default function StoresMap() {
  const [stores, setStores] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [storeFilter, setStoreFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fitAllKey, setFitAllKey] = useState(0);

  const load = () => {
    setLoading(true);
    setError("");
    api
      .storeMap()
      .then((data) => setStores(data.stores || []))
      .catch((err) => setError(err.message || "Unable to load store locations."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const located = stores.filter(hasValidCoordinates);
  const missingCount = stores.length - located.length;
  const riskByStore = useMemo(() => new Map(located.map((store) => [store._id, store.inventorySummary || {}])), [located]);

  const visibleStores = located
    .filter((store) => storeFilter === "ALL" || store._id === storeFilter)
    .filter((store) => {
      if (riskFilter === "ALL") return true;
      const summary = riskByStore.get(store._id) || {};
      if (riskFilter === "CRITICAL") return summary.criticalItems > 0;
      if (riskFilter === "LOW") return summary.lowStockItems > 0;
      if (riskFilter === "OUT_OF_STOCK") return summary.outOfStockItems > 0;
      return summary.criticalItems === 0 && summary.lowStockItems === 0 && summary.outOfStockItems === 0;
    });

  const selected = visibleStores.find((store) => store._id === selectedId) || visibleStores[0] || null;

  useEffect(() => {
    if (selected && selected._id !== selectedId) {
      setSelectedId(selected._id);
    }
  }, [selected, selectedId]);

  if (loading) return <Loading label="Loading store locations..." />;

  return (
    <>
      <section className="page-intro map-intro">
        <div>
          <span className="kicker">NETWORK / LOCATION</span>
          <h2>Stores map</h2>
          <p className="muted">
            StockSense geographic mapping of real retail locations. Store IDs are mapping assignments, not business locations supplied by the source dataset.
          </p>
        </div>
        <div className="map-actions">
          <button type="button" className="secondary-button" onClick={() => setFitAllKey((value) => value + 1)}>
            Fit all stores
          </button>
          <button type="button" className="secondary-button" onClick={load}>
            Refresh
          </button>
        </div>
      </section>

      <ErrorMessage message={error} />

      {!error && !stores.length ? (
        <EmptyState title="No stores available." />
      ) : !error && !located.length ? (
        <EmptyState title="No stores have valid coordinates." action={<p>Store entries without latitude or longitude remain in the list but are not placed on the map.</p>} />
      ) : (
        <>
          <div className="map-toolbar">
            <label>
              Store
              <select
                value={storeFilter}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setStoreFilter(nextValue);
                  setSelectedId(nextValue === "ALL" ? "" : nextValue);
                }}
              >
                <option value="ALL">All stores</option>
                {stores.map((store) => (
                  <option key={store._id} value={store._id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Risk filter
              <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === "ALL" ? "All risk states" : status.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <span className="map-count">
              {located.length} mapped · {missingCount} without coordinates
            </span>
          </div>

          {visibleStores.length ? (
            <div className="map-layout">
              <StoreMap stores={visibleStores} selected={selected} onSelect={(store) => setSelectedId(store._id)} fitAllKey={fitAllKey} />
              <StoreDetails store={selected} />
            </div>
          ) : (
            <EmptyState title="No mapped stores match this filter." />
          )}
        </>
      )}
    </>
  );
}

function StoreDetails({ store }) {
  if (!store) return null;

  const summary = store.inventorySummary || {};
  const riskState = getRiskState(summary);

  return (
    <aside className="store-details panel">
      <span className="kicker">SELECTED LOCATION</span>
      <h3>{store.name}</h3>
      <p>{store.location}</p>
      <small>
        {Number(store.latitude).toFixed(5)}, {Number(store.longitude).toFixed(5)}
      </small>

      <div className="location-rule" />

      <div className="location-stats">
        <div>
          <b>{summary.totalItems || 0}</b>
          <span>Inventory items</span>
        </div>
        <div>
          <b>{summary.totalQuantity || 0}</b>
          <span>Total units</span>
        </div>
        <div>
          <b>{summary.lowStockItems || 0}</b>
          <span>Low stock</span>
        </div>
        <div>
          <b>{summary.criticalItems || 0}</b>
          <span>Critical</span>
        </div>
        <div>
          <b>{summary.outOfStockItems || 0}</b>
          <span>Out of stock</span>
        </div>
      </div>

      <div className="risk-summary">
        <span className="kicker">Risk</span>
        <strong>{riskState}</strong>
      </div>

      <p className="form-note">
        Risk figures reuse the existing replenishment analysis. This map only visualizes stored coordinates and current data.
      </p>
    </aside>
  );
}
