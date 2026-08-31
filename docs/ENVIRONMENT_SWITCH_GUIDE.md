# 🛠️ Environment Switch Guide (GCP Cloud vs. Local Docker)

This guide explains how to toggle the application environment between **Local Docker Development Mode** and **GCP Cloud Production Mode** by modifying the `.env` files in `Frontend/` and `Backend/`.

---

## 📍 Quick Overview

| Environment Mode | Backend URL (`Frontend/.env`) | DB Host (`Backend/.env`) | DB Port |
| :--- | :--- | :--- | :--- |
| **Local Docker (Default)** | `http://localhost:5000/api` | `localhost` | `5433` |
| **GCP Cloud Run / Cloud SQL** | `https://seafudz-backend-925771991157.asia-southeast1.run.app/api` | GCP Cloud SQL Connector | `5432` |

---

## 1. Local Docker Setup (Development)

To run the application locally using the **Docker PostgreSQL container (`seafudz_postgres`)** and local Express API server:

### A. Update `Frontend/.env`
Comment out the GCP Cloud Run URL and enable `http://localhost:5000/api`:

```env
VITE_SUPABASE_URL=https://nvtozwvlbjqbujnzafoh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_mSRd5dUpuEeF0OcFHdSAKg_13Ay72-K

# Commented out GCP Cloud Run URL for local development:
# VITE_GCP_API_URL=https://seafudz-backend-925771991157.asia-southeast1.run.app/api

# Local Express Backend API URL:
VITE_GCP_API_URL=http://localhost:5000/api
```

### B. Update `Backend/.env`
Ensure the backend connects to your local Docker container on port `5433`:

```env
PORT=5000
NODE_ENV=development

# Database Connection Details (Local Docker Postgres)
DB_USER=postgres
DB_PASSWORD=postgrespassword
DB_NAME=seafudz_db
DB_HOST=localhost
DB_PORT=5433
DB_POOL_MAX=10

# Comment out or leave empty to disable GCP Cloud SQL Connector:
# INSTANCE_CONNECTION_NAME=
```

---

## 2. GCP Cloud Setup (Production Deployment)

When deploying or testing against live Google Cloud Platform (GCP Cloud Run & GCP Cloud SQL):

### A. Update `Frontend/.env`
Point the frontend to the deployed GCP Cloud Run service:

```env
VITE_SUPABASE_URL=https://nvtozwvlbjqbujnzafoh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_mSRd5dUpuEeF0OcFHdSAKg_13Ay72-K

# GCP Cloud Run Production API:
VITE_GCP_API_URL=https://seafudz-backend-925771991157.asia-southeast1.run.app/api

# Local fallback (commented out):
# VITE_GCP_API_URL=http://localhost:5000/api
```

### B. Update `Backend/.env`
Enable the GCP Cloud SQL Connector:

```env
PORT=8080
NODE_ENV=production

# GCP Cloud SQL Connection Instance Name
INSTANCE_CONNECTION_NAME=seafudz-ng-bayan:asia-southeast1:seafudz-db-instance
IP_TYPE=PUBLIC

DB_USER=postgres
DB_PASSWORD=your_gcp_db_password
DB_NAME=seafudz_db
```

---

## ⚡ Applying Changes

Whenever you modify `.env` files:

1. Restart your development server from the root directory:
   ```bash
   ./start-dev.sh
   # or
   npm run dev
   ```
2. Refresh your browser at `http://localhost:5173`.
