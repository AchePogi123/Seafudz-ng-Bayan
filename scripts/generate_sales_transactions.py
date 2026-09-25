#!/usr/bin/env python3
"""
Seafudz ng Bayan — Realistic Sales Transaction Generator
Generates 1,000+ randomized sales transactions spanning across:
- Today (Recent hours)
- This Week (Past 7 days)
- This Month (Past 30 days)
- This Year (Past 365 days)

Supports:
- Direct insertion into PostgreSQL (via docker exec or local psql)
- SQL seed file generation (`Backend/src/migrations/seed_1000_sales_transactions.sql`)
- JSON export (`docs/sales_transactions_1000.json`)
- CSV export for Excel financial analysis (`docs/sales_report_1000.csv`)
"""

import os
import sys
import random
import uuid
import json
import csv
import subprocess
from datetime import datetime, timedelta

# ==============================================================================
# SEED DATA CATALOG & REFERENCES
# ==============================================================================

PRODUCTS = [
    {"id": "item-001", "name": "Seafood Bilao Feast", "price": 2400.00, "category_id": 1},
    {"id": "item-002", "name": "Seafood Cajun Boil", "price": 1850.00, "category_id": 1},
    {"id": "item-003", "name": "Classic Seafood Paella", "price": 1650.00, "category_id": 1},
    {"id": "item-004", "name": "Grilled Seafood Platter", "price": 2100.00, "category_id": 1},
    {"id": "item-005", "name": "Crispy Seafood Basket", "price": 980.00, "category_id": 1},
    {"id": "item-006", "name": "Garlic Butter Prawns", "price": 1250.00, "category_id": 2},
    {"id": "item-007", "name": "Sweet & Chili Crab Bucket", "price": 1950.00, "category_id": 3},
    {"id": "item-008", "name": "Fresh Calamansi Juice Pitcher", "price": 280.00, "category_id": 4},
]

CASHIERS = [
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "name": "cashier1"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66", "name": "cashier2"},
]

ASSISTANTS = [
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44", "name": "assistant1"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99", "name": "assistant2"},
]

RIDERS = [
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33", "name": "rider1"},
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a88", "name": "rider2"},
]

CUSTOMERS = [
    {"id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11", "name": "Juan Tamad", "address": "123 Mabini St, Manila"},
    {"id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22", "name": "Ana Reyes", "address": "456 Rizal Ave, Quezon City"},
    {"id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b33", "name": "Pedro Penduko", "address": "789 Bonifacio Blvd, Pasig City"},
    {"id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b44", "name": "Clara Dizon", "address": "101 Luna St, Makati City"},
    {"id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b55", "name": "Mark Bautista", "address": "202 Katipunan Ave, Marikina"},
    {"id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b66", "name": "Lisa Manoban", "address": "303 BGC High St, Taguig City"},
]

EXTRA_CUSTOMER_NAMES = [
    "Carlos Mendoza", "Maria Clara Santos", "Dindo Dela Cruz", "Giselle Hernandez",
    "Ramon Magsaysay Jr.", "Katrina Halili", "Ferdinand Marcos", "Bea Alonzo",
    "Joshua Garcia", "Kathryn Bernardo", "Daniel Padilla", "Marian Rivera",
    "Dingdong Dantes", "Sarah Geronimo", "Matteo Guidicelli", "Alden Richards"
]

TABLES = [f"Table {i}" for i in range(1, 13)]

ORDER_NOTES = [
    "Extra calamansi and spicy vinegar sauce",
    "Well-done seafood boil, spicy level 3",
    "Please prepare separate takeaway containers",
    "Customer requested butter garlic sauce on the side",
    "Serve drinks first while waiting for bilao feast",
    "No plastics / eco-friendly packaging requested",
    "Birthday celebration order - priority prep",
    "Catering for office gathering",
    "", "", "", "" # frequent empty notes
]


# ==============================================================================
# RANDOM TRANSACTION GENERATOR
# ==============================================================================

def generate_random_timestamp(now: datetime, index: int, total_count: int) -> datetime:
    """
    Distributes transactions realistically across time periods:
    - ~10% today (different hours during business 9am - 10pm)
    - ~25% past 7 days (This Week)
    - ~35% past 30 days (This Month)
    - ~30% past 365 days (This Year)
    """
    rand = random.random()
    if rand < 0.10:
        # Today
        hour = random.randint(9, 21)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        dt = now.replace(hour=hour, minute=minute, second=second, microsecond=0)
        if dt > now:
            dt = now - timedelta(minutes=random.randint(5, 180))
        return dt
    elif rand < 0.35:
        # Past 7 days
        days_ago = random.randint(1, 7)
        hour = random.randint(10, 21)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        return (now - timedelta(days=days_ago)).replace(hour=hour, minute=minute, second=second, microsecond=0)
    elif rand < 0.70:
        # Past 30 days
        days_ago = random.randint(8, 30)
        hour = random.randint(10, 21)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        return (now - timedelta(days=days_ago)).replace(hour=hour, minute=minute, second=second, microsecond=0)
    else:
        # Past 365 days
        days_ago = random.randint(31, 360)
        hour = random.randint(10, 21)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        return (now - timedelta(days=days_ago)).replace(hour=hour, minute=minute, second=second, microsecond=0)


def generate_transactions(count: int = 1000, channel_mode: str = 'mixed', online_ratio: float = 0.50):
    now = datetime.now()
    transactions = []

    print(f"[*] Generating {count:,} realistic sales transactions (Channel Mode: {channel_mode.upper()})...")

    for i in range(1, count + 1):
        created_at = generate_random_timestamp(now, i, count)
        date_str = created_at.strftime("%Y%m%d")
        
        # Determine order channel
        if channel_mode == 'online':
            is_online = True
        elif channel_mode == 'pos':
            is_online = False
        else:
            is_online = random.random() < online_ratio
            
        order_type = "ONLINE" if is_online else "ON_SITE"
        
        order_uid = uuid.uuid4().hex[:5].upper()
        order_id = f"ORD-{date_str}-{i:05d}-{order_uid}"

        # Customer Assignment
        if is_online:
            cust = random.choice(CUSTOMERS)
            customer_id = cust["id"]
            customer_name = cust["name"]
            delivery_address = cust["address"]
            cashier_id = None
            assistant_id = None
            table_id = None
            delivery_fee = round(random.choice([50.0, 60.0, 75.0, 85.0, 100.0, 120.0]), 2)
            rider_id = random.choice(RIDERS)["id"]
        else:
            # ON_SITE (Dine in or Take out)
            cashier = random.choice(CASHIERS)
            cashier_id = cashier["id"]
            assistant_id = random.choice(ASSISTANTS)["id"]
            table_id = random.choice(TABLES)
            customer_id = random.choice(CUSTOMERS)["id"] if random.random() < 0.4 else None
            customer_name = random.choice(EXTRA_CUSTOMER_NAMES) if not customer_id else next(c["name"] for c in CUSTOMERS if c["id"] == customer_id)
            delivery_address = None
            delivery_fee = 0.00
            rider_id = None

        # Select 1 to 4 distinct items for this order
        num_items = random.choices([1, 2, 3, 4], weights=[0.40, 0.35, 0.18, 0.07])[0]
        selected_products = random.sample(PRODUCTS, k=num_items)

        order_items = []
        subtotal = 0.0

        for prod in selected_products:
            qty = random.choices([1, 2, 3], weights=[0.75, 0.20, 0.05])[0]
            unit_price = float(prod["price"])
            item_subtotal = round(unit_price * qty, 2)
            subtotal += item_subtotal

            order_items.append({
                "product_id": prod["id"],
                "product_name_snapshot": prod["name"],
                "unit_price": unit_price,
                "quantity": qty,
                "subtotal": item_subtotal,
                "notes": random.choice(ORDER_NOTES) if random.random() < 0.15 else None
            })

        subtotal = round(subtotal, 2)
        tax = round(subtotal * 0.12, 2) # 12% VAT
        total = round(subtotal + tax + delivery_fee, 2)

        # Status & Payment
        # Order Status: 91% COMPLETED, 5% IN_PROCESS, 4% CANCELLED
        status_rand = random.random()
        if status_rand < 0.91:
            order_status = "COMPLETED"
            payment_status = "PAID"
        elif status_rand < 0.96:
            order_status = "IN_PROCESS"
            payment_status = random.choice(["PAID", "PENDING"])
        else:
            order_status = "CANCELLED"
            payment_status = random.choice(["REFUNDED", "FAILED", "PENDING"])

        # Payment Method: Cash, GCash, Hybrid / Split, Maya, COD
        if is_online:
            payment_method = random.choices(
                ["GCASH", "HYBRID (Cash + GCash)", "SPLIT (Cash + GCash)", "MAYA", "CASH", "COD"],
                weights=[0.45, 0.15, 0.12, 0.12, 0.10, 0.06]
            )[0]
        else:
            payment_method = random.choices(
                ["CASH", "GCASH", "HYBRID (Cash + GCash)", "SPLIT (Cash + GCash)", "MAYA"],
                weights=[0.42, 0.28, 0.15, 0.10, 0.05]
            )[0]

        ref_number = f"TXN-{payment_method[:3]}-{random.randint(10000000, 99999999)}" if payment_status == "PAID" else None
        paid_at = (created_at + timedelta(minutes=random.randint(1, 15))).strftime("%Y-%m-%d %H:%M:%S") if payment_status == "PAID" else None
        notes = random.choice(ORDER_NOTES)

        transactions.append({
            "order_id": order_id,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "cashier_id": cashier_id,
            "assistant_id": assistant_id,
            "rider_id": rider_id,
            "table_id": table_id,
            "order_type": order_type,
            "status": order_status,
            "subtotal": subtotal,
            "tax": tax,
            "delivery_fee": delivery_fee,
            "total": total,
            "notes": notes,
            "created_at": created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "items": order_items,
            "payment": {
                "id": str(uuid.uuid4()),
                "payment_method": payment_method,
                "amount": total,
                "status": payment_status,
                "reference_number": ref_number,
                "paid_at": paid_at,
            },
            "delivery": {
                "id": str(uuid.uuid4()),
                "delivery_address": delivery_address,
                "rider_id": rider_id,
                "status": "DELIVERED" if order_status == "COMPLETED" else "PENDING",
            } if is_online else None
        })

    # Sort chronological
    transactions.sort(key=lambda t: t["created_at"])
    return transactions


# ==============================================================================
# EXPORTERS & DB INSERTERS
# ==============================================================================

def generate_sql_file(transactions, output_path: str):
    """Generates pure PostgreSQL insert queries."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("-- =============================================================================\n")
        f.write(f"-- Seafudz ng Bayan: 1,000 Randomized Sales Transactions Seed\n")
        f.write(f"-- Generated At: {datetime.now().isoformat()}\n")
        f.write("-- =============================================================================\n\n")
        f.write("BEGIN;\n\n")
        f.write("-- Ensure auto-increment sequence is synced\n")
        f.write("SELECT setval('order_items_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM order_items), false);\n\n")

        for t in transactions:
            cust_val = f"'{t['customer_id']}'" if t['customer_id'] else "NULL"
            cashier_val = f"'{t['cashier_id']}'" if t['cashier_id'] else "NULL"
            assistant_val = f"'{t['assistant_id']}'" if t['assistant_id'] else "NULL"
            table_val = f"'{t['table_id']}'" if t['table_id'] else "NULL"
            clean_notes = t['notes'].replace("'", "''") if t['notes'] else ""
            notes_val = f"'{clean_notes}'" if clean_notes else "NULL"

            # 1. Insert Order
            f.write(
                f"INSERT INTO orders (id, customer_id, cashier_id, assistant_id, table_id, order_type, status, subtotal, tax, delivery_fee, total, notes, created_at, updated_at) "
                f"VALUES ('{t['order_id']}', {cust_val}, {cashier_val}, {assistant_val}, {table_val}, '{t['order_type']}', '{t['status']}', {t['subtotal']}, {t['tax']}, {t['delivery_fee']}, {t['total']}, {notes_val}, '{t['created_at']}', '{t['created_at']}') "
                f"ON CONFLICT (id) DO NOTHING;\n"
            )

            # 2. Insert Order Items
            for item in t["items"]:
                clean_item_notes = item['notes'].replace("'", "''") if item['notes'] else ""
                item_notes = f"'{clean_item_notes}'" if clean_item_notes else "NULL"
                f.write(
                    f"  INSERT INTO order_items (order_id, product_id, product_name_snapshot, unit_price, quantity, subtotal, notes, created_at) "
                    f"VALUES ('{t['order_id']}', '{item['product_id']}', '{item['product_name_snapshot']}', {item['unit_price']}, {item['quantity']}, {item['subtotal']}, {item_notes}, '{t['created_at']}');\n"
                )

            # 3. Insert Payment
            p = t["payment"]
            ref_val = f"'{p['reference_number']}'" if p['reference_number'] else "NULL"
            paid_val = f"'{p['paid_at']}'" if p['paid_at'] else "NULL"
            f.write(
                f"  INSERT INTO payments (id, order_id, payment_method, amount, status, reference_number, paid_at, created_at) "
                f"VALUES ('{p['id']}', '{t['order_id']}', '{p['payment_method']}', {p['amount']}, '{p['status']}', {ref_val}, {paid_val}, '{t['created_at']}') "
                f"ON CONFLICT (id) DO NOTHING;\n"
            )

            # 4. Insert Deliveries if online
            if t["delivery"] and t["delivery"]["delivery_address"]:
                d = t["delivery"]
                r_val = f"'{d['rider_id']}'" if d['rider_id'] else "NULL"
                clean_addr = d['delivery_address'].replace("'", "''")
                addr_val = f"'{clean_addr}'"
                f.write(
                    f"  INSERT INTO deliveries (id, order_id, rider_id, delivery_address, status, assigned_at, updated_at) "
                    f"VALUES ('{d['id']}', '{t['order_id']}', {r_val}, {addr_val}, '{d['status']}', '{t['created_at']}', '{t['created_at']}') "
                    f"ON CONFLICT (id) DO NOTHING;\n"
                )

            # 5. Insert Kitchen Order
            k_status = "COMPLETED" if t["status"] == "COMPLETED" else "PENDING"
            f.write(
                f"  INSERT INTO kitchen_orders (order_id, status, started_at, completed_at, created_at, updated_at) "
                f"VALUES ('{t['order_id']}', '{k_status}', '{t['created_at']}', '{t['created_at']}', '{t['created_at']}', '{t['created_at']}') "
                f"ON CONFLICT (order_id) DO NOTHING;\n\n"
            )

        f.write("COMMIT;\n")

    print(f"[+] Successfully wrote SQL seed script to: {output_path}")


def generate_json_file(transactions, output_path: str):
    """Generates JSON dataset for reporting / frontend inspection."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(transactions, f, indent=2)
    print(f"[+] Successfully wrote JSON dataset to: {output_path}")


def generate_csv_file(transactions, output_path: str):
    """Generates CSV spreadsheet for financial & executive analysis."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Order ID", "Date", "Channel / Type", "Customer", "Items Summary",
            "Subtotal (PHP)", "VAT 12% (PHP)", "Delivery Fee (PHP)", "Grand Total (PHP)",
            "Payment Method", "Payment Status", "Order Status", "Reference No."
        ])

        for t in transactions:
            items_summary = "; ".join(f"{i['product_name_snapshot']} x{i['quantity']}" for i in t["items"])
            writer.writerow([
                t["order_id"],
                t["created_at"][:19],
                t["order_type"],
                t["customer_name"],
                items_summary,
                f"{t['subtotal']:.2f}",
                f"{t['tax']:.2f}",
                f"{t['delivery_fee']:.2f}",
                f"{t['total']:.2f}",
                t["payment"]["payment_method"],
                t["payment"]["status"],
                t["status"],
                t["payment"]["reference_number"] or "N/A"
            ])

    print(f"[+] Successfully exported CSV Sales Report to: {output_path}")


def execute_seed_to_database(sql_file_path: str, count: int = 1000):
    """Executes the generated SQL file into PostgreSQL via docker exec or psql."""
    print("[*] Seeding data directly into PostgreSQL database (seafudz_db)...")
    
    # Try Docker container first
    try:
        cmd = f"docker exec -i seafudz_postgres psql -U postgres -d seafudz_db < {sql_file_path}"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0 and "ERROR:" not in result.stderr and "ERROR:" not in result.stdout:
            print(f"[OK] Successfully seeded {count:,} transactions into docker container 'seafudz_postgres'!")
            return True
        else:
            err_msg = (result.stderr or result.stdout).strip()[:300]
            print(f"[ERROR] Docker seeding error: {err_msg}")
    except Exception as e:
        print(f"[ERROR] Docker exec failed: {e}")

    # Fallback to local psql if available
    try:
        cmd = f"PGPASSWORD=postgrespassword psql -h localhost -p 5432 -U postgres -d seafudz_db -f {sql_file_path}"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0 and "ERROR:" not in result.stderr and "ERROR:" not in result.stdout:
            print(f"[OK] Successfully seeded {count:,} transactions via local psql!")
            return True
        else:
            err_msg = (result.stderr or result.stdout).strip()[:300]
            print(f"[ERROR] Local psql error: {err_msg}")
    except Exception as e:
        print(f"[ERROR] Local psql failed: {e}")

    return False


def clean_database():
    """Truncates generated orders and restores clean default sample orders."""
    print("[*] Cleaning and resetting orders in PostgreSQL database...")
    clean_sql = """
    BEGIN;
    TRUNCATE orders, order_items, payments, deliveries, kitchen_orders RESTART IDENTITY CASCADE;

    INSERT INTO orders (id, customer_id, cashier_id, assistant_id, table_id, order_type, status, subtotal, tax, delivery_fee, total, notes, created_at) VALUES
    ('ORD-1001', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Table 1', 'ON_SITE', 'COMPLETED', 2400.00, 288.00, 0.00, 2688.00, 'Dine-in Table 1', NOW() - INTERVAL '1 hour'),
    ('ORD-1002', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, NULL, 'ONLINE', 'IN_PROCESS', 1850.00, 222.00, 100.00, 2172.00, 'Deliver ASAP', NOW() - INTERVAL '30 minutes')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_price, quantity, subtotal, notes) VALUES
    (1, 'ORD-1001', 'item-001', 'Seafood Bilao Feast', 2400.00, 1, 2400.00, 'Garlic rice bed'),
    (2, 'ORD-1002', 'item-002', 'Seafood Cajun Boil', 1850.00, 1, 1850.00, 'Medium spicy')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO payments (id, order_id, payment_method, amount, status, reference_number, paid_at) VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'ORD-1001', 'GCASH', 2688.00, 'PAID', 'GCASH-998877', NOW() - INTERVAL '1 hour'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c22', 'ORD-1002', 'ONLINE', 2172.00, 'PAID', 'PAY-554433', NOW() - INTERVAL '30 minutes')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO deliveries (id, order_id, rider_id, delivery_address, status, assigned_at, notes) VALUES
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', 'ORD-1002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', '45 Quezon Ave, Quezon City', 'ASSIGNED', NOW() - INTERVAL '20 minutes', 'Ring doorbell')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO kitchen_orders (id, order_id, status, started_at, completed_at) VALUES
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'ORD-1001', 'COMPLETED', NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '30 minutes'),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e22', 'ORD-1002', 'IN_PROCESS', NOW() - INTERVAL '25 minutes', NULL)
    ON CONFLICT (id) DO NOTHING;

    COMMIT;
    """
    try:
        cmd = f'docker exec -i seafudz_postgres psql -U postgres -d seafudz_db -c "{clean_sql}"'
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if res.returncode == 0:
            print("[OK] Successfully cleaned all generated orders and restored clean seed orders in PostgreSQL!")
            return True
        else:
            print(f"[WARN] Docker clean warning: {res.stderr.strip()}")
    except Exception as e:
        print(f"[ERROR] Docker clean error: {e}")
    return False


# ==============================================================================
# MAIN CLI
# ==============================================================================

def main():
    if any(arg in ('--clean', '--reset', '--delete') for arg in sys.argv):
        clean_database()
        # Clean local dump files
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        for d, pattern in [
            (os.path.join(repo_root, "database", "seeds"), "seed_*.sql"),
            (os.path.join(repo_root, "docs"), "sales_transactions_*.json"),
            (os.path.join(repo_root, "docs"), "sales_report_*.csv"),
        ]:
            if os.path.isdir(d):
                import glob
                for f in glob.glob(os.path.join(d, pattern)):
                    try:
                        os.remove(f)
                        print(f"[-] Removed dump file: {f}")
                    except:
                        pass
        return

    count = 1000
    channel_mode = 'mixed'
    
    args = sys.argv[1:]
    for arg in args:
        if arg.isdigit():
            count = int(arg)
        elif arg in ('--online-only', '--online'):
            channel_mode = 'online'
        elif arg in ('--pos-only', '--pos'):
            channel_mode = 'pos'

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    tag = f"_{channel_mode}" if channel_mode != 'mixed' else ""
    sql_path = os.path.join(repo_root, "database", "seeds", f"seed_{count}{tag}_sales_transactions.sql")
    json_path = os.path.join(repo_root, "docs", f"sales_transactions_{count}{tag}.json")
    csv_path = os.path.join(repo_root, "docs", f"sales_report_{count}{tag}.csv")

    transactions = generate_transactions(count, channel_mode=channel_mode, online_ratio=0.50)

    # 1. Output SQL
    generate_sql_file(transactions, sql_path)

    # 2. Output JSON & CSV
    generate_json_file(transactions, json_path)
    generate_csv_file(transactions, csv_path)

    # 3. Direct DB Seed
    if "--no-db" not in sys.argv:
        execute_seed_to_database(sql_path, count)

    # Print Summary Statistics
    total_sales = sum(t["total"] for t in transactions if t["status"] != "CANCELLED")
    total_orders = len(transactions)
    completed_orders = sum(1 for t in transactions if t["status"] == "COMPLETED")
    online_orders = sum(1 for t in transactions if t["order_type"] == "ONLINE")
    pos_orders = sum(1 for t in transactions if t["order_type"] == "ON_SITE")
    online_sales = sum(t["total"] for t in transactions if t["order_type"] == "ONLINE" and t["status"] != "CANCELLED")
    pos_sales = sum(t["total"] for t in transactions if t["order_type"] == "ON_SITE" and t["status"] != "CANCELLED")
    
    print("\n" + "=" * 65)
    print(" SALES TRANSACTIONS GENERATION SUMMARY")
    print("=" * 65)
    print(f" Total Transactions Generated: {total_orders:,}")
    print(f" Online Delivery Orders:       {online_orders:,} (PHP {online_sales:,.2f})")
    print(f" On-Site POS Orders:           {pos_orders:,} (PHP {pos_sales:,.2f})")
    print(f" Completed Orders:             {completed_orders:,} ({completed_orders/total_orders*100:.1f}%)")
    print(f" Total Gross Sales Revenue:    PHP {total_sales:,.2f}")
    print(f" Generated Files:")
    print(f"   - SQL Script: {sql_path}")
    print(f"   - JSON Feed:  {json_path}")
    print(f"   - CSV Report: {csv_path}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
