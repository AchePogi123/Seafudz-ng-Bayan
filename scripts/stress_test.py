#!/usr/bin/env python3
"""
Seafudz ng Bayan — Automated Multi-Scenario Stress Test CLI
==========================================================
High-concurrency load and performance tester for Seafudz ng Bayan Backend APIs.

Features:
- Tests PostgreSQL SQL Aggregation (/api/sales/summary)
- Tests 10-per-page Pagination scanning (/api/orders?limit=10&offset=...)
- Tests Multi-criteria filtering (Cash, GCash, Hybrid, Maya, COD, Search)
- Mixed Chaos Burst load simulation
- Custom concurrency and request counts
- Percentile latency calculations (p50, p90, p95, p99) and throughput (req/sec)

Usage:
  python3 scripts/stress_test.py                      # Runs full 4-scenario benchmark
  python3 scripts/stress_test.py --quick              # Quick 100-request check
  python3 scripts/stress_test.py -n 1000 -c 40        # 1,000 requests @ 40 parallel workers
  python3 scripts/stress_test.py --scenario summary   # Test only sales summary engine
  python3 scripts/stress_test.py --scenario pages     # Test only pagination scan
"""

import sys
import time
import argparse
import statistics
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

DEFAULT_BASE_URL = "http://localhost:5000/api"


def check_server_health(base_url: str) -> bool:
    """Verifies that the backend server is reachable before launching the test."""
    try:
        req = urllib.request.Request(f"{base_url}/sales/summary?tab=Today", headers={"User-Agent": "HealthCheck"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def run_scenario(name: str, total_reqs: int, concurrency: int, url_pool: list, timeout: float = 10.0):
    """Executes a concurrent stress test scenario and prints formatted statistics."""
    print(f"\n▶ Running Scenario: {name}")
    print(f"  • Load Profile: {total_reqs:,} requests across {concurrency} concurrent workers")

    def fetch(idx):
        url = url_pool[idx % len(url_pool)]
        t0 = time.perf_counter()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Seafudz-StressTest/2.0"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = resp.read()
                code = resp.status
            t1 = time.perf_counter()
            return (code == 200, (t1 - t0) * 1000, len(data), None)
        except urllib.error.HTTPError as e:
            t1 = time.perf_counter()
            return (False, (t1 - t0) * 1000, 0, f"HTTP {e.code}")
        except Exception as e:
            t1 = time.perf_counter()
            return (False, (t1 - t0) * 1000, 0, str(e)[:40])

    start_time = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        results = list(executor.map(fetch, range(total_reqs)))
    elapsed = time.perf_counter() - start_time

    success_count = sum(1 for r in results if r[0])
    failed_count = total_reqs - success_count
    latencies = [r[1] for r in results if r[0]]
    total_bytes = sum(r[2] for r in results if r[0])

    rps = total_reqs / elapsed if elapsed > 0 else 0
    avg_lat = statistics.mean(latencies) if latencies else 0
    med_lat = statistics.median(latencies) if latencies else 0
    min_lat = min(latencies) if latencies else 0
    max_lat = max(latencies) if latencies else 0

    sorted_lat = sorted(latencies)
    p90 = sorted_lat[int(len(sorted_lat) * 0.90)] if latencies else 0
    p95 = sorted_lat[int(len(sorted_lat) * 0.95)] if latencies else 0
    p99 = sorted_lat[int(len(sorted_lat) * 0.99)] if latencies else 0

    success_pct = (success_count / total_reqs) * 100

    print(f"  • Success Rate     : {success_count}/{total_reqs} ({success_pct:.1f}%)" + (f" — {failed_count} errors" if failed_count else ""))
    print(f"  • Throughput       : {rps:.1f} req/sec in {elapsed:.2f} seconds")
    print(f"  • Latency Stats    : Min: {min_lat:.1f}ms | Avg: {avg_lat:.1f}ms | Med: {med_lat:.1f}ms | Max: {max_lat:.1f}ms")
    print(f"  • Percentiles      : p90: {p90:.1f}ms | p95: {p95:.1f}ms | p99: {p99:.1f}ms")
    print(f"  • Data Transferred : {total_bytes / (1024 * 1024):.2f} MB")

    return {
        "scenario": name,
        "requests": total_reqs,
        "concurrency": concurrency,
        "success_rate": success_pct,
        "rps": rps,
        "avg_ms": avg_lat,
        "p95_ms": p95,
        "p99_ms": p99,
        "duration_sec": elapsed,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Seafudz ng Bayan — API Stress & Load Test CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 scripts/stress_test.py
  python3 scripts/stress_test.py --quick
  python3 scripts/stress_test.py -n 1000 -c 40
  python3 scripts/stress_test.py --scenario summary
  python3 scripts/stress_test.py --scenario pages
  python3 scripts/stress_test.py --scenario chaos
        """
    )
    parser.add_argument("-n", "--requests", type=int, default=None, help="Total requests per scenario (default varies by scenario)")
    parser.add_argument("-c", "--concurrency", type=int, default=None, help="Number of parallel worker threads")
    parser.add_argument("--url", type=str, default=DEFAULT_BASE_URL, help=f"Base API URL (default: {DEFAULT_BASE_URL})")
    parser.add_argument("--scenario", choices=["all", "summary", "pages", "filter", "chaos"], default="all", help="Target scenario to run")
    parser.add_argument("--quick", action="store_true", help="Run a fast 100-request smoke test")

    args = parser.parse_args()
    base_url = args.url.rstrip("/")

    print("=" * 80)
    print("🚀 SEAFUDZ NG BAYAN — LOAD & STRESS TEST ENGINE")
    print(f"   Target Server: {base_url}")
    print("=" * 80)

    # 1. Health check
    if not check_server_health(base_url):
        print(f"\n[!] ERROR: Could not connect to {base_url}.")
        print("    Please make sure your backend server is running (e.g., ./start-dev.sh)")
        sys.exit(1)

    print("[✓] Backend server is online and responding.")

    # 2. Configure Scenarios
    scenarios_to_run = []

    if args.quick:
        scenarios_to_run.append((
            "Quick Smoke Check",
            100,
            10,
            [
                f"{base_url}/sales/summary?tab=Today",
                f"{base_url}/sales/summary?tab=This%20Month",
                f"{base_url}/orders?limit=10&offset=0&tab=Today",
                f"{base_url}/orders?limit=10&offset=0&payment=Hybrid",
            ]
        ))
    else:
        if args.scenario in ("all", "summary"):
            reqs = args.requests or 500
            workers = args.concurrency or 25
            scenarios_to_run.append((
                "1. High Concurrency Summary Engine",
                reqs,
                workers,
                [
                    f"{base_url}/sales/summary?tab=Today",
                    f"{base_url}/sales/summary?tab=This%20Week",
                    f"{base_url}/sales/summary?tab=This%20Month",
                    f"{base_url}/sales/summary?tab=This%20Year",
                    f"{base_url}/sales/summary",
                ]
            ))

        if args.scenario in ("all", "pages"):
            reqs = args.requests or 600
            workers = args.concurrency or 30
            scenarios_to_run.append((
                "2. Deep Pagination & Offset Scan (10 items/page)",
                reqs,
                workers,
                [f"{base_url}/orders?limit=10&offset={offset}&tab=Today" for offset in range(0, 400, 10)] +
                [f"{base_url}/orders?limit=10&offset={offset}&tab=This%20Month" for offset in range(0, 1000, 50)]
            ))

        if args.scenario in ("all", "filter"):
            reqs = args.requests or 600
            workers = args.concurrency or 30
            scenarios_to_run.append((
                "3. Payment & Search Multi-Filtering",
                reqs,
                workers,
                [
                    f"{base_url}/orders?limit=10&offset=0&payment=Hybrid",
                    f"{base_url}/orders?limit=10&offset=0&payment=GCash",
                    f"{base_url}/orders?limit=10&offset=0&payment=Cash",
                    f"{base_url}/orders?limit=10&offset=0&type=Online",
                    f"{base_url}/orders?limit=10&offset=0&type=POS",
                    f"{base_url}/orders?limit=10&offset=0&search=Seafood",
                    f"{base_url}/orders?limit=10&offset=0&search=Crab",
                ]
            ))

        if args.scenario in ("all", "chaos"):
            reqs = args.requests or 1000
            workers = args.concurrency or 50
            scenarios_to_run.append((
                "4. Mixed Chaos Spike Load (Simultaneous Burst)",
                reqs,
                workers,
                [
                    f"{base_url}/sales/summary?tab=Today",
                    f"{base_url}/sales/summary",
                    f"{base_url}/orders?limit=10&offset=0&tab=Today",
                    f"{base_url}/orders?limit=10&offset=50&payment=Hybrid",
                    f"{base_url}/orders?limit=100&tab=Today",
                    f"{base_url}/orders?limit=10&offset=0&payment=GCash",
                ]
            ))

    # 3. Execute all scheduled scenarios
    results = []
    total_start = time.perf_counter()

    for name, total_reqs, workers, url_pool in scenarios_to_run:
        res = run_scenario(name, total_reqs, workers, url_pool)
        results.append(res)

    total_elapsed = time.perf_counter() - total_start
    total_completed_reqs = sum(r["requests"] for r in results)

    # 4. Final Executive Summary Table
    print("\n" + "=" * 80)
    print("📊 OVERALL BENCHMARK SUMMARY")
    print("=" * 80)
    print(f"Total Requests Executed : {total_completed_reqs:,}")
    print(f"Total Benchmark Time    : {total_elapsed:.2f} seconds")
    print(f"Overall Net Throughput  : {total_completed_reqs / total_elapsed:.1f} req/sec")
    print("-" * 80)
    print(f"{'Scenario Name':<42} | {'Success':<8} | {'Throughput':<12} | {'p95 Latency'}")
    print("-" * 80)
    for r in results:
        print(f"{r['scenario']:<42} | {r['success_rate']:<7.1f}% | {r['rps']:<7.1f} r/s | {r['p95_ms']:.1f} ms")
    print("=" * 80)


if __name__ == "__main__":
    main()
