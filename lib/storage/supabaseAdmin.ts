import { createClient } from '@supabase/supabase-js';

let adminClient: ReturnType<typeof createClient> | null = null;

/** Service-role Supabase client for server-only operations (Storage uploads). Never expose this to the browser. */
export function getSupabaseAdminClient() {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  adminClient = createClient(url, serviceRoleKey);
  return adminClient;
}
