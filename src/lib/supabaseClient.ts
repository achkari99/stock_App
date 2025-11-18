import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  typeof supabaseUrl === "string" &&
  supabaseUrl.length > 0 &&
  typeof supabaseAnonKey === "string" &&
  supabaseAnonKey.length > 0
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
        },
      })
    : null;

if (!supabase) {
  console.warn(
    "[Supabase] Les variables d'environnement VITE_SUPABASE_URL et/ou VITE_SUPABASE_ANON_KEY ne sont pas definies. Bascule vers le stockage local.",
  );
}
