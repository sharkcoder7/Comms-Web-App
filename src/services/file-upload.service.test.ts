/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import * as fs from "fs";
import { doc, setDoc, Firestore } from "firebase/firestore";
import { getClientRefFns } from "@libs/utils/firestore-client-testing";
import { ImageCache, initializeDexie } from "./file-upload.service";
import { firebaseConfig } from "~/firebase";

let testEnv: RulesTestEnvironment;
let db: Firestore;
let dexie: ImageCache;

const { docRef, collectionRef, collectionGroupRef } = getClientRefFns(() => db);

/**
 * Helper function which expects an object with keys
 * equal to document paths and values equal to documents
 * which should be preloaded in firestore before
 * running a test.
 */
async function loadTestData(data: {
  [docPath: string]: { [docProp: string]: unknown };
}) {
  await testEnv.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();

    await Promise.all(
      Object.entries(data).map(async ([path, docData]) => {
        await setDoc(doc(db, path), docData);
      }),
    );
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: firebaseConfig.projectId,
    firestore: {
      host: import.meta.env.VITE_FIREBASE_EMULATOR_HOSTNAME,
      port: Number(import.meta.env.VITE_FIREBASE_EMULATOR_FIRESTORE_PORT),
      rules: fs.readFileSync("../../../../firestore.rules", "utf8"),
    },
    storage: {
      host: import.meta.env.VITE_FIREBASE_EMULATOR_HOSTNAME,
      port: Number(import.meta.env.VITE_FIREBASE_EMULATOR_STORAGE_PORT),
      rules: fs.readFileSync("../../../../storage.rules", "utf8"),
    },
  });
});

beforeEach(() => {
  dexie = initializeDexie("userId");
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await dexie.delete();
});

it.todo("nothing to see here");
