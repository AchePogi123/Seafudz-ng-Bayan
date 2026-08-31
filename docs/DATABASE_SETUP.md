# Seafudz ng Bayan - Backend & Database Setup Guide

This guide provides step-by-step instructions for configuring, connecting, and running the **Seafudz ng Bayan** Express.js REST API backend with a local **PostgreSQL database (via pgAdmin)** and deploying to **GCP Cloud SQL / Cloud Run**.

---

## 📋 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Environment Configuration (.env)](#2-environment-configuration-env)
3. [Local PostgreSQL & pgAdmin Setup](#3-local-postgresql--pgadmin-setup)
4. [Running Database Migrations](#4-running-database-migrations)
5. [Starting the Backend Server](#5-starting-the-backend-server)
6. [API Health Check & Endpoints](#6-api-health-check--endpoints)
7. [Troubleshooting Common Issues](#7-troubleshooting-common-issues)

---

## 1. Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v20+ (`node -v`)
- **PostgreSQL**: v13+ installed natively (or managed via pgAdmin 4)
- **pgAdmin 4**: GUI tool for managing local PostgreSQL databases

---

## 2. Environment Configuration (`.env`)

### 🟢 Backend Environment File: `Backend/.env`
Located at `file:///c:/Users/Rodel/Documents/Seafudz-ng-Bayan/Backend/.env`

```env
# Server Configuration
PORT=5000

# Local PostgreSQL Database Configuration (pgAdmin / Native PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=seafudz_db
DB_POOL_MAX=10

# GCP Cloud SQL Connection (Uncomment for production/GCP Cloud Run deployment)
# INSTANCE_CONNECTION_NAME=your-gcp-project:asia-southeast1:seafudz-db
# IP_TYPE=PUBLIC
```

> [!IMPORTANT]
> Change `DB_PASSWORD` to match the password you specified when installing PostgreSQL / pgAdmin.

### 🔵 Frontend Environment File: `Frontend/.env`
Located at `file:///c:/Users/Rodel/Documents/Seafudz-ng-Bayan/Frontend/.env`

```env
# Supabase Authentication Configuration
VITE_SUPABASE_URL=https://nvtozwvlbjqbujnzafoh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_mSRd5dUpuEeF0OcFHdSAKg_13Ay72-K

# Backend REST API Endpoint
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 3. Local PostgreSQL & pgAdmin Setup

1. Open **pgAdmin 4** on your machine.
2. Connect to your local server (default: `localhost:5432`).
3. Create a new database named **`seafudz_db`**:
   - Right-click **Databases** ➔ **Create** ➔ **Database...**
   - Database Name: `seafudz_db`
   - Owner: `postgres`
   - Click **Save**.
4. Import the initial database schema:
   - Right-click `seafudz_db` ➔ **Query Tool**.
   - Open the SQL script located at `file:///c:/Users/Rodel/Documents/Seafudz-ng-Bayan/gcp_cloudsql_schema.sql`.
   - Click **Execute (F5)** to create all tables (`menu_items`, `categories`, `orders`, `order_items`, `tables`, `assistant_calls`, `employees`, etc.).

---

## 4. Running Database Migrations

You can run automated schema migrations using the built-in migration tool:

```bash
# Navigate to the Backend directory
cd Backend

# Run pending migrations
npm run migrate

# Create a new migration file (optional)
npm run migrate:create add_new_column_name
```

---

## 5. Starting the Backend Server

```bash
# Navigate to the Backend folder
cd Backend

# Install dependencies (if not already installed)
npm install

# Option A: Start in development watch mode (reloads automatically on file changes)
npm run dev

# Option B: Start in standard production mode
npm start
```

---

## 6. API Health Check & Endpoints

Once started, test your connection by visiting:
- **Health Check Endpoint**: `GET http://localhost:5000/api/health`

### Main REST API Routes:
| Feature | Method | Endpoint |
| :--- | :--- | :--- |
| **Menu Catalog** | `GET` | `http://localhost:5000/api/menu` |
| **POS & Orders** | `GET` / `POST` | `http://localhost:5000/api/orders` |
| **Kitchen Queue** | `GET` | `http://localhost:5000/api/kitchen/orders` |
| **Rider Deliveries** | `GET` | `http://localhost:5000/api/rider/deliveries` |
| **Assistant Calls** | `GET` / `POST` | `http://localhost:5000/api/assistant/calls` |
| **Sales Analytics** | `GET` | `http://localhost:5000/api/sales/summary` |
| **Auth & Users** | `POST` | `http://localhost:5000/api/auth/login` |

---

## 7. Troubleshooting Common Issues

### ❌ `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`
- **Cause**: PostgreSQL driver expects `DB_PASSWORD` to be a string type.
- **Fix**: Ensure `DB_PASSWORD` in `Backend/.env` is set to your password string (e.g., `DB_PASSWORD=postgres`).

### ❌ `Port 5000 is already in use by another process`
- **Cause**: An existing `node server.js` process is already running on port 5000.
- **Fix (Windows)**:
  ```powershell
  # Find process ID running on port 5000
  netstat -ano | findstr :5000
  
  # Stop the process (replace <PID> with the number from above)
  taskkill /PID <PID> /F
  ```
  *Or change `PORT=5001` in `Backend/.env`.*

### ❌ `password authentication failed for user "postgres"`
- **Cause**: Incorrect database password in `Backend/.env`.
- **Fix**: Open `Backend/.env` and set `DB_PASSWORD` to the exact master password configured in pgAdmin.
