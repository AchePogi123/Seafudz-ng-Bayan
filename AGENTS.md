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
- **User Flows & Node Maps**: `/home/zacrisr/Documents/Obsidian/Development/User Flows/`
- **Architecture Notes**: `/home/zacrisr/Documents/Obsidian/Development/Architecture/`
- **Curated Session Logs**: `/home/zacrisr/Documents/Obsidian/Development/Sessions/`
- **Rule**:
  - **Lean & High-Value Only**: Log significant architectural changes, database schema updates, major business logic revisions, and new user flows into dedicated notes in `Sessions/`.
  - **Zero Noise**: DO NOT log trivial micro-commits, routine Git operations (such as merges/pushes), or minor cosmetic CSS tweaks.
  - Keep `/home/zacrisr/Documents/Obsidian/INDEX.md` and `Seafudz ng Bayan 1.md` synchronized with clean wiki-links.
