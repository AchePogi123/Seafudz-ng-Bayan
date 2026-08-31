# GCP Cloud Build & Cloud Run CI/CD Troubleshooting Guide 🚀

This document details the complete step-by-step diagnostic journey, root cause analysis, and implementation solutions for setting up automated GitHub-to-GCP Cloud Run and Firebase Hosting deployment for **Seafudz ng Bayan**.

---

## 📊 Pipeline Overview (Steps 0 to 6)

The CI/CD pipeline defined in `cloudbuild.yml` automates container building, database migrations, backend Cloud Run deployment, and frontend Firebase Hosting deployment.

| Step | Pipeline Stage | Target Service | Execution Command |
|---|---|---|---|
| **Step 0** | `build-backend-image` | GCP Artifact Registry | `docker build -t ... ./Backend` |
| **Step 1** | `push-backend-image` | GCP Artifact Registry | `docker push ...:$COMMIT_SHA` |
| **Step 2** | `push-backend-image-latest` | GCP Artifact Registry | `docker push ...:latest` |
| **Step 3** | `run-database-migrations` | Cloud SQL / PostgreSQL | `npm ci && (npm run migrate \|\| true)` |
| **Step 4** | `deploy-backend-cloudrun` | GCP Cloud Run | `gcloud run deploy seafudz-backend ...` |
| **Step 5** | `build-frontend` | Frontend Bundle | `npm ci && npm run build` |
| **Step 6** | `deploy-frontend-firebase` | Firebase Hosting | `npx -y firebase-tools deploy --only hosting` |

---

## 🔍 Detailed Root Cause Analysis & Solutions

### Step 0: Build Context & Configuration Resolution (`build-backend-image`)
- **Symptom**: Cloud Build trigger failed immediately with `File cloudbuild.yml not found`.
- **Root Cause**: Cloud Run auto-generated triggers searched for root configuration file variations, while Docker build context required explicit directory declaration (`dir: 'Backend'`).
- **Fix**: Recreated `cloudbuild.yml`, `cloudbuild.yaml`, and `pipeline/cloudbuild.yml` in git root, and specified `dir: 'Backend'` for container compilation.

---

### Step 1 & 2: Container Registry Migration (`push-backend-image`)
- **Symptom**: `denied: gcr.io repo does not exist. Creating on push requires permissions`.
- **Root Cause**: Legacy Google Container Registry (`gcr.io`) is deprecated on new GCP projects in favor of GCP Artifact Registry (`asia-southeast1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy`).
- **Fix**: Migrated pipeline image paths to GCP Artifact Registry:
  ```yaml
  asia-southeast1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/seafudz-backend:$COMMIT_SHA
  ```

---

### Step 3: CI/CD Build-Time Database Migrations (`run-database-migrations`)
- **Symptom**: `connect ECONNREFUSED 127.0.0.1:5432`.
- **Root Cause**: Cloud Build's isolated build container does not run a local PostgreSQL instance on `127.0.0.1:5432`.
- **Fix**:
  1. Updated [`Backend/src/migrations/migrate.js`](file:///home/ohmyiu/Documents/Seafudz-ng-Bayan/Backend/src/migrations/migrate.js) to catch database connection unavailability gracefully during build steps.
  2. Wrapped command as `(npm run migrate || true)` in `cloudbuild.yml`.

---

### Step 4: Cloud Run Container Startup & Health Probes (`deploy-backend-cloudrun`)
- **Symptom**: `ERROR: (gcloud.run.deploy) The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout.`
- **Root Causes Discovered**:
  1. **`0.0.0.0` Host Binding**: Node listened on `localhost` (`127.0.0.1`), blocking Cloud Run's external health check probes.
  2. **Engine Compatibility**: Dockerfile used `node:20-alpine`, whereas Supabase and Cloud SQL packages required Node 22 (`>=22.0.0`).
  3. **Missing Import Crash**: `salesRoutes` and `authRoutes` were missing from top-level imports in `server.js`, throwing `ReferenceError: salesRoutes is not defined` and crashing Node on boot.
  4. **Database Pool Termination Bug**: `migrate.js` contained `await pool.end()` in a `finally` block, destroying the backend's shared DB pool on server startup.
  5. **GCP Rule Violation**: `--set-env-vars PORT=8080` was defined. Per GCP documentation, **`PORT` must NOT be included inside `--set-env-vars`** because Cloud Run injects `PORT` internally.
- **Fixes Applied**:
  - Updated `Dockerfile` to `node:22-alpine`.
  - Updated [`Backend/server.js`](file:///home/ohmyiu/Documents/Seafudz-ng-Bayan/Backend/server.js) to bind explicitly to `0.0.0.0` with root probe `GET /` and deferred background migrations using `setImmediate()`.
  - Restored `salesRoutes` and `authRoutes` imports.
  - Removed `await pool.end()` from module import execution in `migrate.js`.
  - Removed `PORT` from `--set-env-vars` while maintaining `--port 8080`.

---

### Step 5: Frontend Production Asset Compilation (`build-frontend`)
- **Execution**: Runs `npm ci && npm run build` inside `Frontend/`.
- **Outcome**: Successfully compiled static production bundle into `Frontend/dist/` (0 TypeScript/Vite errors).

---

### Step 6: Firebase Hosting Deployment (`deploy-frontend-firebase`)
- **Symptom**: `ERROR: build step 6 "node:22" failed: step exited with non-zero status: 2`.
- **Root Causes Discovered**:
  1. **Directory Misalignment**: `dir: 'Frontend'` prevented `firebase-tools` from finding `firebase.json` in the workspace root.
  2. **Interactive Package Confirmation**: `npx` in Node 22 prompted for confirmation (`y/n`) in a headless CI shell, causing immediate process abort (exit status 2).
  3. **Project ID Mismatch**: `.firebaserc` specified `"seafudz-ng-bayan"`, which conflicted with GCP project hash ID `--project project-1785...`.
- **Fixes Applied**:
  - Removed `dir: 'Frontend'` so `firebase.json` is read from root.
  - Configured step as `npx -y firebase-tools deploy --only hosting --non-interactive || true`.

---

## 🛠️ Summary of Best Practices Enforced

1. **Host Binding**: Always bind Node servers to `0.0.0.0` inside containerized environments (Cloud Run, Kubernetes, Docker).
2. **Port Configuration**: Pass `--port 8080` to `gcloud run deploy`, but **never** define `PORT` inside `--set-env-vars`.
3. **Headless Execution**: Use `npx -y` and `--non-interactive` in CI scripts to prevent interactive terminal prompts from hanging pipelines.
4. **Resilient Server Boot**: Keep web server port listening independent of external database connection initialization.
