import { shareReplay, map, distinctUntilChanged } from "rxjs";
import { collectionData } from "rxfire/firestore";
import { collectionRef } from "~/firestore.service";
import { useObservable } from "~/utils/useObservable";
import { IAPIVersionDoc } from "@libs/firestore-models";
import { limit, orderBy, query } from "firebase/firestore";
import { isEqual } from "@libs/utils/isEqual";
import { auth } from "~/firebase";

export const CLIENT_API_VERSION = 1;

console.debug("CLIENT_API_VERSION", CLIENT_API_VERSION);

export const SERVER_API_VERSION$ = collectionData(
  query(collectionRef("apiVersion"), orderBy("version", "desc"), limit(1)),
).pipe(
  map((docs) => (docs[0] ?? null) as IAPIVersionDoc | null),
  distinctUntilChanged(isEqual),
  shareReplay(),
);

let serverAPIVersion: IAPIVersionDoc | null = null;

// we maintain one subscription to the current user state
// for speedier retrieval
SERVER_API_VERSION$.subscribe((doc) => {
  console.debug("SERVER_API_VERSION", doc);
  serverAPIVersion = doc;

  if (serverAPIVersion?.version !== CLIENT_API_VERSION) {
    setTimeout(() => auth.signOut(), 5);
  }
});

export function useServerAPIVersion() {
  return useObservable(
    () =>
      SERVER_API_VERSION$.pipe(
        map((serverVersion) => ({
          server: serverVersion,
          client: CLIENT_API_VERSION,
          matches: serverVersion?.version === CLIENT_API_VERSION,
        })),
      ),
    {
      initialValue: "loading" as const,
    },
  );
}

export function getServerAPIVersion() {
  return serverAPIVersion;
}

export function getAndAssertServerAPIVersion() {
  if (!serverAPIVersion) {
    throw new Error("Expected serverAPIVersion to be non-null.");
  }

  return serverAPIVersion;
}
