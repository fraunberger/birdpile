import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const createMissingConfigProxy = () => {
  const errorMessage =
    'Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.';

  return new Proxy(
    {},
    {
      get() {
        throw new Error(errorMessage);
      },
    }
  ) as SupabaseClient;
};

export const supabase: SupabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMissingConfigProxy();
