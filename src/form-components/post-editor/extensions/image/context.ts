import { storageRef } from "~/firestore.service";
import { getAndAssertCurrentUser } from "~/services/user.service";

export interface IImageExtentionAttrs {
  src: string | null;
  alt: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
  imageId: string | null;
}

export function getImageRef(imageId: string) {
  const currentUser = getAndAssertCurrentUser();
  return storageRef("images", currentUser.id, imageId);
}
