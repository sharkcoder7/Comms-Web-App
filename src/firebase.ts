import { FirebaseOptions, initializeApp } from "firebase/app";
import {
  initializeFirestore,
  CACHE_SIZE_UNLIMITED,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  getFunctions,
  httpsCallable,
  HttpsCallableOptions,
  connectFunctionsEmulator,
} from "firebase/functions";
import { ICallableFnsTypeMap } from "@libs/firebase-functions-types";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectStorageEmulator, getStorage } from "firebase/storage";

export const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
});

export const functions = getFunctions(app);

export const auth = getAuth(app);

export const storage = getStorage(app);

if (
  import.meta.env.VITE_FIREBASE_EMULATORS === "true" &&
  import.meta.env.VITE_FIREBASE_EMULATOR_HOSTNAME &&
  import.meta.env.VITE_FIREBASE_EMULATOR_AUTH_URL &&
  import.meta.env.VITE_FIREBASE_EMULATOR_FIRESTORE_PORT &&
  import.meta.env.VITE_FIREBASE_EMULATOR_FUNCTION_PORT &&
  import.meta.env.VITE_FIREBASE_EMULATOR_STORAGE_PORT
) {
  console.log("ENABLING FIREBASE EMULATORS");

  connectFirestoreEmulator(
    db,
    import.meta.env.VITE_FIREBASE_EMULATOR_HOSTNAME,
    Number(import.meta.env.VITE_FIREBASE_EMULATOR_FIRESTORE_PORT),
  );

  connectAuthEmulator(auth, import.meta.env.VITE_FIREBASE_EMULATOR_AUTH_URL, {
    disableWarnings: true,
  });

  connectFunctionsEmulator(
    functions,
    import.meta.env.VITE_FIREBASE_EMULATOR_HOSTNAME,
    Number(import.meta.env.VITE_FIREBASE_EMULATOR_FUNCTION_PORT),
  );

  connectStorageEmulator(
    storage,
    import.meta.env.VITE_FIREBASE_EMULATOR_HOSTNAME,
    Number(import.meta.env.VITE_FIREBASE_EMULATOR_STORAGE_PORT),
  );
}

/**
 * Returns a reference to the callable HTTPS trigger with the given name
 * that has both argument and return value type safety.
 */
export const getTypedCallableFn = <T extends keyof ICallableFnsTypeMap>(
  name: T,
  options?: HttpsCallableOptions | undefined,
) => {
  return httpsCallable<ICallableFnsTypeMap[T][0], ICallableFnsTypeMap[T][1]>(
    functions,
    name,
    options,
  );
};
