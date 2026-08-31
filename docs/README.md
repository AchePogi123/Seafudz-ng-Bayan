# 🦞 Seafudz ng Bayan

**Seafudz ng Bayan** is a modern Point-of-Sale (POS), Kitchen Display System, Order Management, and Delivery tracking platform for seafood restaurants.

---

## 🏗️ Tech Stack & Architecture

- **Frontend:** React, TypeScript, Vite, Tailwind CSS (Hosted on **Firebase Hosting**)
- **Backend:** Node.js, Express (Containerized & Deployed to **GCP Cloud Run**)
- **Database:** PostgreSQL (Production: **GCP Cloud SQL**, Local Dev: **Docker Desktop**)
- **CI/CD Pipeline:** Google Cloud Build

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
├── pipeline/                # GCP Cloud Build
├── docs/                    # Architectural, setup guides & API readiness report
│   └── BACKEND_READINESS.md # Complete backend integration readiness breakdown
├── docker-compose.yml       # Local PostgreSQL Docker environment
├── gcp_cloudsql_schema.sql  # Database schema & initial seed data
└── DOCKER_POSTGRES_SETUP.md # Detailed Docker database setup documentation
```

---

## 🚀 Useful Commands

| Target | Command | Description |
| :--- | :--- | :--- |
| **Database** | `docker compose up -d` | Start local Postgres container |
| **Database** | `docker compose stop` | Stop local Postgres container |
| **Backend** | `cd Backend && node server.js` | Start local Express API server |
| **Frontend** | `cd Frontend && npm run dev` | Start local React dev server |
| **Deploy FE** | `firebase deploy` | Deploy frontend to Firebase Hosting |
