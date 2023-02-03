import {
  collection,
  doc,
  collectionGroup,
  DocumentReference,
  getDoc,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db, storage } from "~/firebase";
import {
  catchError,
  filter,
  firstValueFrom,
  ObservableInput,
  of,
  pipe,
} from "rxjs";
import {
  TClientDocRefFunction,
  TClientCollectionRefFunction,
  TClientCollectionGroupRefFunction,
} from "@libs/utils/firestore";
import { ref, StorageReference } from "firebase/storage";
import { collectionData } from "rxfire/firestore";

/** Checks if an Error is a FirebaseError */
export function isFirebaseError(err: unknown): err is Error {
  return err instanceof Error && err.name === "FirebaseError";
}

/**
 * rxjs operator to catch a FirebaseError and return a defaultValue
 * instead.
 */
export function catchFirebaseError<I, T>(defaultValue: () => T) {
  return pipe(
    catchError<I, ObservableInput<T>>((err) => {
      if (isFirebaseError(err)) {
        console.debug(err);
        return of(defaultValue());
      }

      throw err;
    }),
  );
}

export async function waitForCacheToContainDoc(ref: DocumentReference) {
  await firstValueFrom(
    collectionData(
      query(
        collection(db, ref.parent.path),
        where("id", "==", ref.id),
        limit(1),
      ),
    ).pipe(filter((r) => r.length > 0)),
  );
}

export async function docExists(ref: DocumentReference): Promise<boolean> {
  return getDoc(ref)
    .then((s) => s.exists())
    .catch((e) => {
      console.debug("Error while checking document existance", e);
      console.warn(`Document "${ref.path}" not found.`);
      return false;
    });
}

export const docRef: TClientDocRefFunction = function (
  path: string,
  ...pathSegments: string[]
) {
  return doc(db, path, ...pathSegments);
};

export const collectionRef: TClientCollectionRefFunction = function (
  path: string,
  ...pathSegments: string[]
) {
  return collection(db, path, ...pathSegments);
};

export const collectionGroupRef: TClientCollectionGroupRefFunction = function (
  collectionId: string,
) {
  return collectionGroup(db, collectionId);
};

export function storageRef(
  a: "images",
  userId: string,
  imageId: string,
): StorageReference;
export function storageRef(...args: string[]): StorageReference {
  return ref(storage, args.join("/"));
}
