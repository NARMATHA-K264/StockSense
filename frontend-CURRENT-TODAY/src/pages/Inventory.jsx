import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import Loading from "../components/Loading";
import { EmptyState, ErrorMessage, SuccessMessage } from "../components/Feedback";
import FormModal from "../components/FormModal";
import { Toolbar } from "./Products";

const emptyForm = { product: "", store: "", quantity: "", reorderLevel: "10" };
const statusOptions = [
  { value: "all", label: "All" },
  { value: "in-stock", label: "In Stock" },
  { value: "low-stock", label: "Low Stock" },
  { value: "out-of-stock", label: "Out of Stock" },
];

const getInventoryStatus = (item) => {
  const quantity = Number(item?.quantity ?? 0);
  const reorderLevel = Number(item?.reorderLevel ?? 0);

  if (quantity === 0) return "Out of Stock";
  if (quantity <= reorderLevel) return "Low Stock";
  return "In Stock";
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const statusClass = (status) => status.toLowerCase().replace(/\s+/g, "-");

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("stock-desc");

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([api.inventory.list(storeFilter), api.products.list(), api.stores.list()])
      .then(([items, productData, storeData]) => {
        const normalized = (items.inventory || []).map((item) => ({
          ...item,
          status: getInventoryStatus(item),
        }));

        setInventory(normalized);
        setProducts(productData.products || []);
        setStores(storeData.stores || []);
      })
      .catch((err) => setError(err.message || "Unable to load inventory."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [storeFilter]);

  const summary = useMemo(() => {
    const counts = { total: inventory.length, inStock: 0, lowStock: 0, outOfStock: 0 };

    inventory.forEach((item) => {
      if (item.status === "In Stock") counts.inStock += 1;
      if (item.status === "Low Stock") counts.lowStock += 1;
      if (item.status === "Out of Stock") counts.outOfStock += 1;
    });

    return counts;
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const sorted = [...inventory].sort((a, b) => {
      if (sortBy === "name-asc") return (a.product?.name || "").localeCompare(b.product?.name || "");
      if (sortBy === "name-desc") return (b.product?.name || "").localeCompare(a.product?.name || "");
      if (sortBy === "stock-asc") return Number(a.quantity || 0) - Number(b.quantity || 0);
      if (sortBy === "stock-desc") return Number(b.quantity || 0) - Number(a.quantity || 0);
      return new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
    });

    return sorted.filter((item) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "in-stock" && item.status === "In Stock") ||
        (statusFilter === "low-stock" && item.status === "Low Stock") ||
        (statusFilter === "out-of-stock" && item.status === "Out of Stock");

      const itemStoreId = item.store?._id ?? item.store;
      const matchesStore =
        storeFilter === "all" || String(itemStoreId ?? "") === String(storeFilter);

      const matchesSearch =
        !query ||
        (item.product?.name || "").toLowerCase().includes(query) ||
        (item.product?.sku || "").toLowerCase().includes(query) ||
        (item.product?.name || "").replace(/\s+/g, "").toLowerCase().includes(query.replace(/\s+/g, ""));

      return matchesStatus && matchesStore && matchesSearch;
    });
  }, [inventory, searchTerm, statusFilter, storeFilter, sortBy]);

  const open = (item) => {
    setEditing(
      item
        ? {
            id: item._id,
            source: item.source || "operational",
            productId: item.product?._id || "",
            storeId: item.store?._id || "",
          }
        : null
    );
    setForm(
      item ? { product: item.product?._id || "", store: item.store?._id || "", quantity: item.quantity, reorderLevel: item.reorderLevel } : emptyForm
    );
    setModal(true);
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    const reorderLevel = Number(form.reorderLevel);

    if (!editing && (!form.product || !form.store)) {
      return setError("Product and store are required.");
    }

    if ([quantity, reorderLevel].some((value) => Number.isNaN(value) || value < 0)) {
      return setError("Quantity and reorder level cannot be negative.");
    }

    try {
      if (editing) {
        if (editing.source === "historical") {
          await api.inventory.updateCurrent(editing.productId, editing.storeId, { quantity, reorderLevel });
        } else {
          await api.inventory.update(editing.id, { quantity, reorderLevel });
        }
      } else {
        await api.inventory.create({ product: form.product, store: form.store, quantity, reorderLevel });
      }

      setModal(false);
      setSuccess(editing ? "Inventory updated." : "Inventory record created.");
      load();
    } catch (err) {
      setError(err.message || "Unable to save inventory.");
    }
  };

  const remove = async (item) => {
    const historicalFallback = item.source === "historical";
    const confirmation = historicalFallback
      ? "Set current quantity to zero? The historical inventory snapshot will be retained."
      : "Delete this inventory record?";
    if (!window.confirm(confirmation)) return;

    try {
      if (historicalFallback) {
        await api.inventory.removeCurrent(item.product._id, item.store._id, item.reorderLevel);
        setSuccess("Current quantity set to zero. Historical inventory was retained.");
      } else {
        await api.inventory.remove(item._id);
        setSuccess("Inventory deleted.");
      }
      load();
    } catch (err) {
      setError(err.message || "Unable to delete inventory.");
    }
  };

  return (
    <>
      <Toolbar
        eyebrow="CONTROL / INVENTORY"
        title="Inventory control"
        description="Track product availability across every connected location."
        action="Add inventory"
        onAction={() => open()}
      />

      <ErrorMessage message={error} />
      <SuccessMessage message={success} />

      {loading ? (
        <Loading label="Loading inventory" />
      ) : inventory.length ? (
        <>
          <div className="inventory-summary-grid">
            <div className="metric-card green">
              <div className="metric-top">
                <span>Total records</span>
                <i>∑</i>
              </div>
              <strong>{summary.total}</strong>
              <small>Across all stores</small>
            </div>

            <div className="metric-card green">
              <div className="metric-top">
                <span>In stock</span>
                <i>✓</i>
              </div>
              <strong>{summary.inStock}</strong>
              <small>Healthy inventory</small>
            </div>

            <div className="metric-card amber">
              <div className="metric-top">
                <span>Low stock</span>
                <i>!</i>
              </div>
              <strong>{summary.lowStock}</strong>
              <small>Needs attention</small>
            </div>

            <div className="metric-card red">
              <div className="metric-top">
                <span>Out of stock</span>
                <i>◌</i>
              </div>
              <strong>{summary.outOfStock}</strong>
              <small>Unavailable now</small>
            </div>
          </div>

          <div className="inventory-toolbar panel">
            <div className="inventory-filters">
              <label className="field-inline search-field">
                <span>Search</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search product or SKU"
                />
              </label>

              <div className="filter-group status-filter-group">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={statusFilter === option.value ? "filter-pill active" : "filter-pill"}
                    onClick={() => setStatusFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <label className="field-inline">
                <span>Store</span>
                <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
                  <option value="all">All Stores</option>
                  {stores.map((store) => (
                    <option key={store._id} value={store._id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-inline">
                <span>Sort</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="stock-desc">Stock level</option>
                  <option value="stock-asc">Lowest stock</option>
                  <option value="name-asc">Product A–Z</option>
                  <option value="name-desc">Product Z–A</option>
                </select>
              </label>
            </div>
          </div>

          <div className="table-panel inventory-table-panel">
            <div className="table-meta-row">
              <span className="count-label">Showing {filteredInventory.length} inventory records</span>
            </div>
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Store</th>
                  <th>Quantity</th>
                  <th>Reorder Level</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredInventory.length ? (
                  filteredInventory.map((item) => {
                    const quantityRatio = Math.max(0, Math.min(100, ((Number(item.quantity || 0) / (Number(item.reorderLevel || 1) || 1)) * 100)));

                    return (
                      <tr key={item._id}>
                        <td>
                          <div className="product-cell">
                            <b>{item.product?.name || "Unknown product"}</b>
                            <small>{item.product?.sku || "—"}</small>
                          </div>
                        </td>

                        <td>
                          <div className="store-cell">
                            <b>{item.store?.name || "Unknown store"}</b>
                            <small>{item.store?.location || "—"}</small>
                          </div>
                        </td>

                        <td>
                          <div className="quantity-cell">
                            <strong>{item.quantity} units</strong>
                            {item.status === "Low Stock" && (
                              <div className="stock-meter">
                                <span style={{ width: `${quantityRatio}%` }} />
                              </div>
                            )}
                          </div>
                        </td>

                        <td>{item.reorderLevel} units</td>

                        <td>
                          <span className={`status-badge ${statusClass(item.status)}`}>{item.status}</span>
                        </td>

                        <td>{formatDate(item.lastUpdated)}</td>

                        <td>
                          <div className="table-actions">
                            <button type="button" className="text-button" onClick={() => open(item)}>
                              Edit
                            </button>
                            <button type="button" className="text-button danger"                             onClick={() => remove(item)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7">
                      <div className="empty compact">
                        <strong>No inventory matches your filters.</strong>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState
          title="No inventory records yet"
          action={
            <>
              <p className="empty-text">Add inventory to start tracking stock across your stores.</p>
              <button className="primary" onClick={() => open()}>+ Add Inventory</button>
            </>
          }
        />
      )}

      {modal && (
        <FormModal title={editing ? "Edit inventory" : "Add inventory"} onClose={() => setModal(false)}>
          <form onSubmit={submit} className="modal-form">
            {!editing && (
              <div className="form-grid">
                <label>
                  Product
                  <select value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })}>
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product._id} value={product._id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Store
                  <select value={form.store} onChange={(event) => setForm({ ...form, store: event.target.value })}>
                    <option value="">Select store</option>
                    {stores.map((store) => (
                      <option key={store._id} value={store._id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div className="form-grid">
              <label>
                Quantity
                <input
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                />
              </label>

              <label>
                Reorder Level
                <input
                  type="number"
                  min="0"
                  value={form.reorderLevel}
                  onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })}
                />
              </label>
            </div>

            <button type="submit" className="primary full">
              {editing ? "Save changes" : "Create inventory"}
              <span>→</span>
            </button>
          </form>
        </FormModal>
      )}
    </>
  );
}
