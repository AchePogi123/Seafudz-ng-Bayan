import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../src/config/db.js';
import {
  getProductImageStorage,
  PRODUCT_IMAGE_PREFIX,
} from '../src/config/productImageStorage.js';
import { validateAndNormalizeProductImage } from '../src/utils/validateProductImage.js';

dotenv.config();

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_MENU_DIR = path.resolve(SCRIPT_DIR, '../../Frontend/src/assets/menu');
const SUPABASE_PROJECT_REF = 'tdvesymqekznyboxtizs';

const ASSETS = {
  'all-shrimp-alacarte-199': 'ALL SHRIMP_Alacarte_199 pesos.jpg',
  'all-shrimp-bowl-699': 'ALL SHRIMP_Bowl_699 pesos.jpg',
  'all-shrimp-tray-1099': 'ALL SHRIMP_Tray_1099 pesos.jpg',
  'mixed-seafoods-alacarte-99': 'Mixedseafoods_Mixed Seafoods Alacarte_99 pesos.jpg',
  'mixed-seafoods-tub-189': 'Mixedseafoods_Mixed Seafoods Alacarte_Tub_189 pesos.jpg',
  'mixed-seafoods-bowl-699': 'Mixedseafoods_Mixed Seafoods Alacarte_Bowl_699 pesos.jpg',
  'mixed-seafoods-tray-1199': 'Mixedseafoods_Mixed Seafoods Alacarte_Tray_1199 pesos.jpg',
  'chicken-pastil-35': 'Chicken-Pastil_VALUE MEALS_35 pesos.jpg',
  'fried-noodles-35': 'Fried_Noodles_VALUE MEALS_35 pesos.jpg',
  'chao-fan-35': 'chao_fan_VALUE MEALS_35 pesos.jpg',
  'pork-siomai-5': 'pork_siomai_SIOMAI_5 pesos.jpg',
  'beef-siomai-5': 'beef_siomai_SIOMAI_5 pesos.jpg',
  'chicken-siomai-5': 'chicken_siomai_SIOMAI__5 pesos.jpg',
  'sharksfin-siomai-5': 'sharksfin_siomai_SIOMAI_5 pesos.jpg',
  'japanese-siomai-6': 'japanese_siomai_SIOMAI_6 pesos.jpg',
  'corn-addon-20': 'Corn_SEAFOODS ADD ONS_20 pesos.jpeg',
  'rice-cup-20': 'Rice_one cup_SEAFOODS ADD ONS_20 pesos.jpg',
  'shrimp-regular-addon-20': 'Shrimp Regular_SEAFOODS ADD ONS_20 pesos.jpg',
  'shrimp-jumbo-addon-30': 'Shrimp Jumbo_SEAFOODS ADD ONS 30 pesos.jpg',
  'tahong-addon-30': 'Tahong_SEAFOODS ADD ONS_30 pesos.jpg',
  'sausage-addon-50': 'sausage_SEAFOODS ADD ONS_50 pesos.jpeg',
  'special-sauce-addon-30': 'specailsauce_SEAFOODS ADD ONS_30 pesos.jpg',
  'lemonade-small-40': 'Lemonade_small_SHAKE&LEMONADE_40 pesos.jpg',
  'lemonade-big-50': 'Lemonade_big_SHAKE&LEMONADE_50 pesos.jpg',
  'cucumber-lemonade-small-40': 'cucumberlemonade_small_SHAKE&LEMONADE_40 pesos.jpeg',
  'cucumber-lemonade-big-50': 'cucumberLemonade big_SHAKE&LEMONADE_50 pesos.jpg',
  'shake-small-40': 'snakes_small_SHAKE&LEMONADE_40 peso.jpg',
  'shake-big-50': 'snakes_big_SHAKE&LEMONADE_50 peso.jpg',
  'mango-pudding-50': 'Mango Pudding_DESSERTS_50 pesos.jpg',
  'banana-con-yelo-50': 'bananaconyelo_DESSERTS_50 pesos.jpg',
  'ice-cream-50': 'icecream_DESSERTS_50 pesos.jpg',
  'mineral-water-15': 'Mineral Wate_500ml_DRINKS_15 pesos.jpg',
  'black-coffee-30': 'blackcoffee_Black Coffee_30 pesos.jpg',
  'coke-mismo-25': 'cokemismo_250ml_DRINKS_25 pesos.jpg',
  'coke-1-5l-110': 'coke_1.5liters_DRINKS_110 pesos.jpg',
  'sprite-mismo-25': 'spritemismo_250ml_DRINKS_25 pesos.jpg',
  'sprite-1-5l-100': 'sprite_1.5_DRINKS_100 pesos.jpg',
  'royal-mismo-25': 'royalmismo_250ml_DRINKS_25 pesos.jpg',
  'royal-1-5l-100': 'royal_1.5_DRINKS_100 pesos.jpg',
  'icetea-glass-20': 'icetea_ADD ONS_DRINKS_20 pesos.jpg',
  'icetea-pitcher-100': 'icetea_SEAFOODS ADD ONS_100 pesos.jpg',
};

function getArg(name) {
  return process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function verifyTarget(target) {
  const url = process.env.SUPABASE_URL || '';
  if (new URL(url).hostname.split('.')[0] !== SUPABASE_PROJECT_REF) {
    throw new Error(`SUPABASE_URL must target the confirmed project ${SUPABASE_PROJECT_REF}.`);
  }

  const { rows } = await query(
    'SELECT current_database() AS database, inet_server_addr()::text AS address, inet_server_port() AS port'
  );
  const db = rows[0];
  if (target === 'local') {
    const host = process.env.DB_HOST || process.env.PGHOST || 'localhost';
    const loopback = ['localhost', '127.0.0.1', '::1'].includes(host);
    if (!loopback || db.database !== 'seafudz_db' || ![5432, 5433].includes(Number(db.port))) {
      throw new Error(`Local target mismatch: expected seafudz_db on loopback:5432/5433, found ${JSON.stringify(db)}.`);
    }
  } else {
    const confirmation = getArg('--confirm-production');
    const expectedProject = getArg('--confirm-project');
    if (
      !confirmation ||
      confirmation !== db.database ||
      expectedProject !== SUPABASE_PROJECT_REF ||
      !process.env.INSTANCE_CONNECTION_NAME
    ) {
      throw new Error('Production requires --confirm-project=<project-ref> and --confirm-production=<exact-db-name> with Cloud SQL configured.');
    }
  }
  return db;
}

async function main() {
  const target = getArg('--target');
  const apply = process.argv.includes('--apply');
  if (!['local', 'production'].includes(target)) {
    throw new Error('Specify --target=local or --target=production. Dry run is the default; add --apply to write.');
  }
  const db = await verifyTarget(target);
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} target confirmed: ${JSON.stringify(db)}`);

  const ids = Object.keys(ASSETS);
  const { rows } = await query('SELECT id::text AS id, name, image FROM products');
  const products = new Map(rows.map((row) => [row.id, row]));
  const unmapped = rows.filter((row) => !Object.hasOwn(ASSETS, row.id));
  const missingRows = ids.filter((id) => !products.has(id));
  const missingAssets = [];
  const existing = [];
  const candidates = [];

  for (const id of ids) {
    const filename = ASSETS[id];
    const filepath = path.join(FRONTEND_MENU_DIR, filename);
    if (!existsSync(filepath)) {
      missingAssets.push({ id, filename });
      continue;
    }
    const product = products.get(id);
    if (!product) continue;
    if (product.image !== null) {
      existing.push({ id, image: product.image });
      continue;
    }
    candidates.push({ id, filename, filepath });
  }

  console.log(`Mapped IDs: ${ids.length}; missing product rows: ${missingRows.length}; missing local assets: ${missingAssets.length}`);
  console.log(`Existing non-null images (skipped): ${existing.length}; unmapped DB products (untouched): ${unmapped.length}`);
  if (missingRows.length) console.log('Missing product IDs:', missingRows);
  if (missingAssets.length) console.log('Missing assets:', missingAssets);
  if (unmapped.length) console.log('Unmapped products (not changed):', unmapped.map(({ id, name }) => ({ id, name })));
  if (existing.length) console.log('Existing image values (not overwritten):', existing);
  if (!apply) {
    console.log(`Would process ${candidates.length} NULL image rows. Re-run with --apply only after reviewing this report.`);
    return;
  }

  const storage = getProductImageStorage();
  const failures = [];
  for (const item of candidates) {
    try {
      const normalized = await validateAndNormalizeProductImage(readFileSync(item.filepath));
      const objectPath = `${PRODUCT_IMAGE_PREFIX}${item.id}/initial.${normalized.extension}`;
      const { error: uploadError } = await storage.upload(objectPath, normalized.buffer, {
        contentType: normalized.contentType,
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const result = await query(
        'UPDATE products SET image = $1 WHERE id::text = $2 AND image IS NULL RETURNING id',
        [objectPath, item.id]
      );
      if (result.rowCount !== 1) {
        failures.push({ id: item.id, error: 'Image row changed during upload; object may need cleanup.' });
      } else {
        console.log(`Updated ${item.id} -> ${objectPath}`);
      }
    } catch (error) {
      failures.push({ id: item.id, error: error.message });
    }
  }

  const { rows: finalRows } = await query(
    'SELECT id::text AS id, image FROM products WHERE id::text = ANY($1::text[])',
    [ids]
  );
  const finalMap = new Map(finalRows.map((row) => [row.id, row.image]));
  const verified = ids.filter((id) => finalMap.get(id));
  console.log(`Final mapping verification: ${verified.length}/${ids.length} product rows have image values.`);
  if (failures.length) console.error('Upload/update failures:', failures);
  if (verified.length !== ids.length || missingAssets.length || missingRows.length || failures.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
