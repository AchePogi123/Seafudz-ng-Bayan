import { createClient } from '@supabase/supabase-js';

export const PRODUCT_IMAGE_BUCKET = 'menu-images';
export const PRODUCT_IMAGE_PREFIX = 'products/';

let storageClient;

export function getProductImageStorage() {
  if (storageClient) return storageClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Product image storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  storageClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).storage.from(PRODUCT_IMAGE_BUCKET);
  return storageClient;
}

export function isManagedProductImagePath(value) {
  return typeof value === 'string' &&
    /^products\/[a-z0-9-]+\/(?:[a-f0-9-]{36}|initial)\.(?:jpg|png|webp)$/i.test(value);
}

export function getProductImageUrl(value) {
  if (!isManagedProductImagePath(value)) return value;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return value;
  const encodedPath = value.split('/').map(encodeURIComponent).join('/');
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${encodedPath}`;
}
