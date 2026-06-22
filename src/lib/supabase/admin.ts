import { createClient } from "@supabase/supabase-js";

/**
 * 用于调用 auth.admin.* 接口（createUser、inviteUserByEmail 等）
 * 仅在 Server Actions / Route Handlers 中使用，禁止暴露到客户端
 */
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_SERVICE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
