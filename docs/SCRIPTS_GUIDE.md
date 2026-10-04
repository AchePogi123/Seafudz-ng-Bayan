# 🛠️ Seafudz ng Bayan — Utility & Testing Scripts Guide

This document provides a comprehensive guide to the Python utility and benchmarking scripts located in the `scripts/` directory:

1. **`generate_sales_transactions.py`**: High-volume realistic sales transaction generator and database seeder.
2. **`stress_test.py`**: Automated multi-scenario load testing, concurrency, and latency benchmarking CLI.

---

## 📋 Table of Contents
- [1. generate_sales_transactions.py (Data Generator & Seeder)](#1-generate_sales_transactionspy)
  - [Features](#features)
  - [Command Line Usage](#command-line-usage)
  - [Arguments & Flags](#arguments--flags)
  - [Examples](#examples)
- [2. stress_test.py (Load & Concurrency Benchmark CLI)](#2-stress_testpy)
  - [Features](#features-1)
  - [Scenarios Tested](#scenarios-tested)
  - [Command Line Usage](#command-line-usage-1)
  - [Arguments & Flags](#arguments--flags-1)
  - [Benchmark Metrics & Output](#benchmark-metrics--output)
- [3. PostgreSQL Schema & Constraint Considerations](#3-postgresql-schema--constraint-considerations)

---

## 1. `generate_sales_transactions.py`

### Features
- Generates realistic seafood restaurant transactions with accurate weights (grams / kg), cooking styles, spicy levels, add-ons, and pricing.
- Generates realistic channel split: **POS (Dine-in / Takeout)** vs **Online Delivery**.
- Supports realistic payment methods:
  - `CASH`
  - `GCASH`
  - `MAYA`
  - `COD` (Cash on Delivery)
  - `HYBRID (Cash + GCash)` / `SPLIT`
- Generates customer demographics, realistic timestamps across custom date ranges, order statuses (`COMPLETED`, `CANCELLED`), and cashier assignments.
- Outputs structured data into **CSV** and **JSON** files in `docs/` and can optionally seed directly into local or remote PostgreSQL databases via batch SQL queries.

### Command Line Usage
```bash
python3 scripts/generate_sales_transactions.py [OPTIONS]
```

### Arguments & Flags
| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-c`, `--count` | `int` | `5000` | Number of transactions to generate. |
| `--start-date` | `string` | `2026-03-01` | Start of transaction date window (`YYYY-MM-DD`). |
| `--end-date` | `string` | `2026-09-21` | End of transaction date window (`YYYY-MM-DD`). |
| `--db` | `flag` | `False` | When passed, seeds generated records directly into PostgreSQL. |
| `--db-host` | `string` | `localhost` | PostgreSQL host. |
| `--db-port` | `int` | `5433` | PostgreSQL port (default local Docker container port). |
| `--db-user` | `string` | `postgres` | PostgreSQL username. |
| `--db-pass` | `string` | `postgrespassword` | PostgreSQL password. |
| `--db-name` | `string` | `seafudz_db` | PostgreSQL database name. |

### Examples

#### Generate 5,000 Transactions (Export to CSV/JSON only)
```bash
python3 scripts/generate_sales_transactions.py -c 5000
```

#### Generate and Seed 5,000 Transactions Directly into PostgreSQL
```bash
python3 scripts/generate_sales_transactions.py -c 5000 --db
```

#### Generate 1,000 Transactions for a Specific Date Window
```bash
python3 scripts/generate_sales_transactions.py -c 1000 --start-date 2026-09-01 --end-date 2026-09-21 --db
```

---

## 2. `stress_test.py`

### Features
- **Zero-Dependency Runner**: Built using Python's standard library (`urllib` and `concurrent.futures.ThreadPoolExecutor`).
- **Live Health Pre-Check**: Verifies backend accessibility prior to starting heavy load.
- **Percentile Latency Analysis**: Calculates Minimum, Mean, Median, Maximum, **p90**, **p95**, and **p99** response times.
- **Throughput Profiling**: Computes real-time requests per second (RPS) and total data transferred in MB.
- **Multi-Scenario Architecture**: Runs targeted checks against aggregation, pagination, filtering, or full chaos spike bursts.

### Scenarios Tested
1. **Summary & Aggregation Engine (`summary`)**:
   - Hits `GET /api/sales/summary?tab=Today`, `This Week`, `This Month`, `This Year`, and all-time aggregates.
   - Stresses complex SQL `GROUP BY`, `SUM`, `COUNT`, and `TO_CHAR` operations across thousands of records.
2. **Deep Pagination & Offset Scan (`pages`)**:
   - Hits `GET /api/orders?limit=10&offset=...` with varying offsets.
   - Stresses indexed scanning, order sorting, and item relation joins under client scrolling load.
3. **Multi-Criteria Filtering (`filter`)**:
   - Hits `GET /api/orders` filtering simultaneously on payment methods (`Hybrid`, `GCash`, `Cash`), order types (`POS`, `Online`), and text search terms.
4. **Chaos Spike Load (`chaos`)**:
   - Hits all endpoints simultaneously across 50+ concurrent threads to simulate lunch/dinner rush traffic spikes.

### Command Line Usage
```bash
python3 scripts/stress_test.py [OPTIONS]
```

### Arguments & Flags
| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--quick` | `flag` | `False` | Fast 100-request smoke test across primary endpoints. |
| `--scenario` | `string` | `all` | Specific scenario to execute: `all`, `summary`, `pages`, `filter`, `chaos`. |
| `-n`, `--requests` | `int` | *auto* | Override total number of requests for the chosen scenario. |
| `-c`, `--concurrency` | `int` | *auto* | Override number of parallel worker threads. |
| `--url` | `string` | `http://localhost:5000/api` | Target Base API URL (can point to local server, staging, or Cloud Run). |

### Benchmark Metrics & Output

#### Example 1: Fast Smoke Test
```bash
python3 scripts/stress_test.py --quick
```

#### Example 2: Target Only the Sales Summary Engine
```bash
python3 scripts/stress_test.py --scenario summary -n 500 -c 30
```

#### Example 3: Full 2,700-Request Benchmark Suite
```bash
python3 scripts/stress_test.py
```

#### Sample Terminal Output
```text
================================================================================
🚀 SEAFUDZ NG BAYAN — LOAD & STRESS TEST ENGINE
   Target Server: http://localhost:5000/api
================================================================================
[✓] Backend server is online and responding.

▶ Running Scenario: 1. High Concurrency Summary Engine
  • Load Profile: 500 requests across 25 concurrent workers
  • Success Rate     : 500/500 (100.0%)
  • Throughput       : 88.4 req/sec in 5.65 seconds
  • Latency Stats    : Min: 42.1ms | Avg: 268.3ms | Med: 263.8ms | Max: 412.5ms
  • Percentiles      : p90: 312.4ms | p95: 328.6ms | p99: 360.2ms
  • Data Transferred : 0.42 MB

================================================================================
📊 OVERALL BENCHMARK SUMMARY
================================================================================
Total Requests Executed : 2,700
Total Benchmark Time    : 24.32 seconds
Overall Net Throughput  : 111.0 req/sec
--------------------------------------------------------------------------------
Scenario Name                              | Success  | Throughput   | p95 Latency
--------------------------------------------------------------------------------
1. High Concurrency Summary Engine         | 100.0%   | 88.4 r/s     | 328.6 ms
2. Deep Pagination & Offset Scan           | 100.0%   | 126.1 r/s    | 240.2 ms
3. Payment & Search Multi-Filtering        | 100.0%   | 120.3 r/s    | 251.8 ms
4. Mixed Chaos Spike Load (Simultaneous)   | 100.0%   | 112.5 r/s    | 448.9 ms
================================================================================
```

---

## 3. PostgreSQL Schema & Constraint Considerations

When generating high volumes of test transactions or adding new payment categories:

- **Payment Method Constraint**:
  The `payments` table contains a check constraint on `payment_method`. Ensure all generated values match the allowed set:
  ```sql
  ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
  ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check 
    CHECK (payment_method IN ('CASH', 'GCASH', 'CARD', 'ONLINE', 'HYBRID', 'SPLIT', 'HYBRID (Cash + GCash)', 'SPLIT (Cash + GCash)', 'MAYA', 'COD'));
  ```

- **Database Performance with 10,000+ Records**:
  - Always utilize `limit` and `offset` when fetching order tables (`/api/orders?limit=10&offset=0`).
  - Rely on SQL-level aggregates (`SUM`, `COUNT`) via `/api/sales/summary` rather than mass client-side array processing.
