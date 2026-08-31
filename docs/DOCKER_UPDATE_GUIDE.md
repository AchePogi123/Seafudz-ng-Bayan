# 🐳 Team Setup Guide: Updating Local PostgreSQL Docker

A quick reference guide for team members to update their local PostgreSQL Docker database after pulling the latest code changes.

---

## ⚡ Option 1: Apply Migration (Keep Existing Local Data)

Use this method if you want to apply the schema updates while **preserving your existing test data** in your local database:

```bash
# 1. Pull the latest code changes
git pull origin main

# 2. Navigate to the Backend folder
cd Backend

# 3. Run the automated database migration script
npm run migrate
```

### What happens:
The backend script executes `001_initial_schema.sql` on your running Docker PostgreSQL database, updating table constraints and triggers without deleting your existing local database records.

---

## 🧹 Option 2: Fresh Database Restart (Clean Reset)

Use this method if you want to **completely reset** your local database and re-seed it with a fresh copy of [`gcp_cloudsql_schema.sql`](file:///home/ohmyiu/Documents/Seafudz-ng-Bayan/gcp_cloudsql_schema.sql):

```bash
# 1. Pull the latest code changes
git pull origin main

# 2. Stop and remove the existing Docker container and volume
docker compose down -v

# 3. Start a fresh PostgreSQL container
docker compose up -d
```

### What happens:
- The `-v` flag removes the old PostgreSQL storage volume.
- `docker compose up -d` recreates the container and automatically runs [`gcp_cloudsql_schema.sql`](file:///home/ohmyiu/Documents/Seafudz-ng-Bayan/gcp_cloudsql_schema.sql) to initialize all tables and seed data from scratch.

---

## 🔍 Verification Commands

To verify that your local Docker PostgreSQL container is running and healthy:

```bash
# Check running Docker containers
docker ps

# Check backend connection status
curl http://localhost:5000/api/health
```
