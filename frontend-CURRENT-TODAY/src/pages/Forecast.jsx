import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import Loading from "../components/Loading";
import { ErrorMessage } from "../components/Feedback";

const horizonOptions = [7, 14, 30];

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatMethod = (value) => {
  if (!value) return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatShortDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatLongDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function Forecast() {
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [selection, setSelection] = useState({ productId: "", storeId: "", forecastDays: "7" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.stores.list()
      .then((storeData) => {
        setStores(storeData.stores || []);
      })
      .catch((err) => setError(err.message || "Unable to load forecast inputs."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setProducts([]);
    if (!selection.storeId) return undefined;

    let active = true;
    setProductsLoading(true);
    api.forecastProducts(selection.storeId)
      .then((productData) => {
        if (active) setProducts(productData.products || []);
      })
      .catch((err) => {
        if (active) {
          setProducts([]);
          setError(err.message || "Unable to load products with sales history.");
        }
      })
      .finally(() => {
        if (active) setProductsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selection.storeId]);

  const generate = async (event) => {
    event.preventDefault();

    if (!selection.productId || !selection.storeId) {
      setError("Select a product and store before generating a forecast.");
      return;
    }

    if (generating) return;

    setError("");
    setResult(null);
    setGenerating(true);

    try {
      const forecast = await api.forecast({
        ...selection,
        forecastDays: Number(selection.forecastDays),
      });
      setResult(forecast);
    } catch (err) {
      setError(err?.status === 502 ? "Unable to generate forecast." : err?.message || "Unable to generate forecast.");
      setResult(null);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <Loading label="Loading forecast inputs" />;

  return (
    <>
      <section className="page-intro">
        <div>
          <span className="kicker">PLANNING</span>
          <h2>Demand Forecast</h2>
          <p className="muted">Use recorded sales history to estimate the next few days.</p>
        </div>
      </section>

      <section className="forecast-config-card panel">
        <div className="panel-heading forecast-panel-heading">
          <div>
            <span className="kicker">CONFIGURE</span>
            <h3>Choose a product and location</h3>
          </div>
        </div>

        <form onSubmit={generate} className="forecast-form">
          <div className="forecast-form-grid">
            <label className="field">
              <span>Store</span>
              <select
                value={selection.storeId}
                onChange={(event) => {
                  setProducts([]);
                  setSelection((current) => ({
                    ...current,
                    storeId: event.target.value,
                    productId: "",
                  }));
                }}
              >
                <option value="">Select store</option>
                {stores.map((store) => (
                  <option key={store._id} value={store._id}>
                    {store.name} {store.location ? `· ${store.location}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Product</span>
              <select
                value={selection.productId}
                disabled={!selection.storeId || productsLoading}
                onChange={(event) => setSelection((current) => ({ ...current, productId: event.target.value }))}
              >
                <option value="">
                  {!selection.storeId
                    ? "Select store first"
                    : productsLoading
                      ? "Loading products..."
                      : "Select product"}
                </option>
                {products.map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name} {product.sku ? `· ${product.sku}` : ""}
                  </option>
                ))}
              </select>
              {selection.storeId && !productsLoading && products.length === 0 && (
                <small>No products with sales history for this store.</small>
              )}
            </label>
          </div>

          <div className="forecast-horizon-row">
            <div className="field horizon-field">
              <span>Forecast Horizon</span>
              <div className="button-group">
                {horizonOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={selection.forecastDays === String(value) ? "option-button active" : "option-button"}
                    onClick={() => setSelection((current) => ({ ...current, forecastDays: String(value) }))}
                  >
                    {value} Days
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="primary forecast-submit"
              disabled={generating || !selection.productId || !selection.storeId}
            >
              {generating ? "Generating Forecast..." : "Generate Forecast →"}
            </button>
          </div>
        </form>
      </section>

      <ErrorMessage message={error} />

      {!error && !result && !generating && (
        <div className="forecast-empty-state panel">
          <span className="forecast-glyph">⌁</span>
          <h3>Forecast Result</h3>
          <p>Select a product, store, and forecast horizon, then generate a forecast.</p>
        </div>
      )}

      {result && <ForecastResult result={result} />}
    </>
  );
}

function ForecastResult({ result }) {
  const forecastDays = Number(result?.forecastDays || 7);
  const product = result?.product?.name || result?.productId || "Product";
  const store = result?.store?.name || result?.storeId || "Store";
  const methodLabel = formatMethod(result?.model || result?.method || result?.forecastMethod);
  const history = Array.isArray(result?.historical) ? result.historical : [];
  const forecast = Array.isArray(result?.forecast) ? result.forecast : [];
  const historicalRecordCount = Number(result?.historicalRecords ?? history.length ?? 0);

  const chartPoints = useMemo(() => {
    const map = new Map();

    history.forEach((item) => {
      const date = String(item.date);
      map.set(date, { date, history: toNumber(item.demand), forecast: null });
    });

    forecast.forEach((item) => {
      const date = String(item.date);
      const current = map.get(date) || { date, history: null, forecast: null };
      current.forecast = toNumber(item.predictedDemand);
      map.set(date, current);
    });

    return Array.from(map.values()).sort((left, right) => new Date(left.date) - new Date(right.date));
  }, [forecast, history]);

  const allValues = [...history.map((item) => toNumber(item.demand)), ...forecast.map((item) => toNumber(item.predictedDemand))];
  const maxValue = Math.max(...allValues, 1);
  const limitedHistory = historicalRecordCount <= 3 || (!history.length && forecast.length > 0);

  return (
    <section className="forecast-result-wrapper">
      <div className="forecast-result-header">
        <div>
          <span className="kicker">FORECAST RESULT</span>
          <h3>{product}</h3>
          <p>{store}</p>
        </div>
      </div>

      {limitedHistory && (
        <div className="forecast-limit-note">Forecast generated with limited historical sales data.</div>
      )}

      <div className="forecast-metric-grid">
        <div className="forecast-metric-card">
          <span className="kicker">Forecast Horizon</span>
          <strong>{forecastDays} Days</strong>
        </div>

        <div className="forecast-metric-card">
          <span className="kicker">Historical Data</span>
          <strong>{historicalRecordCount ? `${historicalRecordCount} Day${historicalRecordCount === 1 ? "" : "s"}` : "—"}</strong>
        </div>

        <div className="forecast-metric-card">
          <span className="kicker">Forecast Method</span>
          <strong>{methodLabel}</strong>
        </div>
      </div>

      <div className="forecast-chart-panel panel">
        <div className="panel-heading">
          <div>
            <span className="kicker">DEMAND SIGNAL</span>
            <h3>History vs Prediction</h3>
          </div>
          <div className="chart-legend">
            <span><i className="legend-swatch history" />History</span>
            <span><i className="legend-swatch forecast" />Forecast</span>
          </div>
        </div>

        {chartPoints.length ? (
          <div className="forecast-chart-body">
            {chartPoints.map((point) => (
              <div className="chart-column" key={point.date}>
                <div className="chart-bars">
                  {point.history !== null && (
                    <span
                      className="history-bar"
                      style={{ height: `${Math.max((point.history / maxValue) * 170, point.history > 0 ? 10 : 0)}px` }}
                    />
                  )}
                  {point.forecast !== null && (
                    <span
                      className="forecast-bar"
                      style={{ height: `${Math.max((point.forecast / maxValue) * 170, point.forecast > 0 ? 10 : 0)}px` }}
                    />
                  )}
                </div>
                <small>{formatShortDate(point.date)}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="forecast-empty-inline">Limited historical data available.</div>
        )}
      </div>

      <div className="forecast-next-panel panel">
        <div className="panel-heading forecast-panel-heading">
          <div>
            <span className="kicker">NEXT {forecastDays} DAYS</span>
            <h3>Predicted demand</h3>
          </div>
        </div>

        <div className="forecast-day-grid">
          {forecast.map((item) => (
            <div key={item.date || `${item.predictedDemand}-${Math.random()}`} className="forecast-day-card">
              <div className="forecast-day-date">{formatLongDate(item.date)}</div>
              <div className="forecast-day-value">{toNumber(item.predictedDemand)} units</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
