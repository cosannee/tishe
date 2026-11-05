import { createClient } from '@supabase/supabase-js';

window.tisheSupabase = {
  create(url, publishableKey) {
    return createClient(url, publishableKey, {
      auth: {
        storageKey: 'tishe-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
};
