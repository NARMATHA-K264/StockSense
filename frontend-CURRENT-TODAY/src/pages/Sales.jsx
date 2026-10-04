import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import Loading from "../components/Loading";
import { EmptyState, ErrorMessage, SuccessMessage } from "../components/Feedback";
import FormModal from "../components/FormModal";
import { Toolbar } from "./Products";

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const formatDate = (value) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState({ product: "", store: "", unitsSold: "" });
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState("latest");

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([api.sales.list(), api.products.list(), api.stores.list()])
      .then(([salesData, productData, storeData]) => {
        setSales(salesData.sales || []);
        setProducts(productData.products || []);
        setStores(storeData.stores || []);
      })
      .catch(() => setError("Unable to load sales."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const overview = useMemo(() => {
    const totalSales = sales.length;
    const totalUnits = sales.reduce((sum, sale) => sum + Number(sale.unitsSold || 0), 0);
    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
    const averageSale = totalSales ? totalRevenue / totalSales : 0;

    return { totalSales, totalUnits, totalRevenue, averageSale };
  }, [sales]);

  const filteredSales = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    let result = [...sales];

    result = result.filter((sale) => {
      const productName = sale.product?.name || "";
      const sku = sale.product?.sku || "";
      const matchesText = !query || productName.toLowerCase().includes(query) || sku.toLowerCase().includes(query);
      const matchesStore = storeFilter === "all" || String(sale.store?._id || "") === String(storeFilter);

      let matchesDate = true;
      const saleDate = new Date(sale.saleDate);
      if (Number.isNaN(saleDate.getTime())) return false;

      if (dateFilter === "custom") {
        const from = fromDate ? new Date(fromDate) : null;
        const to = toDate ? new Date(toDate) : null;
        if (from && saleDate < from) matchesDate = false;
        if (to && saleDate > new Date(`${toDate}T23:59:59`)) matchesDate = false;
      } else if (dateFilter === "last7") {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        matchesDate = saleDate >= cutoff;
      } else if (dateFilter === "last30") {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        matchesDate = saleDate >= cutoff;
      }

      return matchesText && matchesStore && matchesDate;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.saleDate) - new Date(b.saleDate);
        case "highest":
          return Number(b.totalAmount || 0) - Number(a.totalAmount || 0);
        case "lowest":
          return Number(a.totalAmount || 0) - Number(b.totalAmount || 0);
        case "units":
          return Number(b.unitsSold || 0) - Number(a.unitsSold || 0);
        case "latest":
        default:
          return new Date(b.saleDate) - new Date(a.saleDate);
      }
    });

    return result;
  }, [sales, searchTerm, storeFilter, dateFilter, fromDate, toDate, sortBy]);

  const submit = async (event) => {
    event.preventDefault();
    const unitsSold = Number(form.unitsSold);

    if (!form.product || !form.store || !Number.isInteger(unitsSold) || unitsSold < 1) {
      return setError("Select a product, store, and at least 1 unit.");
    }

    try {
      await api.sales.create({ product: form.product, store: form.store, unitsSold });
      setModal(false);
      setForm({ product: "", store: "", unitsSold: "" });
      setSuccess("Sale recorded and inventory updated.");
      setError("");
      load();
    } catch (err) {
      setError(err.message === "Insufficient stock" ? "Insufficient stock. Sale could not be completed." : err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this sale?\n\nDeleting this sale may restore the corresponding inventory quantity.")) return;

    try {
      await api.sales.remove(id);
      setSuccess("Sale deleted and inventory restored.");
      setError("");
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <Toolbar
        eyebrow="STOCKSENSE / SALES"
        title="Sales ledger"
        description="Record movement and keep the stock position current."
        action="Record sale"
        onAction={() => {
          setModal(true);
          setError("");
        }}
      />

      <ErrorMessage message={error} />
      <SuccessMessage message={success} />

      {loading ? (
        <div className="sales-skeleton-box">
          <div className="sales-skeleton-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="sales-skeleton-card" key={index} />
            ))}
          </div>
          <div className="sales-skeleton-table">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="sales-skeleton-row" key={index} />
            ))}
          </div>
        </div>
      ) : (
        <>
          <section className="sales-overview-grid">
            <div className="metric-card green">
              <div className="metric-top">
                <span>Total sales</span>
                <i>◫</i>
              </div>
              <strong>{overview.totalSales}</strong>
              <small>Transactions</small>
            </div>
            <div className="metric-card blue">
              <div className="metric-top">
                <span>Units sold</span>
                <i>▤</i>
              </div>
              <strong>{overview.totalUnits}</strong>
              <small>Total units</small>
            </div>
            <div className="metric-card amber">
              <div className="metric-top">
                <span>Total revenue</span>
                <i>₹</i>
              </div>
              <strong>{money(overview.totalRevenue)}</strong>
              <small>Recorded revenue</small>
            </div>
            <div className="metric-card red">
              <div className="metric-top">
                <span>Average sale</span>
                <i>↗</i>
              </div>
              <strong>{money(overview.averageSale)}</strong>
              <small>Per transaction</small>
            </div>
          </section>

          <section className="panel sales-toolbar-panel">
            <div className="inventory-filters sales-toolbar">
              <label className="field-inline search-field sales-search-field">
                <span>Search</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search product or SKU"
                />
              </label>

              <label className="field-inline">
                <span>Store</span>
                <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
                  <option value="all">All stores</option>
                  {stores.map((store) => (
                    <option key={store._id} value={store._id}>{store.name}</option>
                  ))}
                </select>
              </label>

              <label className="field-inline">
                <span>Date</span>
                <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
                  <option value="all">All dates</option>
                  <option value="last7">Last 7 days</option>
                  <option value="last30">Last 30 days</option>
                  <option value="custom">Custom range</option>
                </select>
              </label>

              <label className="field-inline">
                <span>Sort</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="latest">Latest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="highest">Highest amount</option>
                  <option value="lowest">Lowest amount</option>
                  <option value="units">Most units</option>
                </select>
              </label>
            </div>

            {dateFilter === "custom" && (
              <div className="sales-date-range">
                <label className="field-inline">
                  <span>From</span>
                  <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                </label>
                <label className="field-inline">
                  <span>To</span>
                  <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                </label>
              </div>
            )}
          </section>

          {error ? (
            <div className="empty error-panel">
              <strong>Unable to load sales.</strong>
              <p className="empty-text">The sales ledger could not be loaded from the current API response.</p>
              <button className="primary" onClick={load}>Try Again</button>
            </div>
          ) : filteredSales.length ? (
            <>
              <div className="table-panel sales-table-panel">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Store</th>
                      <th>Units</th>
                      <th>Unit price</th>
                      <th>Total</th>
                      <th>Sale date</th>
                      <th>Sold by</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSales.map((sale) => (
                      <tr key={sale._id}>
                        <td>
                          <div className="product-cell">
                            <b>{sale.product?.name || "Product"}</b>
                            <small>{sale.product?.sku || "—"}</small>
                          </div>
                        </td>
                        <td>
                          <div className="store-cell">
                            <b>{sale.store?.name || "Store"}</b>
                            <small>{sale.store?.location || "—"}</small>
                          </div>
                        </td>
                        <td>{sale.unitsSold}</td>
                        <td>{money(sale.unitPrice)}</td>
                        <td>
                          <b>{money(sale.totalAmount)}</b>
                        </td>
                        <td>{formatDate(sale.saleDate)}</td>
                        <td>
                          <div className="sold-by-cell">
                            <b>{sale.soldBy?.name || "—"}</b>
                            <small>{sale.soldBy?.email || "—"}</small>
                          </div>
                        </td>
                        <td className="actions">
                          <button type="button" className="danger-text" onClick={() => remove(sale._id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sales-mobile-list">
                {filteredSales.map((sale) => (
                  <article className="sales-mobile-card" key={sale._id}>
                    <div className="sales-mobile-header">
                      <div>
                        <h4>{sale.product?.name || "Product"}</h4>
                        <small>{sale.product?.sku || "—"}</small>
                      </div>
                      <strong>{money(sale.totalAmount)}</strong>
                    </div>

                    <div className="sales-mobile-meta">
                      <span>{sale.store?.name || "Store"}</span>
                      <span>{sale.store?.location || "—"}</span>
                    </div>

                    <div className="sales-mobile-detail">
                      <span>{sale.unitsSold} units × {money(sale.unitPrice)}</span>
                      <span>{formatDate(sale.saleDate)}</span>
                      <span>Sold by {sale.soldBy?.name || "—"}</span>
                    </div>

                    <button type="button" className="text-button danger" onClick={() => remove(sale._id)}>
                      Delete
                    </button>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title={sales.length ? "No sales match your filters." : "No sales recorded yet"}
              text={sales.length ? "Try a different search or date range." : "Record your first sale to start tracking revenue."}
              action={<button className="primary" onClick={() => setModal(true)}>+ Record Sale</button>}
            />
          )}
        </>
      )}

      {modal && (
        <FormModal title="Record a sale" onClose={() => setModal(false)}>
          <form onSubmit={submit} className="modal-form">
            <label>
              Product
              <select value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })}>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product._id} value={product._id}>{product.name} · {product.sku} · {money(product.price)}</option>
                ))}
              </select>
            </label>

            <label>
              Store
              <select value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })}>
                <option value="">Select store</option>
                {stores.map((store) => (
                  <option key={store._id} value={store._id}>{store.name} · {store.location}</option>
                ))}
              </select>
            </label>

            <label>
              Units sold
              <input type="number" min="1" step="1" value={form.unitsSold} onChange={(e) => setForm({ ...form, unitsSold: e.target.value })} />
            </label>

            <p className="form-note">Price and inventory reduction are calculated by the backend.</p>
            <ErrorMessage message={error} />
            <button type="submit" className="primary full">Record sale</button>
          </form>
        </FormModal>
      )}
    </>
  );
}

