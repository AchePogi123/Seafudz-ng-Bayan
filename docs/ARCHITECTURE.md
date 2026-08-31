# Architecture Overview - Seafudz ng Bayan

This document describes the architectural layout, component hierarchy, cloud infrastructure, and state management data flow of the **Seafudz ng Bayan** application.

For detailed sequence diagrams and flowcharts, see [DATA_FLOW.md](file:///home/ohmyiu/Documents/Seafudz-ng-Bayan/DATA_FLOW.md).

---

## 📂 Project Directory Structure

The project is structured as a monorepo containing client, backend, and infrastructure definitions:

```text
Seafudz-Ng-Bayan/
├── ARCHITECTURE.md          # System architecture overview
├── DATA_FLOW.md             # Sequence diagrams & data flow documentation
├── gcp_cloudsql_schema.sql  # Production PostgreSQL schema script for GCP Cloud SQL
├── Backend/                 # Express.js REST API Server
│   ├── Dockerfile           # Docker configuration for GCP Cloud Run deployment
│   ├── server.js            # Express server entry point & route initialization
│   └── src/                 # REST controllers, routes & dataset models
└── Frontend/                # Client SPA (React 19, Vite 8, TypeScript 6, Tailwind CSS v4)
    ├── public/              # Static public assets
    ├── src/                 # Application source code
    │   ├── assets/          # Compressed food images & icons
    │   ├── components/      # Reusable presentational components (dumb)
    │   ├── features/        # Multi-role smart containers (POS, KDS, Assistant, Rider)
    │   ├── utils/           # Supabase client helper utilities
    │   ├── App.tsx          # React Router v7 routes definition
    │   └── main.tsx         # Client DOM entry point
    └── vite.config.ts       # Vite bundler & Tailwind CSS v4 plugin config
```

---

## ☁️ Cloud Architecture & Infrastructure Topology

The application operates on a hybrid cloud model splitting authentication and domain data:

```mermaid
graph TD
    User["React 19 Frontend App"]
    SupaAuth["Supabase Auth (Identity Only)\n- User signup & login\n- JWT Bearer token issuance"]
    CloudRun["GCP Cloud Run (Express API)\n- Request authentication middleware\n- Business logic & route handlers"]
    CloudSQL[("GCP Cloud SQL PostgreSQL (seafudz-db)\n- employees, customers, orders\n- menu_items, tables, assistant_calls")]

    User -- "1. Authenticate (Email/Pass)" --> SupaAuth
    SupaAuth -- "2. Returns Session JWT" --> User
    User -- "3. REST Requests + Bearer JWT" --> CloudRun
    CloudRun -- "4. Verify Bearer Token" --> SupaAuth
    CloudRun -- "5. Read/Write Data" --> CloudSQL
```

---

## 🔄 End-to-End Data Flow Overview

```mermaid
sequenceDiagram
    participant Client as React Client App
    participant Supabase as Supabase Auth (auth.users)
    participant GCP_API as GCP Cloud Run API
    participant CloudSQL as GCP Cloud SQL DB

    Client->>Supabase: 1. signInWithPassword(email, pass)
    Supabase-->>Client: 2. Return Session { access_token (JWT), user.id }
    Client->>GCP_API: 3. API Request (Header: Authorization: Bearer JWT)
    GCP_API->>Supabase: 4. Verify Bearer Token
    Supabase-->>GCP_API: 5. Token Valid (User ID verified)
    GCP_API->>CloudSQL: 6. SELECT / UPDATE (by supabase_user_id)
    CloudSQL-->>GCP_API: 7. Return SQL ResultSet
    GCP_API-->>Client: 8. JSON Response Payload
```

---

## 🏗️ Frontend Architecture & Component Tree

The frontend follows a **"Container-Presentational"** (Smart-Dumb) architectural pattern:
1. **Smart Feature Container (`src/features/`)**: Maintains application state (cart items, active filters, table call resolution, delivery dispatch).
2. **Presentational Components (`src/components/`)**: Render visual UI driven by props and callback events.

### Component Render Tree

```mermaid
graph TD
    App["App (App.tsx)"] --> POS["POS (features/POS.tsx)"]
    App --> KDS["Kitchen (features/KitchenMode.tsx)"]
    App --> Assistant["Assistant (features/AssistantRole.tsx)"]
    App --> Rider["Rider (features/rideRoleDemo.tsx)"]
    App --> Tables["Tables (features/TableVisualizer.tsx)"]
    
    POS --> Navbar["Navbar (components/Navbar.tsx)"]
    POS --> CategoryTabs["CategoryTabs (components/CategoryTabs.tsx)"]
    POS --> MenuGrid["MenuGrid (components/MenuGrid.tsx)"]
    POS --> OrderSummary["OrderSummary (components/OrderSummary.tsx)"]
    POS --> SuccessModal["SuccessModal (components/SuccessModal.tsx)"]
    
    MenuGrid --> MenuCard["MenuCard (components/MenuCard.tsx)"]
    OrderSummary --> OrderItemRow["OrderItemRow (components/OrderItemRow.tsx)"]
```

---

## 🧮 Financial & VAT Calculations

All transaction values compute reactively:
1. **Subtotal**: Sum of `item.price * item.quantity` across cart items.
2. **VAT (Value Added Tax)**: `Subtotal * 0.12` (12% standard Philippine VAT).
3. **Grand Total**: `Subtotal + VAT`.

---

## 🔗 Related Documentation
- 📄 [DATA_FLOW.md](file:///home/ohmyiu/Documents/Seafudz-ng-Bayan/DATA_FLOW.md): Detailed sequence diagrams for all operational flows.
- 📄 [gcp_cloudsql_schema.sql](file:///home/ohmyiu/Documents/Seafudz-ng-Bayan/gcp_cloudsql_schema.sql): PostgreSQL database DDL script for Cloud SQL.
- 📄 [Backend/Dockerfile](file:///home/ohmyiu/Documents/Seafudz-ng-Bayan/Backend/Dockerfile): Cloud Run container deployment specification.
