import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

const getRiskState = (summary = {}) => {
  if (summary.criticalItems > 0) return "CRITICAL";
  if (summary.outOfStockItems > 0) return "OUT_OF_STOCK";
  if (summary.lowStockItems > 0) return "LOW";
  return "ADEQUATE";
};

function MapViewport({ stores, selected, fitAllKey }) {
  const map = useMap();

  useEffect(() => {
    if (!stores.length) return;

    if (fitAllKey > 0) {
      const bounds = stores.map((store) => [store.latitude, store.longitude]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
      return;
    }

    if (selected) {
      map.setView([selected.latitude, selected.longitude], 12, { animate: true });
      return;
    }

    if (stores.length > 1) {
      const bounds = stores.map((store) => [store.latitude, store.longitude]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
      return;
    }

    map.setView([stores[0].latitude, stores[0].longitude], 11, { animate: true });
  }, [fitAllKey, map, selected, stores]);

  return null;
}

function createStoreMarkerIcon(isSelected) {
  return L.divIcon({
    className: "store-marker-wrapper",
    html: `<div class="store-pin ${isSelected ? "selected" : ""}"><span>${isSelected ? "•" : "•"}</span></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 22],
    popupAnchor: [0, -18],
  });
}

export default function StoreMap({ stores, selected, onSelect, fitAllKey = 0 }) {
  const center = stores.length ? [stores[0].latitude, stores[0].longitude] : [20, 0];

  return (
    <MapContainer className="store-map" center={center} zoom={stores.length === 1 ? 11 : 3} scrollWheelZoom zoomControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapViewport stores={stores} selected={selected} fitAllKey={fitAllKey} />

      {stores.map((store) => {
        const summary = store.inventorySummary || {};
        const riskState = getRiskState(summary);
        const isSelected = selected && selected._id === store._id;

        return (
          <Marker
            key={store._id}
            position={[store.latitude, store.longitude]}
            eventHandlers={{ click: () => onSelect(store) }}
            icon={createStoreMarkerIcon(isSelected)}
          >
            <Popup>
              <div className="map-popup">
                <strong>{store.name}</strong>
                <span>{store.location}</span>

                <div className="map-popup-stats">
                  <div>
                    <label>Inventory items</label>
                    <b>{summary.totalItems || 0}</b>
                  </div>
                  <div>
                    <label>Total units</label>
                    <b>{summary.totalQuantity || 0}</b>
                  </div>
                  <div>
                    <label>Low stock</label>
                    <b>{summary.lowStockItems || 0}</b>
                  </div>
                  <div>
                    <label>Critical</label>
                    <b>{summary.criticalItems || 0}</b>
                  </div>
                  <div>
                    <label>Out of stock</label>
                    <b>{summary.outOfStockItems || 0}</b>
                  </div>
                </div>

                <div className="map-popup-risk">Risk: {riskState}</div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

