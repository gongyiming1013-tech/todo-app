import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_DIRECT_URL } from './config.js';

let supabase = null;

try {
    // Always use direct Supabase URL; the same-origin proxy can hit Cloudflare 1016.
    // SUPABASE_URL is imported for compatibility but not used for client init.
    supabase = createClient(SUPABASE_DIRECT_URL, SUPABASE_ANON_KEY);
    console.log('Supabase initialized (direct)');
} catch (e) {
    console.error('Supabase init failed:', e);
}

export { supabase };
