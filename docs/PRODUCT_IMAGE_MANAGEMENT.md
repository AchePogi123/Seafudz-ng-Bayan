# Product Image Management

Product photos are stored in the confirmed Supabase project `tdvesymqekznyboxtizs`, in the public-read `menu-images` bucket. The `products.image` value contains a managed object path such as `products/all-shrimp-alacarte-199/<uuid>.webp`; the backend turns managed paths into public URLs for menu responses. Existing non-managed image values are passed through unchanged.

## Access and configuration

- Keep `SUPABASE_SERVICE_ROLE_KEY` on the backend only. It is required by image upload and delete operations; those operations never fall back to an anon key.
- Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the backend runtime. Do not add the service-role key to frontend environment variables or `VITE_*` configuration.
- The `menu-images` bucket must remain public-read so anonymous customers can load product photos. Storage mutations are performed only by the backend service-role client.
- Upload and restore routes require a verified, active Admin employee. Synthetic development authentication, inactive staff, and non-Admin roles are rejected.
- Uploads are limited to 5 MB and decoded/re-encoded by the backend. JPEG, PNG, and WebP are accepted; SVG and other formats are not.

## Backfill

The backfill is a data operation, not a SQL migration. It uses an explicit 41-product ID-to-asset map and changes only rows whose `image` is `NULL`. Existing values, legacy products, unmapped products, and missing assets are reported and not overwritten.

Start with a read-only dry run against the local database:

```sh
cd Backend
npm run images:backfill -- --target=local
```

Review the complete report before applying. The write command is explicitly scoped to the local `seafudz_db` on loopback port `5433`:

```sh
npm run images:backfill -- --target=local --apply
```

Production requires a second, exact database-name confirmation and the confirmed Supabase project reference:

```sh
npm run images:backfill -- --target=production \
  --confirm-project=tdvesymqekznyboxtizs \
  --confirm-production=<exact-production-database-name>
```

Review that dry-run report, then append `--apply` only after verifying the active Cloud SQL connection and target database. The script checks the actual PostgreSQL target before reading or writing; it never infers production from a default.

## Replacement and recovery behavior

Replacement uploads a uniquely named object, commits its managed path to PostgreSQL, then attempts to remove the prior managed object. If the database transaction fails, the backend attempts to remove the newly uploaded object and logs cleanup failures. A failed old-object deletion does not undo a successful replacement; the new photo stays active and the stale object is logged for later cleanup. Restore clears `products.image` first and deletes only an object in the same product's managed prefix.

The online menu, POS, Admin catalog, and cart thumbnails merge only the image field into the local catalog. Bundled product assets remain the first fallback; a placeholder is used only if both remote and bundled images fail. Pricing and order snapshots are unchanged.
