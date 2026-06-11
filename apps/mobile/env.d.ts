/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_IDENT_BOOKING_URL?: string;
    EXPO_PUBLIC_PRIVACY_URL?: string;
    EXPO_PUBLIC_TERMS_URL?: string;
    EXPO_PUBLIC_IMPRINT_URL?: string;
    EXPO_PUBLIC_SENTRY_DSN?: string;
  }
}
