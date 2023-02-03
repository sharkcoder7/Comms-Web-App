import { getTypedCallableFn } from "~/firebase";
import {
  switchMap,
  of,
  shareReplay,
  combineLatest,
  map,
  distinctUntilChanged,
  Observable,
} from "rxjs";
import { collectionData, docData } from "rxfire/firestore";
import { catchFirebaseError, collectionRef, docRef } from "~/firestore.service";
import {
  IUserDoc,
  WithLocalData,
  IWorkspaceDoc,
  IWorkspaceMemberDoc,
} from "@libs/firestore-models";
import { ASSERT_CURRENT_USER$, catchNoCurrentUserError } from "./user.service";
import { useObservable } from "~/utils/useObservable";
import { isEqual } from "@libs/utils/isEqual";
import { stringComparer } from "~/utils/comparers";
import { orderBy, query, where } from "firebase/firestore";
import { uniqBy } from "lodash-es";
import { SetNonNullable } from "@libs/utils/type-helpers";
import { removeOneFromArray } from "@libs/utils/removeOneFromArray";
import { isNonNullable } from "@libs/utils/predicates";

type IWorkspaceDocWithCurrentUserData = WithLocalData<
  IWorkspaceDoc,
  "IWorkspaceDoc",
  {
    fromCurrentUser: IUserDoc["workspacePermissions"][string];
  }
>;

export const createWorkspace = getTypedCallableFn("workspaceCreate");
export const sendWorkspaceInvite = getTypedCallableFn("workspaceMemberInvite");

export const USER_WORKSPACES$ = ASSERT_CURRENT_USER$.pipe(
  map((userDoc) => userDoc.workspacePermissions),
  distinctUntilChanged(isEqual),
  switchMap((userWorkspacePermissions) => {
    const userWorkspacePermissionsEntries = Object.entries(
      userWorkspacePermissions,
    );

    if (userWorkspacePermissionsEntries.length === 0) return of([]);

    return combineLatest<Array<IWorkspaceDocWithCurrentUserData | null>>(
      userWorkspacePermissionsEntries.map(
        ([workspaceId, workspacePermissions]) =>
          docData(docRef("workspaces", workspaceId)).pipe(
            map((workspace) => {
              const data: IWorkspaceDocWithCurrentUserData = {
                ...workspace,
                __docType: "IWorkspaceDoc",
                __local: {
                  fromCurrentUser: workspacePermissions,
                },
              };

              return data;
            }),
            catchFirebaseError(() => null),
            distinctUntilChanged(isEqual),
          ),
      ),
    );
  }),
  map((workspaces) =>
    workspaces
      .filter(isNonNullable)
      .sort(
        (a, b) => stringComparer(a.name, b.name) || stringComparer(a.id, b.id),
      ),
  ),
  shareReplay(1),
  catchNoCurrentUserError(),
);

export type IAcceptedWorkspaceMemberDoc = WithLocalData<
  SetNonNullable<IWorkspaceMemberDoc, "user" | "acceptedAt"> & {
    accepted: true;
  },
  "IWorkspaceMemberDoc",
  {}
>;

/**
 * Technically, this is an observable of all the _accepted_
 * members of a users' workspaces.
 *
 * TODO: this won't scale
 */
export const ALL_MEMBERS_OF_USERS_WORKSPACES$: Observable<
  IAcceptedWorkspaceMemberDoc[]
> = ASSERT_CURRENT_USER$.pipe(
  switchMap(() => USER_WORKSPACES$),
  switchMap((workspaces) => {
    if (workspaces.length === 0) return of([]);

    return combineLatest(
      workspaces.map(({ id }) =>
        collectionData(
          query(
            collectionRef<
              SetNonNullable<IWorkspaceMemberDoc, "user" | "acceptedAt"> & {
                accepted: true;
              }
            >("workspaces", id, "memberships"),
            where("accepted", "==", true),
            orderBy("user.name", "asc"),
            orderBy("id", "asc"),
          ),
        ),
      ),
    );
  }),
  map((groupedMembers) => uniqBy(groupedMembers.flat(), "id")),
  distinctUntilChanged(isEqual),
  switchMap((uniqueMembers) =>
    combineLatest([ASSERT_CURRENT_USER$, of(uniqueMembers)]).pipe(
      map(([currentUser, _uniqueMembers]) => {
        const uniqueMembers = removeOneFromArray(
          _uniqueMembers,
          (m) => m.id === currentUser.id,
        );

        return uniqueMembers.sort(
          (a, b) =>
            stringComparer(a.user.name, b.user.name) ||
            stringComparer(a.id, b.id),
        );
      }),
    ),
  ),
  map((members) =>
    members.map((m) => ({
      ...m,
      __docType: "IWorkspaceMemberDoc" as const,
      __local: {},
    })),
  ),
  shareReplay(1),
  catchNoCurrentUserError(),
);

export function useWorkspaces() {
  return useObservable(() => USER_WORKSPACES$, {
    initialValue: [] as IWorkspaceDocWithCurrentUserData[],
  });
}
