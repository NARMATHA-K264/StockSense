import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import Loading from "../components/Loading";
import { EmptyState, ErrorMessage, SuccessMessage } from "../components/Feedback";
import FormModal from "../components/FormModal";
import { Toolbar } from "./Products";

const emptyForm = { name: "", location: "", latitude: "", longitude: "" };

const hasValidCoordinates = (store) => {
  const latitude = Number(store?.latitude);
  const longitude = Number(store?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
};

export default function Stores() {
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");

  const load = () => {
    setLoading(true);
    setError("");
    api.stores
      .list()
      .then((data) => setStores(data.stores || []))
      .catch((err) => setError(err.message || "Unable to load stores."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = stores.length;
    const mapped = stores.filter((store) => hasValidCoordinates(store)).length;
    return { total, mapped, unmapped: total - mapped };
  }, [stores]);

  const filteredStores = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const sorted = [...stores].sort((a, b) => {
      if (sortBy === "name-asc") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "name-desc") return (b.name || "").localeCompare(a.name || "");
      if (sortBy === "location-asc") return (a.location || "").localeCompare(b.location || "");
      return (new Date(b.updatedAt || b.createdAt || 0).getTime() || 0) - (new Date(a.updatedAt || a.createdAt || 0).getTime() || 0);
    });

    return sorted.filter((store) => {
      const matchesSearch =
        !query ||
        (store.name || "").toLowerCase().includes(query) ||
        (store.location || "").toLowerCase().includes(query) ||
        (store.manager?.name || "").toLowerCase().includes(query);

      const matchesLocation = locationFilter === "all" || (store.location || "").toLowerCase().includes(locationFilter.toLowerCase());
      return matchesSearch && matchesLocation;
    });
  }, [stores, searchTerm, locationFilter, sortBy]);

  const open = (store) => {
    setEditing(store?._id || null);
    setForm(
      store ? { name: store.name, location: store.location, latitude: store.latitude ?? "", longitude: store.longitude ?? "" } : emptyForm
    );
    setError("");
    setModal(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    const hasLat = form.latitude !== "";
    const hasLng = form.longitude !== "";
    const latitude = hasLat ? Number(form.latitude) : undefined;
    const longitude = hasLng ? Number(form.longitude) : undefined;

    if (!form.name.trim() || !form.location.trim()) {
      return setError("Store name and location are required.");
    }

    if (hasLat !== hasLng) {
      return setError("Latitude and longitude must be provided together.");
    }

    if (
      (hasLat && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (hasLng && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
    ) {
      return setError("Latitude must be between -90 and 90 and longitude between -180 and 180.");
    }

    try {
      const payload = {
        name: form.name,
        location: form.location,
        ...(hasLat ? { latitude, longitude } : {}),
      };

      if (editing) {
        await api.stores.update(editing, payload);
      } else {
        await api.stores.create(payload);
      }

      setModal(false);
      setSuccess(editing ? "Store updated." : "Store created.");
      load();
    } catch (err) {
      setError(err.message || "Unable to save store.");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this store?")) return;

    try {
      await api.stores.remove(id);
      setSuccess("Store deleted.");
      load();
    } catch (err) {
      setError(err.message || "Unable to delete store.");
    }
  };

  const locationOptions = ["all", ...new Set(stores.map((store) => (store.location || "").trim()).filter(Boolean))];

  return (
    <>
      <Toolbar
        eyebrow="NETWORK / STORES"
        title="Store network"
        description="Manage locations and their optional map coordinates."
        action="Add store"
        onAction={() => open()}
      />

      <ErrorMessage message={error} />
      <SuccessMessage message={success} />

      {loading ? (
        <Loading label="Loading stores" />
      ) : (
        <>
          <div className="store-summary-grid">
            <div className="store-summary-card">
              <span className="kicker">Total stores</span>
              <strong>{stats.total}</strong>
              <small>Connected locations</small>
            </div>
            <div className="store-summary-card green">
              <span className="kicker">Mapped stores</span>
              <strong>{stats.mapped}</strong>
              <small>With coordinates</small>
            </div>
            <div className="store-summary-card amber">
              <span className="kicker">Unmapped</span>
              <strong>{stats.unmapped}</strong>
              <small>Need coordinates</small>
            </div>
          </div>

          <div className="inventory-toolbar panel store-toolbar-panel">
            <div className="inventory-filters store-filters">
              <label className="field-inline search-field store-search-field">
                <span>Search</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search stores or locations"
                />
              </label>

              <label className="field-inline">
                <span>Location</span>
                <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
                  {locationOptions.map((value) => (
                    <option key={value} value={value}>{value === "all" ? "All locations" : value}</option>
                  ))}
                </select>
              </label>

              <label className="field-inline">
                <span>Sort</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="recent">Recently updated</option>
                  <option value="name-asc">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                  <option value="location-asc">Location A–Z</option>
                </select>
              </label>
            </div>
          </div>

          {filteredStores.length ? (
            <div className="store-grid">
              {filteredStores.map((store) => {
                const mapped = hasValidCoordinates(store);
                const coordsText = mapped ? `${store.latitude}, ${store.longitude}` : "Coordinates unavailable";

                return (
                  <article className="store-card" key={store._id}>
                    <div className="store-card-top">
                      <div className="store-header-left">
                        <span className="store-symbol">⌖</span>
                        <div>
                          <span className="store-badge mono-badge">{mapped ? "Mapped" : "Unmapped"}</span>
                        </div>
                      </div>
                      <span className={mapped ? "store-badge mapped" : "store-badge unmapped"}>{mapped ? "Mapped" : "Unmapped"}</span>
                    </div>

                    <div className="store-card-body">
                      <h3>{store.name}</h3>
                      <p>{store.location || "Location unavailable"}</p>

                      <div className="store-meta">
                        <div className="store-meta-row">
                          <span className="store-label">Manager</span>
                          <span>{store.manager?.name || "No manager assigned"}</span>
                        </div>
                        <div className="store-meta-row">
                          <span className="store-label">Coordinates</span>
                          <span>{coordsText}</span>
                        </div>
                      </div>
                    </div>

                    <div className="store-card-actions">
                      <button type="button" className="text-button" onClick={() => open(store)}>
                        Edit
                      </button>
                      <button type="button" className="text-button danger" onClick={() => remove(store._id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No stores match your search."
              action={<button className="primary" onClick={() => open()}>Add a store</button>}
            />
          )}
        </>
      )}

      {!loading && !stores.length && !error && (
        <EmptyState
          title="No stores yet"
          action={
            <>
              <p className="empty-text">Add your first store to start managing your network.</p>
              <button className="primary" onClick={() => open()}>+ Add Store</button>
            </>
          }
        />
      )}

      {modal && (
        <FormModal title={editing ? "Edit store" : "Add store"} onClose={() => setModal(false)}>
          <form onSubmit={submit} className="modal-form">
            <label>
              Store name
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Central warehouse"
              />
            </label>

            <label>
              Location
              <input
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                placeholder="Chennai, Tamil Nadu"
              />
            </label>

            <div className="form-grid">
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={form.latitude}
                  onChange={(event) => setForm({ ...form, latitude: event.target.value })}
                  placeholder="Optional"
                />
              </label>

              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={form.longitude}
                  onChange={(event) => setForm({ ...form, longitude: event.target.value })}
                  placeholder="Optional"
                />
              </label>
            </div>

            <button type="submit" className="primary full">
              {editing ? "Save changes" : "Create store"}
              <span>→</span>
            </button>
          </form>
        </FormModal>
      )}
    </>
  );
}
