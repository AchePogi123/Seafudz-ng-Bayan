import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://tdvesymqekznyboxtizs.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdmVzeW1xZWt6bnlib3h0aXpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzU3MTIsImV4cCI6MjA5ODIxMTcxMn0.o6hGlRq_crtTVpvfk_QogDC89T1bGJ4nAbIHLpmZHu4';

export const supabase = createClient(supabaseUrl, supabaseKey);