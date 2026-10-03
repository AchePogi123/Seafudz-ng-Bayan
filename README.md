# 🦞 Seafudz ng Bayan

**Seafudz ng Bayan** is a modern Point-of-Sale (POS), Kitchen Display System, Order Management, and Delivery tracking platform for seafood restaurants.

---

## 🏗️ Tech Stack & Architecture

- **Frontend:** React, TypeScript, Vite, Tailwind CSS (Hosted on **Firebase Hosting**)
- **Backend:** Node.js, Express (Containerized & Deployed to **GCP Cloud Run**)
- **Database:** PostgreSQL (Production: **GCP Cloud SQL**, Local Dev: **Docker Desktop**)
- **Email Service:** Resend API (6-digit OTP verification & Password Reset links)
- **Real-Time Engine:** Hybrid 3-tier sync (`BroadcastChannel`, local event bus, storage events, and automated 8s HTTP polling)
- **CI/CD Pipeline:** Google Cloud Build

---

## ✨ Key Platform Features

- 🔐 **Flexible Authentication**: Log in using **Email** or **Username** (with username editing in profile settings).
- 📧 **6-Digit OTP Email Verification**: Verifies new registration emails via Resend API.
- 🔑 **Persistent Password Reset (`/reset-password`)**: Secure token reset links with 5-minute expiry, backed by PostgreSQL `password_resets`.
- ⚡ **Automated Real-Time Order Sync**: Cross-device, zero-config real-time synchronization between Customer, POS, Kitchen KDS, Rider, and Admin views.
- 🛒 **Transparent Pricing Model**: Menu item display prices (`Base Price + 12% VAT`) with detailed base subtotal, VAT (12%), and shipping fee breakdowns.
- 🍳 **Kitchen Display System (KDS)**: Real-time ticket management, preparation timers, and availability toggles.
- 🛵 **Rider Delivery Tracking**: Live status updates and delivery routing.

---

## ⚡ Quick Start Guide (Local Development)

### 1. Prerequisites
- Node.js (v18+)
- Docker Desktop (running on your machine)

---

### 2. Start Local PostgreSQL Database (Docker)

1. Make sure **Docker Desktop** is open and running.
2. In the project root folder, start the database container:
   ```bash
   docker compose up -d
   ```
3. Docker will launch the `seafudz_postgres` container on port `5433` and automatically initialize all tables from `gcp_cloudsql_schema.sql`.

> 💡 For full details, see the detailed guide: [DOCKER_POSTGRES_SETUP.md](./DOCKER_POSTGRES_SETUP.md)

---

### 3. Run the Backend API Server

1. Navigate to the `Backend` directory:
   ```bash
   cd Backend
   ```
2. Verify environment configuration in `Backend/.env`:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=5433
   DB_USER=postgres
   DB_PASSWORD=postgrespassword
   DB_NAME=seafudz_db
   ```
3. Install dependencies and start the development server:
   ```bash
   npm install
   node server.js
   ```
   *Backend running at `http://localhost:5000`*

---

### 4. Run the Frontend App

1. In a new terminal, navigate to the `Frontend` directory:
   ```bash
   cd Frontend
   ```
2. Install dependencies and start Vite dev server:
   ```bash
   npm install
   npm run dev
   ```
   *Frontend running at `http://localhost:5173`*

---

## 📁 Repository Structure

```text
Seafudz-ng-Bayan/
├── Backend/                 # Express API server (Cloud Run Docker container)
│   ├── Dockerfile
│   ├── server.js
│   └── src/routes/          # API endpoints (menu, orders, kitchen, rider, auth)
├── Frontend/                # React POS & Customer Web App (Firebase Hosting)
│   ├── src/
│   └── firebase.json
├── pipeline/                # GCP Cloud Build CI/CD workflow
│   └── cloudbuild.yml
├── docker-compose.yml       # Local PostgreSQL Docker environment
├── gcp_cloudsql_schema.sql  # Database schema & initial seed data
└── DOCKER_POSTGRES_SETUP.md # Detailed Docker database setup documentation
```

---

## 🚀 Useful Commands

| Target | Command | Description |
| :--- | :--- | :--- |
| **All App (FE + BE)** | `npm run dev` | Run both Backend Express API and Frontend React app concurrently |
| **All App (Alternative)**| `./start-dev.sh` | Shell script to start both Backend & Frontend |
| **Database** | `docker compose up -d` | Start local Postgres container |
| **Database** | `docker compose stop` | Stop local Postgres container |
| **Backend** | `cd Backend && node server.js` | Start local Express API server |
| **Frontend** | `cd Frontend && npm run dev` | Start local React dev server |
| **Deploy FE** | `firebase deploy` | Deploy frontend to Firebase Hosting |

