import uid from "@libs/utils/uid";
import {
  deleteObject,
  getDownloadURL,
  uploadBytesResumable,
  UploadTask,
  UploadTaskSnapshot,
} from "firebase/storage";
import {
  distinctUntilChanged,
  filter,
  finalize,
  from,
  lastValueFrom,
  map,
  merge,
  Observable,
  shareReplay,
  Subject,
  switchMap,
  tap,
  throttleTime,
} from "rxjs";
import { catchFirebaseError, docRef, storageRef } from "~/firestore.service";
import {
  CURRENT_USER$,
  getAndAssertCurrentUser,
} from "~/services/user.service";
import { importModule } from "./dynamic-import.service";
import type Compressor from "compressorjs";
import Dexie, { liveQuery } from "dexie";
import { withPendingUpdate } from "./loading.service";
import { getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { isNonNullable } from "@libs/utils/predicates";
import { observeDraft } from "./draft.service";

/**
 * Some image upload scenerios we handle
 *
 * 1. When the user deletes the image, cleanup the local cache as
 *    well as Firebase storage.
 * 2. When the image finishes uploading, the upload service should
 *    update the draft body to insert the new image src. If the user
 *    is actively editing the draft, then our custom tiptop image
 *    extension will also do this, but if they aren’t editing the
 *    draft then this is necessary in order to support “optimistic
 *    sending”.
 * 3. If the user uploads an image, then loses internet connection
 *    and deletes the image, we need to cleanup Firebase storage.
 * 4. If the user starts uploading an image but then closes the tab
 *    responsible for the upload
 * 5. If the user attempts to upload an image but receives an
 *    unrecoverable error (e.g. the image is corrupted or something),
 *    we should warn the user and then delete the image from the
 *    draft and cleanup the local data.
 * 6. When the user sends a post, make sure to cleanup all unused
 *    data in Firebase storage and also clean up the local cache.
 */

interface IFileUpload {
  id: string;
  postId: string;
  file: File | Blob;
  fileType: string;
  fileName: string;
  fileWidth: number;
  fileHeight: number;
  url: string | null;
  uploadProgress: number;
  downloadProgress: number;
  updatedAt: number;
  creatorId: string;
  error?: string;
}

interface IFileUploadWithPreviewURL extends IFileUpload {
  previewUrl: string;
}

export class ImageCache extends Dexie {
  postImages!: Dexie.Table<IFileUpload, string>;

  constructor(
    /** This database is namespaced to the current user's id */
    userId: string,
  ) {
    super(`ImageCache-${userId}`);
    this.version(1).stores({
      postImages: "id, postId, updatedAt",
    });
  }
}

let db: ImageCache;

export function initializeDexie(userId: string) {
  db = new ImageCache(userId);
  return db;
}

export function initializeFileUploadService() {
  CURRENT_USER$.pipe(
    map((user) => user?.id),
    distinctUntilChanged(),
    tap((userId) => {
      if (userId) {
        db = initializeDexie(userId);
      } else if (db) {
        db.close();
      }
    }),
    filter(isNonNullable),
    switchMap(() => liveQuery(() => db.postImages.toArray())),
    switchMap((images) =>
      merge(
        ...images.map((image) =>
          observeDraft(image.postId).pipe(
            catchFirebaseError(() => null),
            tap((draft) => {
              if (draft) return;

              removeCachedImage(image.id).catch(console.error);
            }),
          ),
        ),
      ),
    ),
  ).subscribe();
}

if (import.meta.env.MODE !== "test") {
  initializeFileUploadService();
}

const KB = 1024;
const MB = KB * 1024;

const activeTasks = new Map<string, UploadTask>();

export const uploadImage = withPendingUpdate(
  async (
    file: File,
    postId: string,
  ): Promise<
    { imageId: string; width: number; height: number } | undefined
  > => {
    if (!navigator.onLine) {
      alert("Uploading images isn't currently supported when offline.");
      return;
    }

    const imageId = uid();

    const imageFile = await resizeImage(file);

    if (!imageFile) return;

    const imageDimensions = await preloadAndGetImageDimensions(imageFile);

    const currentUser = getAndAssertCurrentUser();

    const doc: IFileUpload = {
      id: imageId,
      postId,
      creatorId: currentUser.id,
      file: imageFile,
      fileType: imageFile.type,
      fileName: file.name,
      fileWidth: imageDimensions.width,
      fileHeight: imageDimensions.height,
      url: null,
      uploadProgress: 0,
      downloadProgress: 0,
      updatedAt: Date.now(),
    };

    await putCachedImage(doc);

    const ref = getImageRef(imageId);

    const task = uploadBytesResumable(ref, imageFile, {
      contentType: imageFile.type,
      customMetadata: {
        creatorId: doc.creatorId,
        postId: doc.postId,
      },
    });

    activeTasks.set(imageId, task);

    const uploadEvents$ = new Subject<UploadTaskSnapshot>();

    task.on("state_changed", {
      next: uploadEvents$.next.bind(uploadEvents$),
      error: uploadEvents$.error.bind(uploadEvents$),
      complete: uploadEvents$.complete.bind(uploadEvents$),
    });

    // Mark app as pending during upload
    withPendingUpdate(lastValueFrom(uploadEvents$));

    // The tab processing the upload needs to send "keepalive" events
    // to the other tabs to indicate that the upload is still being
    // processed and hasn't crashed. Other tabs will monitor the
    // "updatedAt" value and, if it isn't updated every second, will
    // assume that the upload has errored and respond appropriately.
    const interval = setInterval(() => {
      updateCachedImage(imageId, {
        updatedAt: Date.now(),
      });
    }, 1000);

    uploadEvents$
      // Dexie appears to debounce updates so if we don't throttle
      // the upload events then they won't be processed incrementally.
      .pipe(throttleTime(350, undefined, { trailing: true }))
      .subscribe({
        next: (snap) => {
          const uploadProgress = Math.round(
            (snap.bytesTransferred / snap.totalBytes) * 100,
          );

          updateCachedImage(imageId, { uploadProgress });

          console.debug("uploadProgress", uploadProgress, snap);
        },
        error: async (error) => {
          activeTasks.delete(imageId);
          console.error("upload error", error);

          try {
            await updateCachedImage(imageId, {
              error: error instanceof Error ? error.message : error,
            });
          } finally {
            clearInterval(interval);
          }
        },
        complete: withPendingUpdate(async () => {
          console.debug("upload complete");
          activeTasks.delete(imageId);

          try {
            const url = await getDownloadURL(ref);

            // We want to preload the new img src so that there isn't a flicker
            // as we transition from the preview src to the new src.
            //
            // Note, I had wanted to use
            // something like a fetch or xhr request to preload the image so that
            // we can monitor download progress, but unfortunately the fetch/xhr
            // response cache in the browser isn't shared with the img.src cache
            await preloadAndGetImageDimensions(url);

            // Now that we've gotten our download URL and preloaded it, we want to
            // update the draft doc with the new img src. Additionally, for drafts
            // that are being actively edited, the post editor component will also
            // update this img src in the actively edited draft.

            const [draftSnap] = await Promise.all([
              getDoc(docRef("users", currentUser.id, "unsafeDrafts", postId)),
              updateCachedImage(imageId, { downloadProgress: 100 }),
            ]);

            const doc = draftSnap.data({ serverTimestamps: "estimate" });

            if (!doc) return deleteImage(imageId);

            const draftDocument = parseHTMLString(doc.bodyHTML);

            const img = draftDocument.querySelector<HTMLImageElement>(
              `[data-imageid="${imageId}"]`,
            );

            if (!img) return deleteImage(imageId);

            img.src = url;

            const bodyHTML = serializeHTML(draftDocument);

            await Promise.all([
              updateCachedImage(imageId, { url }),
              updateDoc(draftSnap.ref, {
                bodyHTML,
                updatedAt: serverTimestamp(),
              }),
            ]);

            console.debug("upload added to draft");
          } catch (e) {
            console.error(e);
            await deleteImage(imageId);
          } finally {
            clearInterval(interval);
          }
        }),
      });

    return { imageId, ...imageDimensions };
  },
);

export function putCachedImage(doc: IFileUpload) {
  console.debug("putCachedImage", doc);
  return db.postImages.put(doc);
}

export function updateCachedImage(
  imageId: string,
  change: Partial<IFileUpload>,
) {
  console.debug("updateCachedImage", imageId, change);
  return db.postImages.update(imageId, { ...change, updatedAt: Date.now() });
}

export const deleteImage = withPendingUpdate(async (imageId: string) => {
  console.debug("deleteImage", imageId);

  const task = activeTasks.get(imageId);

  if (task && task.cancel()) {
    return removeCachedImage(imageId);
  }

  return Promise.allSettled([
    removeCachedImage(imageId),
    deleteObject(getImageRef(imageId)),
  ]);
});

export const removeCachedImage = withPendingUpdate((imageId: string) => {
  console.debug("removeCachedImage", imageId);
  return db.postImages.delete(imageId);
});

export function observeCachedImage(
  imageId: string,
): Observable<IFileUploadWithPreviewURL | null> {
  let fileUrl: string | undefined;

  return from(liveQuery(() => db.postImages.get(imageId))).pipe(
    map((doc) => {
      if (!doc) return null;
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      fileUrl = URL.createObjectURL(doc.file);
      return { ...doc, previewUrl: fileUrl };
    }),
    finalize(() => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}

async function preloadAndGetImageDimensions(src: string | Blob) {
  const imgContainer = document.createElement("div");
  imgContainer.style.position = "absolute";
  imgContainer.style.zIndex = "-1000";
  imgContainer.style.opacity = "0";
  imgContainer.style.width = "9999px";
  imgContainer.style.height = "9999px";

  document.body.appendChild(imgContainer);

  const img = new Image();

  if (src instanceof Blob) {
    img.src = URL.createObjectURL(src);
  } else {
    img.src = src;
  }

  img.style.position = "absolute";

  const loaded = new Promise<Event>((res, rej) => {
    img.onload = res;
    img.onerror = rej;
  });

  imgContainer.appendChild(img);

  await loaded;

  const result = {
    width: img.width,
    height: img.height,
  };

  if (src instanceof Blob) {
    URL.revokeObjectURL(img.src);
  }

  document.body.removeChild(imgContainer);

  return result;
}

function getImageRef(imageId: string) {
  const currentUser = getAndAssertCurrentUser();
  return storageRef("images", currentUser.id, imageId);
}

async function resizeImage(imageFile: File) {
  if (!imageFile.type.startsWith("image/")) return;

  if (imageFile.type === "image/gif") {
    if (imageFile.size > 6 * MB) {
      alert("GIFs must less than 6mb");
      return;
    }

    return imageFile;
  }

  return compressImage(imageFile, {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.8,
    convertSize: 4 * MB,
    convertTypes: ["image/png", "image/webp"],
  });
}

async function compressImage(
  imageFile: File,
  options: Compressor.Options = {
    maxWidth: 650,
    quality: 0.5,
    convertSize: 500 * KB,
    convertTypes: ["image/png", "image/webp"],
  },
) {
  const Compressor = await importModule("compressorjs");

  return new Promise<File | Blob>((res, rej) => {
    new Compressor(imageFile, {
      ...options,
      success: res,
      error: rej,
    });
  });
}

function parseHTMLString(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}

function serializeHTML(node: Node) {
  return new XMLSerializer().serializeToString(node);
}
