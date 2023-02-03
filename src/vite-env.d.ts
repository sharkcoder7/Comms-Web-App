/// <reference types="vite/client" />
/// <reference types="vitest/importMeta" />
/// <reference types="vitest/globals" />
/// <reference types="@types/testing-library__jest-dom" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_DATABASE_URL: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
  readonly VITE_FIREBASE_EMULATORS: string;
  readonly VITE_FIREBASE_EMULATOR_HOSTNAME: string;
  readonly VITE_FIREBASE_EMULATOR_FIRESTORE_PORT: string;
  readonly VITE_FIREBASE_EMULATOR_FUNCTION_PORT: string;
  readonly VITE_FIREBASE_EMULATOR_STORAGE_PORT: string;
  readonly VITE_FIREBASE_EMULATOR_AUTH_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
