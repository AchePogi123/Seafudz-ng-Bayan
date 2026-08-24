import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nvtozwvlbjqbujnzafoh.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_mSRd5dUpuEeF0OcFHdSAKg_13Ay72-K';

export const supabase = createClient(supabaseUrl, supabaseKey);