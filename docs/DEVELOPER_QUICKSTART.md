# 💻 Developer Onboarding & Quickstart Guide

Welcome to **Seafudz ng Bayan**! This guide walks you through setting up your local environment from scratch so you can start coding and building features immediately.

---

## 📋 Prerequisites

Before starting, ensure you have the following installed on your machine:
- **Node.js** (v18 or higher) — [Download Node.js](https://nodejs.org/)
- **Docker Desktop** (running on your machine) — [Download Docker](https://www.docker.com/)
- **Git** — [Download Git](https://git-scm.com/)

---

## ⚡ 3-Step Setup Guide

### Step 1: Clone & Install Dependencies

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <repository-url>
   cd Seafudz-ng-Bayan
   ```

2. Install root dependencies:
   ```bash
   npm install
   ```

3. Install sub-project dependencies for both Frontend and Backend:
   ```bash
   cd Backend && npm install && cd ..
   cd Frontend && npm install && cd ..
   ```

---

### Step 2: Start Local PostgreSQL Database (Docker)

1. Make sure **Docker Desktop** is open and running.
2. In the project root directory, launch the database container:
   ```bash
   docker compose up -d
   ```
3. Verify that the `seafudz_postgres` container is running on port `5433`:
   ```bash
   docker ps
   ```
   *(The database container automatically initializes tables and seed data from `gcp_cloudsql_schema.sql`)*.

---

### Step 3: Start Local Servers (Frontend + Backend)

Run the unified development script from the root folder:

```bash
./start-dev.sh
```
*Or using npm:*
```bash
npm run dev
```

This single command launches both servers concurrently:
- 📡 **Backend API Server**: Runs live at `http://localhost:5000`
- 💻 **Frontend Web App**: Runs live at `http://localhost:5173`

---

## 🌐 Navigating the Local App Routes

Open your browser to test different feature areas:

| URL Route | Feature View | Primary File |
| :--- | :--- | :--- |
| `http://localhost:5173/customer` | **Online Customer Storefront** | `Frontend/src/features/OnlineCustomer.tsx` |
| `http://localhost:5173/pos` | **In-Store Cashier POS** | `Frontend/src/features/POS.tsx` |
| `http://localhost:5173/kitchen` | **Kitchen Display System (KDS)** | `Frontend/src/features/KitchenMode.tsx` |
| `http://localhost:5173/assistant` | **Assistant / Store Manager View** | `Frontend/src/features/AssistantRole.tsx` |
| `http://localhost:5173/rider` | **Rider Delivery Dashboard** | `Frontend/src/features/rideRoleDemo.tsx` |
| `http://localhost:5173/sales-report` | **Sales Reports & Analytics** | `Frontend/src/features/salesReportCashier.tsx` |

---

## 🛠️ Codebase Structure Overview

```text
Seafudz-ng-Bayan/
├── Backend/                 # Express API (Node.js)
│   ├── src/
│   │   ├── config/          # DB connections (`db.js`)
│   │   └── routes/          # Express API route handlers
│   └── server.js            # Express server entrypoint
├── Frontend/                # React App (TypeScript + Vite + Tailwind)
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── features/        # Main route views & feature modules
│   │   └── utils/           # API helper functions (`api.ts`)
│   └── .env                 # Local API configuration
├── docs/                    # Architectural & setup guides
├── docker-compose.yml       # Docker Postgres configuration
├── gcp_cloudsql_schema.sql  # Database schema & initial seed data
└── start-dev.sh             # Unified developer startup script
```

---

## 💡 Troubleshooting & Environment Toggles

- **Need to check database connection?** See [docs/DATABASE_SETUP.md](./DATABASE_SETUP.md)
- **Toggling between Local Docker and GCP Cloud?** See [docs/ENVIRONMENT_SWITCH_GUIDE.md](./ENVIRONMENT_SWITCH_GUIDE.md)
