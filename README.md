# StockSense

StockSense is a retail inventory and demand platform covering authentication, products, stores, inventory, sales, analytics, demand forecasting, inventory risk, replenishment recommendations, and store mapping.

## Architecture

```text
React + Vite frontend -> Node.js + Express backend -> MongoDB Atlas
                                      |
                                      -> FastAPI ML service
```

The only project services are `frontend`, `backend`, and `ml`.

## Requirements

- Node.js 20+ and npm
- Python 3.13 (Python 3.11+ is suitable)
- MongoDB Atlas or a compatible MongoDB instance

## Configuration

Copy `backend/.env.example` to `backend/.env` and provide real local values. Never commit `.env` files. The frontend may use `frontend/.env` with `VITE_API_URL`; frontend variables are public and must not contain secrets.

Important variables:

- `MONGO_URI`
- `JWT_SECRET`
- `PORT`
- `ML_SERVICE_URL`
- `FRONTEND_URL`

## Run Locally

Backend:

```powershell
cd C:\StockSense\backend
npm install
npm run dev
```

Frontend:

```powershell
cd C:\StockSense\frontend
npm install
npm run dev
```

ML service:

```powershell
cd C:\StockSense\ml
py -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## Initial Admin Setup

Public registration cannot create Admin accounts. To create the shop's first Admin, set `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD` in `backend/.env`, then run:

```powershell
cd C:\StockSense\backend
npm run setup:admin
```

The command refuses to create another Admin, reports duplicate Admin accounts without changing users, and installs a partial unique index for the Admin role. Clear the `INITIAL_ADMIN_*` values after setup. Admins create any number of Managers, Cashiers, and Inventory Staff accounts from User Management.

## API Areas

- `/api/auth`
- `/api/products`
- `/api/stores`
- `/api/inventory`
- `/api/sales`
- `/api/analytics`
- `/api/forecast`
- `/api/replenishment`
- `/api/stores/map`

The backend protects business APIs with JWT authentication. The ML service exposes `/health`, `/data/validate`, `/forecast`, and `/risk/replenishment`.

## Testing and Builds

```powershell
cd C:\StockSense\ml
venv\Scripts\activate
pytest

cd C:\StockSense\frontend
npm run build
npm run preview
```

The backend production command is `npm start`.

## Implementation Notes

- Forecasting uses a weighted moving-average baseline and depends on historical sales volume.
- Risk and replenishment are deterministic recommendations, not automatic purchasing.
- Stores without manually supplied coordinates do not appear on the map.
- Store mapping uses React Leaflet and OpenStreetMap development tiles; no automatic geocoding or browser location tracking is used.
- Production deployment should provide separate environment configuration for the frontend, backend, ML service, and MongoDB.