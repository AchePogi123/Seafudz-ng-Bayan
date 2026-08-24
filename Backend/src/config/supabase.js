import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://tdvesymqekznyboxtizs.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdmVzeW1xZWt6bnlib3h0aXpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzU3MTIsImV4cCI6MjA5ODIxMTcxMn0.o6hGlRq_crtTVpvfk_QogDC89T1bGJ4nAbIHLpmZHu4';

export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
