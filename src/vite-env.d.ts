/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Absent means the app runs local-only. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon key. Safe to ship; row-level security is what protects data. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
