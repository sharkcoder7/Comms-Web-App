import {
  of,
  map,
  distinctUntilChanged,
  combineLatest,
  switchMap,
  shareReplay,
  firstValueFrom,
} from "rxjs";
import { docData, collectionData } from "rxfire/firestore";
import { catchFirebaseError, collectionRef, docRef } from "~/firestore.service";
import {
  IChannelDoc,
  IPostDoc,
  IThreadDoc,
  IUnsafeDraftDoc,
  WithLocalData,
  WithServerTimestamp,
} from "@libs/firestore-models";
import {
  query,
  where,
  orderBy,
  serverTimestamp,
  getDoc,
  setDoc,
  limit,
  Timestamp,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { useObservable } from "~/utils/useObservable";
import { isEqual } from "@libs/utils/isEqual";
import {
  ASSERT_CURRENT_USER$,
  catchNoCurrentUserError,
  getAndAssertCurrentUser,
} from "./user.service";
import uid from "@libs/utils/uid";
import { isNonNullable } from "@libs/utils/predicates";
import {
  getFnToMapToValidDecoderResultOrNull,
  SentUnsafeDraftD,
  validateWipDraft,
  WipUnsafeDraftD,
} from "~/utils/decoders";
import { stripIndent } from "common-tags";
import { USER_CHANNELS$ } from "./channels.service";
import { currentTime } from "~/utils/rxjs-operators";
import dayjs from "dayjs";
import { htmlToText } from "@libs/utils/htmlToText";
import {
  ALL_MEMBERS_OF_USERS_WORKSPACES$,
  IAcceptedWorkspaceMemberDoc,
} from "./workspace.service";
import { removeOneFromArray } from "@libs/utils/removeOneFromArray";
import { withPendingUpdate } from "./loading.service";
import { timestampComparer } from "@libs/utils/comparers";
import {
  IEditorMention,
  IPostEditorControl,
  IRichTextEditorRef,
} from "~/form-components/post-editor";
import { IFormControl, IFormGroup } from "solid-forms-react";
import { observable } from "~/form-components/utils";
import { useIsWindowFocused } from "~/services/focus.service";
import { sessionStorageService } from "~/services/session-storage.service";
import { RefObject, useEffect } from "react";
import { IRecipientOption } from "~/dialogs/post-new/Recipients";

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND * 60;

const mapToValidWipDraftOrNull = getFnToMapToValidDecoderResultOrNull(
  WipUnsafeDraftD,
  "Attempted to view invalid draft document.",
);

const mapToValidSentDraftOrNull = getFnToMapToValidDecoderResultOrNull(
  SentUnsafeDraftD,
  "Attempted to view invalid draft document.",
);

function buildPostUserMentions(
  mentions: IEditorMention[],
  workspaceMembers: IAcceptedWorkspaceMemberDoc[],
) {
  return Object.fromEntries(
    mentions
      .filter(([id]) => {
        if (!workspaceMembers.some((m) => m.id === id)) {
          console.error(
            stripIndent`
            Attempted to add invalid mention to draft: 
            <user #${id}>
          `,
          );

          return false;
        }

        return true;
      })
      .map(([userId, type]) => [userId, { type }]),
  );
}

async function baseNewDraft(args: {
  postId: string;
  subject: string;
  bodyHTML: string;
  recipients: Array<{ id: string; type: "channel" | "user" }>;
  mentions: IEditorMention[];
}) {
  // First we make sure that all of the recipients
  // exist and the user has access to them.

  const workspaceMembers = await firstValueFrom(
    ALL_MEMBERS_OF_USERS_WORKSPACES$,
  );

  const recipientUserIds = args.recipients
    .filter(({ type, id }) => {
      if (type === "channel") return false;

      if (!workspaceMembers.some((m) => m.id === id)) {
        console.error(
          stripIndent`
          Attempted to add invalid recipient to draft: 
          <user #${id}>
        `,
        );

        return false;
      }

      return true;
    })
    .map(({ id }) => id);

  const recipientChannelSnaps = await Promise.all(
    args.recipients
      .filter(({ type }) => type === "channel")
      .map(({ id }) => getDoc(docRef("channels", id))),
  );

  const recipientChannels = recipientChannelSnaps
    .map((snap) => {
      if (!snap.exists()) {
        console.error(
          stripIndent`
              Attempted to add invalid recipient to draft: 
              <channel #${snap.id}>
            `,
        );
      }

      return snap.data();
    })
    .filter(isNonNullable);

  const mentionedUsers = buildPostUserMentions(args.mentions, workspaceMembers);

  for (const [userId] of args.mentions) {
    if (recipientUserIds.includes(userId)) continue;
    recipientUserIds.push(userId);
  }

  return validateWipDraft({
    id: args.postId,
    isInvalid: false,
    threadId: uid(),
    isFirstPostInThread: true,
    recipientChannelIds: recipientChannels.map((channel) => channel.id),
    recipientUserIds,
    mentionedUsers,
    subject: args.subject,
    bodyHTML: args.bodyHTML,
    scheduledToBeSent: false,
    scheduledToBeSentAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as WithServerTimestamp<IUnsafeDraftDoc>);
}

/**
 * The firestore in-memory cache will optimistically update
 * immediately but the promise will only resolve when the
 * changes have been committed on the server.
 */
export const createNewDraft = withPendingUpdate(
  async (args: {
    postId: string;
    subject: string;
    bodyHTML: string;
    recipients: Array<{ id: string; type: "channel" | "user" }>;
    mentions: IEditorMention[];
  }) => {
    const currentUser = getAndAssertCurrentUser();

    const draft = await baseNewDraft(args);

    // The `setDoc` promise never resolves until the update has been committed
    // on the server. When offline, the promise never resolves.
    await setDoc(
      docRef("users", currentUser.id, "unsafeDrafts", draft.id),
      draft,
    );
  },
);

/**
 * The firestore in-memory cache will optimistically update
 * immediately but the promise will only resolve when the
 * changes have been committed on the server.
 */
export const updateNewDraft = withPendingUpdate(
  async (args: {
    postId: string;
    subject: string;
    bodyHTML: string;
    recipients: Array<{ id: string; type: "channel" | "user" }>;
    mentions: IEditorMention[];
    scheduledToBeSentAt?: Date;
  }) => {
    const currentUser = getAndAssertCurrentUser();

    const draft = await baseNewDraft(args);

    const doc = {
      subject: draft.subject,
      bodyHTML: draft.bodyHTML,
      recipientChannelIds: draft.recipientChannelIds,
      recipientUserIds: draft.recipientUserIds,
      // updateDoc() types have a bug which causes a type error
      // for this valid `draft.mentionedUsers` object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mentionedUsers: draft.mentionedUsers as any,
      updatedAt: serverTimestamp(),
    };

    if (args.scheduledToBeSentAt) {
      // The `setDoc` promise never resolves until the update has been committed
      // on the server. When offline, the promise never resolves.
      await updateDoc(
        docRef("users", currentUser.id, "unsafeDrafts", args.postId),
        {
          ...doc,
          scheduledToBeSent: true,
          scheduledToBeSentAt: args.scheduledToBeSentAt
            ? Timestamp.fromDate(args.scheduledToBeSentAt)
            : Timestamp.now(),
        },
      );
    } else {
      // The `setDoc` promise never resolves until the update has been committed
      // on the server. When offline, the promise never resolves.
      await updateDoc(
        docRef("users", currentUser.id, "unsafeDrafts", args.postId),
        doc,
      );
    }
  },
);

async function buildUnsafeDraftDocFromReplyFormValues(args: {
  // Previously, the implementation just called for passing a
  // `threadId` and then we queried for the related thread or
  // thread draft. Unfortunately, that querying process added
  // something like 500-1000ms to the response time which was
  // perceptibly laggy in the UI. By passing the entire thread
  // document we eliminate enough of the lag to make it feel
  // snappy.
  thread: IThreadDoc | IThreadDocFromUnsafeDraft;
  postId: string;
  bodyHTML: string;
  mentions: IEditorMention[];
}) {
  const currentUser = getAndAssertCurrentUser();

  const workspaceMembers = await firstValueFrom(
    ALL_MEMBERS_OF_USERS_WORKSPACES$,
  );

  const subject = args.thread.subject;
  const recipientChannelIds = args.thread.permittedChannelIds;
  const recipientUserIds = removeOneFromArray(
    args.thread.participatingUserIds,
    (userId) => userId === currentUser.id,
  );

  const mentionedUsers = buildPostUserMentions(args.mentions, workspaceMembers);

  for (const [userId] of args.mentions) {
    if (recipientUserIds.includes(userId)) continue;
    recipientUserIds.push(userId);
  }

  return validateWipDraft({
    id: args.postId,
    isInvalid: false,
    threadId: args.thread.id,
    isFirstPostInThread: false,
    recipientChannelIds,
    recipientUserIds,
    mentionedUsers,
    subject,
    bodyHTML: args.bodyHTML,
    scheduledToBeSent: false,
    scheduledToBeSentAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as WithServerTimestamp<IUnsafeDraftDoc>);
}

export async function buildPostDocFromDraftReplyFormValues(
  args: Parameters<typeof buildUnsafeDraftDocFromReplyFormValues>[0],
) {
  const [draft, channels, workspaceMembers] = await Promise.all([
    buildUnsafeDraftDocFromReplyFormValues(args),
    firstValueFrom(USER_CHANNELS$),
    firstValueFrom(ALL_MEMBERS_OF_USERS_WORKSPACES$),
  ]);

  if (!draft) return null;

  const now = Timestamp.now();

  return mapUnsafeDraftToPost({
    draft: {
      ...draft,
      scheduledToBeSent: true,
      scheduledToBeSentAt: now,
      createdAt: now,
      updatedAt: now,
    } as IUnsafeDraftDoc,
    channels,
    workspaceMembers,
  });
}

/**
 * The firestore in-memory cache will optimistically update
 * immediately but the promise will only resolve when the
 * changes have been committed on the server.
 */
export const createDraftReply = withPendingUpdate(
  async (args: {
    thread: IThreadDoc | IThreadDocFromUnsafeDraft;
    postId: string;
    bodyHTML: string;
    mentions: IEditorMention[];
  }) => {
    const draft = await buildUnsafeDraftDocFromReplyFormValues(args);

    if (!draft) return;

    const currentUser = getAndAssertCurrentUser();

    // The `setDoc` promise never resolves until the update has been committed
    // on the server. When offline, the promise never resolves.
    await setDoc(
      docRef("users", currentUser.id, "unsafeDrafts", draft.id),
      draft,
    );
  },
);

/**
 * The firestore in-memory cache will optimistically update
 * immediately but the promise will only resolve when the
 * changes have been committed on the server.
 */
export const updateDraftReply = withPendingUpdate(
  async (args: {
    postId: string;
    bodyHTML: string;
    mentions: IEditorMention[];
    scheduledToBeSentAt?: Date;
  }) => {
    const currentUser = getAndAssertCurrentUser();

    const mentionedUsers: IUnsafeDraftDoc["mentionedUsers"] =
      Object.fromEntries(args.mentions.map(([id, type]) => [id, { type }]));

    const doc = {
      bodyHTML: args.bodyHTML,
      // The firestore `updateDoc` function has a typing bug that, at this moment,
      // is causing a type error here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mentionedUsers: mentionedUsers as any,
      updatedAt: serverTimestamp(),
    };

    if (args.scheduledToBeSentAt) {
      // The `setDoc` promise never resolves until the update has been committed
      // on the server. When offline, the promise never resolves.
      await updateDoc(
        docRef("users", currentUser.id, "unsafeDrafts", args.postId),
        {
          ...doc,
          scheduledToBeSent: true,
          scheduledToBeSentAt: args.scheduledToBeSentAt
            ? Timestamp.fromDate(args.scheduledToBeSentAt)
            : Timestamp.now(),
        },
      );
    } else {
      // The `setDoc` promise never resolves until the update has been committed
      // on the server. When offline, the promise never resolves.
      await updateDoc(
        docRef("users", currentUser.id, "unsafeDrafts", args.postId),
        doc,
      );
    }
  },
);

/**
 * The firestore in-memory cache will optimistically update
 * immediately but the promise will only resolve when the
 * changes have been committed on the server.
 */
export const deleteDraft = withPendingUpdate(
  async (args: { postId: string }) => {
    const currentUser = getAndAssertCurrentUser();

    // The `deleteDoc` promise never resolves until the update has been committed
    // on the server. When offline, the promise never resolves.
    await deleteDoc(
      docRef("users", currentUser.id, "unsafeDrafts", args.postId),
    );
  },
);

export type IPostDocFromUnsafeDraft = WithLocalData<
  IPostDoc,
  "IPostDoc",
  { fromUnsafeDraft: {} }
>;

function mapUnsafeDraftToPost(args: {
  draft: IUnsafeDraftDoc;
  channels: IChannelDoc[];
  workspaceMembers: IAcceptedWorkspaceMemberDoc[];
}): IPostDocFromUnsafeDraft | null {
  const { draft, channels, workspaceMembers } = args;

  if (!draft.scheduledToBeSentAt) {
    throw new Error(
      `Oops! You can only map a draft with a non-null scheduledToBeSentAt value to a post`,
    );
  }

  const creator = getAndAssertCurrentUser();

  const recipientChannels: IPostDoc["recipientChannels"] = Object.fromEntries(
    draft.recipientChannelIds
      .map((channelId) => {
        const channel = channels.find((channel) => channel.id === channelId);

        if (!channel) return null;

        const doc: IPostDoc["recipientChannels"][string] = {
          name: channel.name,
          photoURL: channel.photoURL,
        };

        return [channelId, doc];
      })
      .filter(isNonNullable),
  );

  const recipientChannelIds = Object.keys(recipientChannels);

  const recipientUsers: IPostDoc["recipientUsers"] = Object.fromEntries(
    draft.recipientUserIds
      .map((userId) => {
        const member = workspaceMembers.find((member) => member.id === userId);

        if (!member) return null;

        const doc: IPostDoc["recipientUsers"][string] = {
          name: member.user.name,
          email: member.user.email,
          photoURL: member.user.photoURL,
        };

        return [userId, doc];
      })
      .filter(isNonNullable),
  );

  const recipientUserIds = Object.keys(recipientUsers);

  if (recipientUserIds.length === 0 && recipientChannelIds.length === 0) {
    // This might happen if the user sends a post but then loses permission
    // to send to any of the recipients before the post is actually
    // sent by the backend.
    return null;
  }

  return {
    __docType: "IPostDoc",
    __local: {
      fromUnsafeDraft: {},
    },
    id: draft.id,
    threadId: draft.threadId,
    isFirstPostInThread: draft.isFirstPostInThread,
    recipientChannelIds,
    recipientChannels,
    recipientUserIds,
    recipientUsers,
    mentionedUsers: draft.mentionedUsers,
    creatorId: creator.id,
    creatorName: creator.name,
    creatorEmail: creator.email,
    creatorPhotoURL: creator.photoURL,
    subject: draft.subject,
    bodyHTML: draft.bodyHTML,
    // TODO: we should use innerText and a div element to
    // convert the HTML to text but it will require some
    // work since, if elements don't have spaces between
    // them (e.g. `<h1>Title</h1><p>Text</p>`) then
    // innerText wont render spaces between them. After
    // spending close to an hour trying to figure out how
    // to write a regexp to add spaces after each closing
    // tag, I gave up and decided to just use the htmlToText
    // server package (which adds 100+ kb gzipped and is
    // huge).
    bodyText: htmlToText(draft.bodyHTML),
    sentAt: draft.scheduledToBeSentAt,
    scheduledToBeSentAt: draft.scheduledToBeSentAt,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

export const SENT_DRAFTS_AS_POSTS$ = ASSERT_CURRENT_USER$.pipe(
  switchMap((currentUser) =>
    combineLatest([
      currentTime(ONE_MINUTE * 5).pipe(
        switchMap(() =>
          collectionData(
            query(
              collectionRef("users", currentUser.id, "unsafeDrafts"),
              where("isInvalid", "==", false),
              where("scheduledToBeSent", "==", true),
              where(
                "scheduledToBeSentAt",
                "<=",
                dayjs().add(5, "minutes").toDate(),
              ),
              orderBy("scheduledToBeSentAt", "asc"),
            ),
          ),
        ),
        distinctUntilChanged(isEqual),
      ),
      USER_CHANNELS$,
      ALL_MEMBERS_OF_USERS_WORKSPACES$,
    ]).pipe(
      map(([unsafeDrafts, channels, workspaceMembers]) => {
        return unsafeDrafts
          .map((unsafeDraft) => {
            const result = mapToValidSentDraftOrNull(unsafeDraft);

            if (!result?.scheduledToBeSentAt) return null;

            return mapUnsafeDraftToPost({
              draft: result,
              channels,
              workspaceMembers,
            });
          })
          .filter(isNonNullable);
      }),
    ),
  ),
  shareReplay(1),
  catchNoCurrentUserError(),
);

export type IThreadDocFromUnsafeDraft = WithLocalData<
  IThreadDoc,
  "IThreadDoc",
  { fromUnsafeDraft: {} }
>;

export const SENT_DRAFTS_AS_THREADS$ = ASSERT_CURRENT_USER$.pipe(
  switchMap((currentUser) =>
    combineLatest([
      currentTime(ONE_MINUTE * 5).pipe(
        switchMap(() =>
          collectionData(
            query(
              collectionRef("users", currentUser.id, "unsafeDrafts"),
              where("isInvalid", "==", false),
              where("isFirstPostInThread", "==", true),
              where("scheduledToBeSent", "==", true),
              where(
                "scheduledToBeSentAt",
                "<=",
                dayjs().add(5, "minutes").toDate(),
              ),
              orderBy("scheduledToBeSentAt", "asc"),
            ),
          ),
        ),
        distinctUntilChanged(),
      ),
      USER_CHANNELS$,
      ALL_MEMBERS_OF_USERS_WORKSPACES$,
    ]).pipe(
      map(([unsafeDrafts, channels, workspaceMembers]) => {
        return unsafeDrafts
          .map(mapToValidSentDraftOrNull)
          .map((draft) => {
            if (!draft?.scheduledToBeSentAt) return null;

            const firstPost = mapUnsafeDraftToPost({
              draft,
              channels,
              workspaceMembers,
            });

            if (!firstPost) return null;

            const participatingUsers: IThreadDoc["participatingUsers"] = {
              ...firstPost.recipientUsers,
              [currentUser.id]: {
                name: currentUser.name,
                email: currentUser.email,
                photoURL: currentUser.photoURL,
              },
            };

            const thread: IThreadDocFromUnsafeDraft = {
              __docType: "IThreadDoc",
              __local: {
                fromUnsafeDraft: {},
              },
              id: draft.threadId,
              permittedChannelIds: firstPost.recipientChannelIds,
              channelPermissions: firstPost.recipientChannels,
              permittedUserIds: Object.keys(participatingUsers),
              userPermissions: participatingUsers,
              participatingUserIds: Object.keys(participatingUsers),
              participatingUsers,
              subject: draft.subject,
              firstPost,
              createdAt: draft.createdAt,
              updatedAt: draft.updatedAt,
            };

            return thread;
          })
          .filter(isNonNullable);
      }),
    ),
  ),
  distinctUntilChanged(isEqual),
  shareReplay(1),
  catchNoCurrentUserError(),
);

export function observeDraft(postId: string) {
  return ASSERT_CURRENT_USER$.pipe(
    switchMap((user) =>
      docData(docRef("users", user.id, "unsafeDrafts", postId)).pipe(
        catchFirebaseError(() => null),
      ),
    ),
    map((value) => (!value ? null : mapToValidWipDraftOrNull(value))),
    catchNoCurrentUserError(),
  );
}

export function useDraft(postId?: string): IUnsafeDraftDoc | null | undefined {
  return useObservable(
    () => {
      if (!postId) return of(null);

      return observeDraft(postId);
    },
    {
      deps: [postId],
    },
  );
}

export function useDraftForThread(
  threadId?: string,
): IUnsafeDraftDoc | null | undefined {
  return useObservable(
    () => {
      if (!threadId) return of(null);

      return ASSERT_CURRENT_USER$.pipe(
        switchMap((user) =>
          collectionData(
            query(
              collectionRef("users", user.id, "unsafeDrafts"),
              where("isInvalid", "==", false),
              where("scheduledToBeSent", "==", false),
              where("threadId", "==", threadId),
              limit(1),
            ),
          ).pipe(catchFirebaseError(() => null)),
        ),
        map((value) =>
          !value?.[0] ? null : mapToValidWipDraftOrNull(value[0]),
        ),
        catchNoCurrentUserError(),
      );
    },
    {
      deps: [threadId],
    },
  );
}

export type IUnsafeDraftDocWithLocalData = WithLocalData<
  IUnsafeDraftDoc,
  "IUnsafeDraftDoc",
  {
    bodyText: string;
    fromThread: {
      recipientChannelIds: IThreadDoc["permittedChannelIds"];
      recipientChannels: Array<
        IThreadDoc["channelPermissions"][string] & {
          id: string;
        }
      >;
      recipientUserIds: IThreadDoc["participatingUserIds"];
      recipientUsers: Array<
        IThreadDoc["participatingUsers"][string] & { id: string }
      >;
    };
  }
>;

export function observeDrafts() {
  return ASSERT_CURRENT_USER$.pipe(
    switchMap((user) =>
      combineLatest([
        USER_CHANNELS$,
        ALL_MEMBERS_OF_USERS_WORKSPACES$,
        collectionData(
          query(
            collectionRef("users", user.id, "unsafeDrafts"),
            where("isInvalid", "==", false),
            where("scheduledToBeSent", "==", false),
          ),
        ).pipe(
          map((drafts) => {
            return drafts.map(mapToValidWipDraftOrNull).filter(isNonNullable);
          }),
        ),
      ]).pipe(
        switchMap(([channels, workspaceMembers, drafts]) => {
          if (drafts.length === 0) return of([]);

          return combineLatest(
            drafts.map((draft) => {
              if (draft.isFirstPostInThread) {
                const localDraft: IUnsafeDraftDocWithLocalData = {
                  ...draft,
                  __docType: "IUnsafeDraftDoc",
                  __local: {
                    bodyText: htmlToText(draft.bodyHTML),
                    fromThread: {
                      recipientChannelIds: draft.recipientChannelIds,
                      recipientChannels: getRecipientChannels(
                        draft.recipientChannelIds,
                        channels,
                      ),
                      recipientUserIds: draft.recipientUserIds,
                      recipientUsers: getRecipientUsers(
                        draft.recipientUserIds,
                        workspaceMembers,
                      ),
                    },
                  },
                };

                return of(localDraft);
              }

              return docData(docRef("threads", draft.threadId)).pipe(
                switchMap((threadDoc) => {
                  if (threadDoc) {
                    return of({
                      recipientChannelIds: threadDoc.permittedChannelIds,
                      recipientChannels: Object.entries(
                        threadDoc.channelPermissions,
                      ).map(([k, v]) => ({ id: k, ...v })),
                      recipientUserIds: threadDoc.participatingUserIds,
                      recipientUsers: Object.entries(
                        threadDoc.participatingUsers,
                      ).map(([k, v]) => ({ id: k, ...v })),
                    });
                  }

                  return collectionData(
                    query(
                      collectionRef("users", user.id, "unsafeDrafts"),
                      where("isInvalid", "==", false),
                      where("threadId", "==", draft.threadId),
                      where("isFirstPostInThread", "==", true),
                      limit(1),
                    ),
                  ).pipe(
                    map((threadDrafts) =>
                      mapToValidWipDraftOrNull(threadDrafts[0]),
                    ),
                    map((threadDraft) => {
                      if (!threadDraft) return;

                      return {
                        recipientChannelIds: threadDraft.recipientChannelIds,
                        recipientChannels: getRecipientChannels(
                          threadDraft.recipientChannelIds,
                          channels,
                        ),
                        recipientUserIds: threadDraft.recipientUserIds,
                        recipientUsers: getRecipientUsers(
                          threadDraft.recipientUserIds,
                          workspaceMembers,
                        ),
                      };
                    }),
                  );
                }),
                map((threadRecipients) => {
                  if (!threadRecipients) return;

                  const localDraft: IUnsafeDraftDocWithLocalData = {
                    ...draft,
                    __docType: "IUnsafeDraftDoc",
                    __local: {
                      bodyText: htmlToText(draft.bodyHTML),
                      fromThread: threadRecipients,
                    },
                  };

                  return localDraft;
                }),
              );
            }),
          );
        }),
      ),
    ),
    map((drafts) =>
      drafts
        .filter(isNonNullable)
        .sort((a, b) => timestampComparer(b.createdAt, a.createdAt)),
    ),
    distinctUntilChanged(isEqual),
    catchNoCurrentUserError(),
  );
}

export function useDrafts(): IUnsafeDraftDocWithLocalData[] | undefined {
  return useObservable(() => observeDrafts());
}

function getRecipientChannels(
  recipientChannelIds: string[],
  channels: IChannelDoc[],
) {
  return recipientChannelIds
    .map((id) => channels.find((channel) => channel.id === id))
    .filter(isNonNullable);
}

function getRecipientUsers(
  recipientUserIds: string[],
  workspaceMembers: IAcceptedWorkspaceMemberDoc[],
) {
  return recipientUserIds
    .map((id) => {
      const member = workspaceMembers.find((member) => member.id === id);

      if (!member) return;

      return {
        id: member.id,
        ...member.user,
      };
    })
    .filter(isNonNullable);
}

type ILocalDraftData =
  | {
      recipients?: IRecipientOption[];
      subject?: string;
      content: string;
    }
  | {
      sent: true;
      post: IPostDocFromUnsafeDraft;
    };

export function useSyncDraftBetweenTabs(
  control:
    | IPostEditorControl
    | IFormGroup<{
        postId: IFormControl<string>;
        recipients: IFormControl<IRecipientOption[]>;
        subject: IFormControl<string>;
        body: IPostEditorControl["controls"]["body"];
      }>,
  editorRef: RefObject<IRichTextEditorRef>,
  onClose: (post?: IPostDoc) => void,
): void;
export function useSyncDraftBetweenTabs(
  control: IFormGroup<{
    postId: IFormControl<string>;
    recipients?: IFormControl<IRecipientOption[]>;
    subject?: IFormControl<string>;
    body: IPostEditorControl["controls"]["body"];
  }>,
  editorRef: RefObject<IRichTextEditorRef>,
  onClose: (post?: IPostDoc) => void,
) {
  useEffect(() => {
    // On mount, we check to see if there is local draft data for this
    // draft and update this form with that data if so. After mounting,
    // an effect below will be responsible for handling updates to the
    // draft data in sessionStorage.

    const localDraftData = sessionStorageService.getItem<ILocalDraftData>(
      getDraftDataStorageKey(control.rawValue.postId),
    );

    if (!localDraftData) return;

    if ("sent" in localDraftData) {
      onClose(localDraftData.post);
      return;
    } else if (!localDraftData.content) {
      return;
    }

    editorRef.current?.editor?.commands.setContent(
      localDraftData.content,
      true,
      {
        preserveWhitespace: "full",
      },
    );

    if (localDraftData.recipients) {
      control.controls.recipients?.setValue(localDraftData.recipients);
    }

    if (localDraftData.subject) {
      control.controls.subject?.setValue(localDraftData.subject);
    }

    // onMount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isWindowFocused = useIsWindowFocused();

  useEffect(() => {
    if (!isWindowFocused) return;

    const sub = combineLatest([
      observable(() => control.rawValue.recipients),
      observable(() => control.rawValue.subject),
      observable(() => control.rawValue.body.content),
      observable(() => getDraftDataStorageKey(control.rawValue.postId)).pipe(
        // Randomly during dev this observable started firing repeatedly.
        // Not sure if it was caused by HMR or what, but adding
        // distinctUntilChanged solved it.
        distinctUntilChanged(),
      ),
    ]).subscribe(([recipients, subject, content, sessionStorageKey]) => {
      const obj = { recipients, subject, content };

      if (!obj.recipients) delete obj.recipients;
      if (!obj.subject) delete obj.subject;

      sessionStorageService.setItem<ILocalDraftData>(sessionStorageKey, obj);
    });

    return () => sub.unsubscribe();
    // eslint incorrectly thinks that "props" is a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [control, isWindowFocused]);

  useEffect(() => {
    if (isWindowFocused) return;

    const sub = observable(() =>
      getDraftDataStorageKey(control.rawValue.postId),
    )
      .pipe(
        switchMap((sessionStorageKey) =>
          sessionStorageService.getItem$<ILocalDraftData>(sessionStorageKey),
        ),
      )
      .subscribe((value) => {
        if (!value) return;
        else if ("sent" in value) {
          onClose(value.post);
          return;
        }

        if (value.recipients) {
          control.controls.recipients?.setValue(value.recipients);
        }

        if (value.subject) {
          control.controls.subject?.setValue(value.subject);
        }

        const editor = editorRef.current?.editor;

        if (!editor) return;
        if (isEqual(editor.getHTML(), value.content)) return;

        editor.commands.setContent(value.content, true, {
          preserveWhitespace: "full",
        });
      });

    return () => sub.unsubscribe();
    // eslint incorrectly thinks that "props" is a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, control, isWindowFocused]);

  // If the draft is deleted, close the editor.
  useEffect(() => {
    const sub = observable(() => control.rawValue.postId)
      .pipe(switchMap((postId) => observeDraft(postId)))
      .subscribe((draft) => {
        if (draft) return;
        onClose();
      });

    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);
}

export function getDraftDataStorageKey(postId: string) {
  return `DRAFT:${postId}`;
}
