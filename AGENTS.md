# Seafudz ng Bayan 1 — Agent Guidelines & Session Capture

## Project Context
- **Repository Path**: `/home/ohmyiu/Documents/Seafudz-ng-Bayan1`
- **Description**: Point-of-Sale (POS), Kitchen Display System (KDS), Order Management, and Delivery tracking platform for seafood restaurants.
- **Frontend**: React, TypeScript, Vite, Tailwind CSS (Firebase Hosting)
- **Backend**: Node.js, Express (Containerized, GCP Cloud Run)
- **Database**: PostgreSQL (Docker container on port 5432 for local dev; GCP Cloud SQL for production)
- **CI/CD**: Google Cloud Build

---

## Vault Session Retention & Knowledge Capture
- **Vault Location**: `/home/zacrisr/Documents/Obsidian` (Obsidian Development Vault)
- **Master Project Hub**: `/home/zacrisr/Documents/Obsidian/Development/Seafudz ng Bayan 1.md`
- **User Flows & Role-Specific Changelogs**: `/home/zacrisr/Documents/Obsidian/Development/User Flows/`
  - `Customer Flow.md` — Online customer menu, cart, tracking, and account updates.
  - `Assistant Flow.md` — Order verification, payment proof inspection, and refund coordination.
  - `Kitchen Flow.md` — Kitchen ticket management, cooking state, and out-of-stock toggles.
  - `Rider Flow.md` — Dispatch queue, companion bundling, and delivery completion.
  - `Cashier & POS Flow.md` — Counter orders, split billing, thermal receipts, and sales reports.
  - `Admin Flow.md` — Analytics, employee accounts, security, and backup management.
- **Rule**:
  - **Role-Based Logging**: When making architectural or feature changes, append the change directly to the affected role note in `User Flows/` under `## 📜 Updates & Feature Changelog`.
  - **Zero Noise**: DO NOT create scattered session files for routine Git operations (merges/pushes) or trivial CSS tweaks.
  - Keep `INDEX.md` and `Seafudz ng Bayan 1.md` synchronized with clean wiki-links.
