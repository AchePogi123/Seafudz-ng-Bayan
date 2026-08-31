# 🚀 Local PostgreSQL Database Setup Guide (Docker Desktop)

This guide walks you through setting up and running your local PostgreSQL database using Docker Desktop for the **Seafudz-ng-Bayan** project.

---

## 📋 Prerequisites
- **Docker Desktop** installed and running on your computer.

---

## 🛠️ Step 1: Create `docker-compose.yml`

In the root directory of your project (`/Seafudz-ng-Bayan/`), make sure you have a `docker-compose.yml` file with the following configuration:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: seafudz_postgres
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
      POSTGRES_DB: seafudz_db
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./gcp_cloudsql_schema.sql:/docker-entrypoint-initdb.d/schema.sql

volumes:
  postgres_data:
```

### 🔍 How this configuration works:
1. **`postgres:15-alpine`**: Downloads the official lightweight PostgreSQL database software automatically from Docker Hub online.
2. **`POSTGRES_USER / DB`**: Automatically creates your database (`seafudz_db`) and user (`postgres`).
3. **`5433:5432`**: Exposes the database to your computer on port **`5433`** (avoiding conflicts with any existing local PostgreSQL).
4. **`gcp_cloudsql_schema.sql`**: Automatically runs your schema SQL script on container setup to build all your database tables.
5. **`postgres_data`**: A volume storage that keeps your database data saved permanently on your computer even if you turn off Docker.

---

## ▶️ Step 2: Start the Database Container

Open your terminal in the project root directory and run:

```bash
docker compose up -d
```

- `-d` runs the database container in the background.

---

## 🔍 Step 3: Verify Container is Running

### Method 1: Using Docker Desktop UI
1. Open **Docker Desktop**.
2. Go to the **Containers** tab.
3. You should see `seafudz_postgres` with a green **Running** status indicator.

### Method 2: Using Terminal
Run the following command:
```bash
docker ps
```
You should see `seafudz_postgres` listed under container names with port `0.0.0.0:5433->5432/tcp`.

---

## 🔌 Step 4: Connect your Backend (`.env`)

Update your `Backend/.env` file with the following database credentials to connect your local Node.js backend to the Docker database:

```env
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgrespassword
DB_NAME=seafudz_db

# Or if using a connection URI string:
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5433/seafudz_db
```

---

## ⚡ Useful Docker Commands

| Action | Command |
| :--- | :--- |
| **Start Database** | `docker compose up -d` |
| **Stop Database** | `docker compose stop` |
| **View Database Logs** | `docker compose logs -f postgres` |
| **Access PostgreSQL Terminal (psql)** | `docker exec -it seafudz_postgres psql -U postgres -d seafudz_db` |
| **Delete Database & Reset Data** | `docker compose down -v` |

---

## ❓ Frequently Asked Questions

### 1. Do I need to install PostgreSQL software on my computer?
**No.** Docker downloads and runs PostgreSQL inside an isolated container. You do not need to install PostgreSQL locally on your OS.

### 2. What happens to my data when I turn off my computer?
Your data is stored in the Docker volume (`postgres_data`), so your data remains safe and saved on disk.

### 3. How do I reset the database to a fresh state?
Run `docker compose down -v` to delete the container and volume, then run `docker compose up -d` to recreate it fresh with your schema.
