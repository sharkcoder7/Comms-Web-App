import { isEqual } from "@libs/utils/isEqual";
import { Timestamp } from "firebase/firestore";
import { distinctUntilChanged, filter, map, shareReplay, Subject } from "rxjs";
import { startWith } from "~/utils/rxjs-operators";
import { CLIENT_API_VERSION } from "./version.service";

const PREFIX = `COMMS:${CLIENT_API_VERSION}`;

const channel = new BroadcastChannel("sessionStorage");

const STORAGE_CHANGES$ = new Subject<{ key: string; value: unknown }>();

function getKey(key: string) {
  return `${PREFIX}:${key}`;
}

export const sessionStorageService = {
  getItem<T = unknown>(key: string): T | undefined {
    const value = sessionStorage.getItem(getKey(key));
    if (typeof value !== "string") return undefined;
    return parse(value);
  },
  getItem$<T = unknown>(_key: string) {
    const key = getKey(_key);

    return STORAGE_CHANGES$.pipe(
      filter((c) => c.key === key),
      map((c) => c.value as T),
      startWith(() => this.getItem<T>(_key)),
      distinctUntilChanged(isEqual),
      shareReplay(1),
    );
  },
  setItem<T = unknown>(_key: string, value: T) {
    const key = getKey(_key);
    const json = stringify(value);

    if (isEqual(sessionStorage.getItem(key), json)) return;

    sessionStorage.setItem(key, json);

    STORAGE_CHANGES$.next({ key, value });

    channel.postMessage({
      type: "setItem",
      key,
      value: json,
    });
  },
  deleteItem(_key: string) {
    const key = getKey(_key);
    sessionStorage.removeItem(key);
    STORAGE_CHANGES$.next({ key, value: undefined });
    channel.postMessage({ type: "deleteItem", key });
  },
} as const;

/*
 * We're using BroadcastChannel#onmessage instead of subscribing
 * to "message" events to support testing in nodejs. The node
 * implementation of BroadcastChannel only supports onmessage.
 */
channel.onmessage = (e) => {
  switch (e.data.type) {
    case "setItem": {
      sessionStorage.setItem(e.data.key, e.data.value);
      STORAGE_CHANGES$.next({
        key: e.data.key,
        value: parse(e.data.value),
      });

      return;
    }
    case "deleteItem": {
      sessionStorage.removeItem(e.data.key);
      STORAGE_CHANGES$.next({ key: e.data.key, value: undefined });

      return;
    }
    case "getSessionStorage": {
      channel.postMessage({
        type: "sessionStorage",
        value: stringify(sessionStorage),
      });

      return;
    }
    case "sessionStorage": {
      if (sessionStorage.length > 0) return;

      for (const [key, value] of Object.entries<string>(e.data.value)) {
        sessionStorage.setItem(key, value);

        STORAGE_CHANGES$.next({
          key,
          value: parse(value),
        });
      }

      return;
    }
  }
};

// Initialize
channel.postMessage({ type: "getSessionStorage" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stringify(input: any) {
  return JSON.stringify(input);
}

function parse(input: string) {
  return JSON.parse(input, (_key, value) => {
    if (typeof value === "object" && !!value) {
      const keys = Object.keys(value);

      if (isEqual(keys, ["seconds", "nanoseconds"])) {
        return new Timestamp(value.seconds, value.nanoseconds);
      }
    }

    return value;
  });
}
