const API_BASE = import.meta.env.VITE_API_URL || "https://stocksense-backend-api-noah.onrender.com/api";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("stocksense_token");
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let payload = {};
  try { payload = await response.json(); } catch { payload = {}; }
  const currentToken = localStorage.getItem("stocksense_token");
  if (response.status === 401 && (token ? currentToken === token : !currentToken)) {
    window.dispatchEvent(new Event("stocksense:unauthorized"));
  }
  if (!response.ok) {
    const error = new Error(payload.message || (response.status >= 500 ? "Something went wrong. Please try again." : "Request could not be completed."));
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const api = {
  login: (body) => apiRequest("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  currentUser: () => apiRequest("/auth/me"),
  register: (body) => apiRequest("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  setPassword: (body) => apiRequest("/auth/set-password", { method: "POST", body: JSON.stringify(body) }),
  users: {
    list: () => apiRequest("/auth/users"),
    create: (body) => apiRequest("/auth/register", { method: "POST", body: JSON.stringify(body) }),
    resendInvitation: (body) => apiRequest("/auth/resend-invitation", { method: "POST", body: JSON.stringify(body) }),
    remove: (body) => apiRequest("/auth/remove-user", { method: "POST", body: JSON.stringify(body) }),
  },
  products: { list: () => apiRequest("/products"), create: (body) => apiRequest("/products", { method: "POST", body: JSON.stringify(body) }), update: (id, body) => apiRequest(`/products/${id}`, { method: "PUT", body: JSON.stringify(body) }), remove: (id) => apiRequest(`/products/${id}`, { method: "DELETE" }) },
  stores: { list: () => apiRequest("/stores"), create: (body) => apiRequest("/stores", { method: "POST", body: JSON.stringify(body) }), update: (id, body) => apiRequest(`/stores/${id}`, { method: "PUT", body: JSON.stringify(body) }), remove: (id) => apiRequest(`/stores/${id}`, { method: "DELETE" }) },
  storeMap: () => apiRequest("/stores/map"),
  inventory: { list: (storeId = "all") => apiRequest(`/inventory${storeId && storeId !== "all" ? `?storeId=${encodeURIComponent(storeId)}` : ""}`), lowStock: () => apiRequest("/inventory/low-stock"), create: (body) => apiRequest("/inventory", { method: "POST", body: JSON.stringify(body) }), update: (id, body) => apiRequest(`/inventory/${id}`, { method: "PUT", body: JSON.stringify(body) }), updateCurrent: (productId, storeId, body) => apiRequest(`/inventory/current/${productId}/${storeId}`, { method: "PUT", body: JSON.stringify(body) }), removeCurrent: (productId, storeId, reorderLevel) => apiRequest(`/inventory/current/${productId}/${storeId}`, { method: "DELETE", body: JSON.stringify({ reorderLevel }) }), remove: (id) => apiRequest(`/inventory/${id}`, { method: "DELETE" }) },
  sales: { list: () => apiRequest("/sales"), create: (body) => apiRequest("/sales", { method: "POST", body: JSON.stringify(body) }), remove: (id) => apiRequest(`/sales/${id}`, { method: "DELETE" }) },
  analytics: {
    summary: (params = "") => apiRequest(`/analytics/summary${params}`),
    sales: (params = "") => apiRequest(`/analytics/sales${params}`),
    products: (params = "") => apiRequest(`/analytics/products${params}`),
    stores: (params = "") => apiRequest(`/analytics/stores${params}`),
    inventory: () => apiRequest("/analytics/inventory"),
    historicalSales: (params = "") => apiRequest(`/analytics/historical-sales${params}`),
    historicalInventory: (params = "") => apiRequest(`/analytics/historical-inventory${params}`),
  },
  forecast: (body) => apiRequest("/forecast", { method: "POST", body: JSON.stringify(body) }),
  forecastProducts: (storeId) => apiRequest(`/forecast/products/${encodeURIComponent(storeId)}`),
  replenishment: (params = "") => apiRequest(`/replenishment${params}`),
};
