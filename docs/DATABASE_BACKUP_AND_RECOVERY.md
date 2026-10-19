# Database Backup, Disaster Recovery & Historical Transaction Export Guide

This document describes the automated backup architecture, disaster recovery restoration procedures, and spreadsheet auditing capabilities implemented for **Seafudz ng Bayan**.

---

## 1. Quick Comparison: Backups vs. Excel Exports

| Dimension | Database Backups (`.sql.gz`) | Transaction Reports (`.xlsx`) |
| :--- | :--- | :--- |
| **Primary Purpose** | Complete disaster recovery, infrastructure migration, catastrophic loss recovery. | Management review, accounting audits, tax calculation, and business analytics. |
| **Data Scope** | Entire PostgreSQL database: schemas, tables, constraints, foreign keys, sequences, triggers, and raw records. | Filtered or all-time orders, line items, customer info, payment methods, VAT taxes, refunds. |
| **Format** | Gzip-compressed standard PostgreSQL SQL dump (`.sql.gz`). | Multi-sheet Microsoft Excel OpenXML spreadsheet (`.xlsx`). |
| **Can Restore Database?** | **YES** — Can rebuild complete database from scratch. | **NO** — Spreadsheets cannot preserve database schemas, triggers, or constraints. |
| **Storage Location** | Private Supabase Storage bucket: `database-backups`. | Generated dynamically on-demand from Railway PostgreSQL. |
| **Access Control** | Authorized Administrators only (short-lived 60s signed URLs). | Authorized Administrators only. |

---

## 2. Automated 30-Day Rolling Backup Architecture

### Daily Schedule
- **Time:** Automatically executes every day at **03:00 AM Asia/Manila time** (`UTC+8`).
- **File Naming:** `seafudz_backup_YYYY-MM-DD_HHmmss.sql.gz`
- **Timezone:** Asia/Manila for consistent auditing with Philippine operational hours.

### Distributed Concurrency & Multi-Instance Locking
- Uses **PostgreSQL Distributed Advisory Locks** (`SELECT pg_try_advisory_lock(84729184)`).
- If multiple Railway containers or instances are running, or if a manual backup is triggered while a scheduled backup runs, only **one** process acquires the advisory lock. Concurrent processes immediately exit safely without duplicate jobs or database resource spikes.
- Checks if today's date prefix already exists in storage before running.

### Storage & Retention Policy
- Uploaded directly to private Supabase Storage bucket **`database-backups`** (`public: false`).
- Retains up to **30 newest valid backups**.
- When a new backup is validated and uploaded successfully, excess oldest files matching the naming convention are purged.
- Unrelated files and live PostgreSQL transaction records are **never** modified or deleted.

---

## 3. Disaster Recovery & Manual Restoration Guide

> [!WARNING]
> **Critical Safety Rule: Never Overwrite Live Production Directly**
> Always restore database backups into an **isolated recovery or test database** first. This allows you to inspect the recovered records safely without risking ongoing restaurant orders or customer transactions.

### Step 1: Download the Backup File
1. Log in to the Admin Portal at `/admin-sales-report`.
2. Click **Database Backups**.
3. In the **Backup Archives** list, find the target snapshot and click **Download**.
4. A secure, short-lived (60s) HMAC signed URL will initiate the `.sql.gz` file download.

### Step 2: Decompress the Archive
Open a terminal in your download folder and decompress the `.sql.gz` file:
```bash
gzip -d seafudz_backup_YYYY-MM-DD_HHmmss.sql.gz
```
This produces the plain SQL script `seafudz_backup_YYYY-MM-DD_HHmmss.sql`.

### Step 3: Create a Dedicated Recovery Database
Create a clean, isolated recovery database on your PostgreSQL host or local Docker environment:

**Using Standard PostgreSQL CLI:**
```bash
createdb -h localhost -p 5432 -U postgres seafudz_recovery_db
```

**Using Local Docker Container:**
```bash
docker exec -it seafudz_postgres createdb -U postgres seafudz_recovery_db
```

### Step 4: Restore Schema and Data
Feed the uncompressed SQL script into your recovery database:

**Using PostgreSQL CLI:**
```bash
psql -h localhost -p 5432 -U postgres -d seafudz_recovery_db -f seafudz_backup_YYYY-MM-DD_HHmmss.sql
```

**Using Local Docker Container:**
```bash
docker exec -i seafudz_postgres psql -U postgres -d seafudz_recovery_db < seafudz_backup_YYYY-MM-DD_HHmmss.sql
```

### Step 5: Verify Recovered Records
Connect to the recovery database and verify data integrity:
```sql
\c seafudz_recovery_db

-- Check table count (Expected: 14 base tables)
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Verify key table row counts
SELECT count(*) AS total_orders FROM orders;
SELECT count(*) AS total_items FROM order_items;
SELECT count(*) AS total_payments FROM payments;
SELECT count(*) AS total_employees FROM employees;
```

---

## 4. Exporting Historical Transactions to Excel (`.xlsx`)

For accounting, tax audits, and sales reviews:
1. Go to `/admin-sales-report`.
2. Click **Export to Excel** in the action bar.
3. Select your timeframe:
   - **All Historical Records** (exports all transactions without limits).
   - **Today / This Week / This Month / This Year**.
   - **Custom Date Range** (select specific Start Date and End Date in Manila time).
4. Select Channel filter: *All Channels*, *POS Walk-In*, or *Online Delivery*.
5. Review the live record and revenue preview.
6. Click **Download Excel Ledger (.xlsx)**.

### Excel Workbook Structure
The generated `.xlsx` workbook includes three dedicated worksheets:
1. **Transactions Ledger:** Complete order-level table including Order Ref #, Manila timestamp, channel, table/delivery destination, customer name, cashier staff, status, cancellation details, ordered items summary, subtotal, VAT, delivery fee, gross total, payment method/status, refund amounts, and replacement details.
2. **Itemized Breakdown:** Granular line-item table containing individual dishes, snapshots, unit prices, quantities, item statuses (`ACTIVE`, `REPLACED`, `CANCELLED`), and special preparation notes.
3. **Executive Summary:** High-level financial KPIs: gross sales, net food subtotal, 12% VAT collected, delivery revenue, total refunds, and net recognized revenue.
