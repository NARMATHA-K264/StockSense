import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import Loading from "../components/Loading";
import { EmptyState, ErrorMessage, SuccessMessage } from "../components/Feedback";
import FormModal from "../components/FormModal";

const blank = { name: "", sku: "", category: "", price: "", costPrice: "", reorderLevel: "10", supplier: "", description: "" };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([api.products.list(), api.inventory.lowStock()])
      .then(([productData, inventoryData]) => {
        setProducts(productData.products || []);
        setInventory(inventoryData.inventory || []);
      })
      .catch((err) => setError(err.message || "Unable to load products."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const categories = new Set(products.filter((product) => product.category).map((product) => product.category));
    const suppliers = new Set(products.filter((product) => product.supplier).map((product) => product.supplier));

    return {
      total: products.length,
      categories: categories.size,
      suppliers: suppliers.size,
      nearReorder: inventory.length,
    };
  }, [products, inventory]);

  const categories = useMemo(() => ["all", ...new Set(products.map((product) => product.category).filter(Boolean))], [products]);
  const suppliers = useMemo(() => ["all", ...new Set(products.map((product) => product.supplier).filter(Boolean))], [products]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        (product.name || "").toLowerCase().includes(query) ||
        (product.sku || "").toLowerCase().includes(query);

      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
      const matchesSupplier = supplierFilter === "all" || product.supplier === supplierFilter;

      return matchesSearch && matchesCategory && matchesSupplier;
    });
  }, [products, searchTerm, categoryFilter, supplierFilter]);

  const open = (product) => {
    setEditing(product?._id || null);
    setForm(product ? { ...blank, ...product } : blank);
    setModal(true);
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    const payload = {
      ...form,
      price: Number(form.price),
      costPrice: Number(form.costPrice),
      reorderLevel: Number(form.reorderLevel),
    };

    if (!payload.name || !payload.sku || !payload.category || [payload.price, payload.costPrice, payload.reorderLevel].some((value) => Number.isNaN(value) || value < 0)) {
      return setError("Complete all required fields with valid non-negative numbers.");
    }

    try {
      if (editing) await api.products.update(editing, payload);
      else await api.products.create(payload);

      setModal(false);
      setSuccess(editing ? "Product updated." : "Product created.");
      load();
    } catch (err) {
      setError(err.message || "Unable to save product.");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this product?")) return;

    try {
      await api.products.remove(id);
      setSuccess("Product deleted.");
      load();
    } catch (err) {
      setError(err.message || "Unable to delete product.");
    }
  };

  return (
    <>
      <Toolbar
        eyebrow="Catalog / products"
        title="Product catalog"
        description="Keep pricing, supplier, and replenishment context in one place."
        action="Add product"
        onAction={() => open()}
      />

      <ErrorMessage message={error} />
      <SuccessMessage message={success} />

      {loading ? (
        <Loading label="Loading products" />
      ) : (
        <>
          <div className="product-overview-grid">
            <div className="metric-card green">
              <div className="metric-top">
                <span>Total products</span>
                <i>▦</i>
              </div>
              <strong>{summary.total}</strong>
              <small>Active catalog</small>
            </div>
            <div className="metric-card blue">
              <div className="metric-top">
                <span>Categories</span>
                <i>◫</i>
              </div>
              <strong>{summary.categories}</strong>
              <small>Product groups</small>
            </div>
            <div className="metric-card amber">
              <div className="metric-top">
                <span>Suppliers</span>
                <i>◌</i>
              </div>
              <strong>{summary.suppliers}</strong>
              <small>Active suppliers</small>
            </div>
            <div className="metric-card red">
              <div className="metric-top">
                <span>Near reorder</span>
                <i>!</i>
              </div>
              <strong>{summary.nearReorder}</strong>
              <small>Needs attention</small>
            </div>
          </div>

          <div className="inventory-toolbar panel product-toolbar-panel">
            <div className="inventory-filters product-filters">
              <label className="field-inline search-field product-search-field">
                <span>Search</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search product name or SKU"
                />
              </label>

              <label className="field-inline">
                <span>Category</span>
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  {categories.map((value) => (
                    <option key={value} value={value}>{value === "all" ? "All" : value}</option>
                  ))}
                </select>
              </label>

              <label className="field-inline">
                <span>Supplier</span>
                <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}>
                  {suppliers.map((value) => (
                    <option key={value} value={value}>{value === "all" ? "All" : value}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {products.length ? (
            filteredProducts.length ? (
              <div className="table-panel product-table-panel">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th>Cost</th>
                      <th>Price</th>
                      <th>Reorder</th>
                      <th>Supplier</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product._id}>
                        <td>
                          <div className="product-cell">
                            <b>{product.name}</b>
                            <small>{product.description || "No description yet"}</small>
                          </div>
                        </td>
                        <td><span className="sku-text">{product.sku}</span></td>
                        <td>{product.category}</td>
                        <td>₹{Number(product.costPrice || 0).toLocaleString()}</td>
                        <td>₹{Number(product.price || 0).toLocaleString()}</td>
                        <td>{product.reorderLevel}</td>
                        <td>{product.supplier || "—"}</td>
                        <td className="actions">
                          <button type="button" onClick={() => open(product)}>Edit</button>
                          <button type="button" className="danger-text" onClick={() => remove(product._id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No products match your search." action={<button className="primary" onClick={() => open()}>Add product</button>} />
            )
          ) : (
            <EmptyState title="No products yet" action={<button className="primary" onClick={() => open()}>+ Add Product</button>} />
          )}
        </>
      )}

      {modal && (
        <FormModal title={editing ? "Edit product" : "Add product"} onClose={() => setModal(false)}>
          <form onSubmit={submit} className="modal-form">
            <div className="form-grid">
              <label>
                Product name
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dairy milk" />
              </label>

              <label>
                SKU
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU-001" />
              </label>
            </div>

            <div className="form-grid">
              <label>
                Category
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Beverages" />
              </label>

              <label>
                Supplier
                <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Vendor name" />
              </label>
            </div>

            <div className="form-grid">
              <label>
                Cost price
                <input type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} placeholder="0" />
              </label>

              <label>
                Selling price
                <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" />
              </label>
            </div>

            <label>
              Reorder level
              <input type="number" min="0" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
            </label>

            <label>
              Description
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
            </label>

            <button type="submit" className="primary full">
              {editing ? "Update product" : "Create product"}
              <span>→</span>
            </button>
          </form>
        </FormModal>
      )}
    </>
  );
}

export function Toolbar({ eyebrow, title, description, action, onAction }) {
  return (
    <section className="page-intro">
      <div>
        <span className="kicker">{eyebrow}</span>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
      <button className="primary" onClick={onAction}>
        + {action}
      </button>
    </section>
  );
}