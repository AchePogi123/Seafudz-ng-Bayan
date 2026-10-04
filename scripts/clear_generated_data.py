#!/usr/bin/env python3
"""
Seafudz ng Bayan — Generated Data Cleanup Script
Clears all generated sales transactions, order records, payments, deliveries, and dump files,
restoring the database to its clean default state.
"""

import os
import sys
import glob
import subprocess


def clear_database():
    """Truncates generated orders and restores clean default sample orders in PostgreSQL."""
    print("[*] Cleaning and resetting orders in PostgreSQL database (seafudz_db)...")
    
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
    
    # 1. Try Docker container
    try:
        cmd = f'docker exec -i seafudz_postgres psql -U postgres -d seafudz_db -c "{clean_sql}"'
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if res.returncode == 0:
            print("[OK] Successfully cleared generated orders and restored clean default seed data in PostgreSQL (Docker)!")
            return True
        else:
            print(f"[WARN] Docker clean warning: {res.stderr.strip()}")
    except Exception as e:
        print(f"[ERROR] Docker clean error: {e}")

    # 2. Fallback to local psql
    try:
        cmd = f'PGPASSWORD=postgrespassword psql -h localhost -p 5433 -U postgres -d seafudz_db -c "{clean_sql}"'
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if res.returncode == 0:
            print("[OK] Successfully cleared generated orders via local psql!")
            return True
        else:
            print(f"[WARN] Local psql clean warning: {res.stderr.strip()}")
    except Exception as e:
        print(f"[ERROR] Local psql clean error: {e}")

    return False


def remove_generated_files():
    """Removes all generated seed SQL scripts, JSON feeds, and CSV reports."""
    print("[*] Removing generated seed files and report dumps...")
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    targets = [
        (os.path.join(repo_root, "database", "seeds"), "seed_*.sql"),
        (os.path.join(repo_root, "docs"), "sales_transactions_*.json"),
        (os.path.join(repo_root, "docs"), "sales_report_*.csv"),
    ]
    
    removed_count = 0
    for folder, pattern in targets:
        if os.path.isdir(folder):
            for file_path in glob.glob(os.path.join(folder, pattern)):
                try:
                    os.remove(file_path)
                    print(f"  [-] Removed dump file: {file_path}")
                    removed_count += 1
                except Exception as e:
                    print(f"  [!] Failed to remove {file_path}: {e}")
                    
    print(f"[OK] Cleaned {removed_count} generated artifact file(s).")


def main():
    print("=" * 65)
    print(" SEAFUDZ NG BAYAN — DATA CLEANUP & RESET")
    print("=" * 65)
    
    db_success = clear_database()
    remove_generated_files()
    
    print("=" * 65)
    if db_success:
        print("[SUCCESS] All generated sales data cleared and database reset to default state!")
    else:
        print("[FINISHED] Cleanup finished with warnings. Please check database connectivity.")
    print("=" * 65)


if __name__ == "__main__":
    main()
