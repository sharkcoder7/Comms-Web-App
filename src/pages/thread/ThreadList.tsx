import {
  IPostDoc,
  IThreadDoc,
  IThreadReadStatus,
  IUnsafeDraftDoc,
} from "@libs/firestore-models";
import {
  ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHotkeyContext } from "~/services/hotkey.service";
import { ContentList } from "~/components/content-list";
import {
  IPostDocFromUnsafeDraft,
  IThreadDocFromUnsafeDraft,
  createDraftReply,
} from "~/services/draft.service";
import { IListRef, useListScrollboxContext } from "~/components/list";
import { ComposePostReply } from "./ComposePostReply";
import { IRichTextEditorRef } from "~/form-components/post-editor/PostEditor";
import { elementPositionInContainer } from "~/utils/view-helpers";
import { getThreadReadStatusUpdaterFn } from "~/services/post.service";
import { PostEntry } from "./PostEntry";
import { useSearchParams } from "react-router-dom";
import useConstant from "use-constant";
import { useKBarContext } from "~/services/kbar.service";
import { Subject } from "rxjs";
import { onlyCallFnOnceWhilePreviousCallIsPending } from "~/utils/onlyCallOnceWhilePending";
import uid from "@libs/utils/uid";
import { docRef, waitForCacheToContainDoc } from "~/firestore.service";
import { getAndAssertCurrentUser } from "~/services/user.service";

export const ThreadList: ComponentType<{
  thread: IThreadDoc | IThreadDocFromUnsafeDraft;
  posts: Array<IPostDoc | IPostDocFromUnsafeDraft>;
  draft: IUnsafeDraftDoc | null;
  readStatus: IThreadReadStatus | null;
}> = (props) => {
  const listRef = useRef<IListRef<IPostDoc>>(null);
  const editorRef = useRef<IRichTextEditorRef>(null);
  const [searchParams] = useSearchParams();
  const postIdQueryParam = searchParams.get("post") || undefined;

  const [sentDraft, setSentDraft] = useState<IPostDoc | null>(null);

  const postsAndSentDraft = useMemo(() => {
    if (!sentDraft) return props.posts;
    if (props.posts.some((p) => p.id === sentDraft.id)) return props.posts;
    return [...props.posts, sentDraft];
  }, [props.posts, sentDraft]);

  const collapsePostEvents$ = useConstant(
    () => new Subject<"expand" | "collapse">(),
  );

  const { scrollboxRef } = useListScrollboxContext();

  const { readStatus } = props;

  const initiallyFocusEntryId = useConstant(() => {
    if (postIdQueryParam) return postIdQueryParam;

    if (!readStatus) {
      return props.posts[0]?.id;
    }

    const firstUnreadPost = props.posts.find((post) => {
      return (
        post.sentAt.valueOf() > readStatus.readToSentAt.valueOf() ||
        (post.sentAt.valueOf() == readStatus.readToSentAt.valueOf() &&
          post.scheduledToBeSentAt.valueOf() >
            readStatus.readToScheduledToBeSentAt.valueOf())
      );
    });

    if (firstUnreadPost) return firstUnreadPost.id;

    return props.draft ? "draft" : props.posts.at(-1)?.id;
  });

  const localSentDraftExists = postsAndSentDraft.length !== props.posts.length;

  // Clear `sentDraft` if we have a real post with the same ID
  useEffect(() => {
    if (!sentDraft) return;
    if (!props.posts.some((p) => p.id === sentDraft.id)) return;

    setSentDraft(null);
  }, [sentDraft, props.posts]);

  /** Scroll list container up if possible */
  const onArrowUpOverflow = useCallback((e) => {
    if (!scrollboxRef.current) return;
    e.preventDefault();
    scrollboxRef.current.scrollTop -= 100;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateThreadReadStatus = useMemo(() => {
    return getThreadReadStatusUpdaterFn(props.thread.id, readStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.thread.id, readStatus?.threadId]);

  /** Focus and scroll to the compose draft editor */
  const onArrowDownOverflow = useCallback((e) => {
    const editorEl = editorRef.current?.editor?.view.dom;
    e.preventDefault();

    if (!editorEl || !scrollboxRef.current) return;

    editorEl.focus({ preventScroll: true });

    const { bottom } = elementPositionInContainer(
      scrollboxRef.current,
      editorEl,
    );

    if (bottom !== "below") return;

    scrollboxRef.current.scrollTop += 100;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createNewDraft = useMemo(() => {
    return onlyCallFnOnceWhilePreviousCallIsPending(async () => {
      if (props.draft) {
        const tiptap = editorRef.current?.editor;
        tiptap?.chain().focus("start", { scrollIntoView: true });
        return;
      }

      const draftId = uid();

      const currentUser = getAndAssertCurrentUser();

      // we race the result in case of an error
      await Promise.race([
        createDraftReply({
          thread: props.thread,
          postId: draftId,
          bodyHTML: "",
          mentions: [],
        }),
        waitForCacheToContainDoc(
          docRef("users", currentUser.id, "unsafeDrafts", draftId),
        ),
      ]);

      setTimeout(() => {
        const tiptap = editorRef.current?.editor;
        tiptap?.chain().focus("start", { scrollIntoView: true });
      }, 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!props.draft, props.thread]);

  useHotkeyContext({
    commands: () => {
      return [
        {
          label: "New reply",
          triggers: ["r"],
          callback: createNewDraft,
        },
      ];
    },
    deps: [createNewDraft],
  });

  useKBarContext({
    commands: () => {
      return [
        {
          label: `New reply`,
          callback: createNewDraft,
        },
        {
          label: `Expand all posts`,
          callback: () => {
            collapsePostEvents$.next("expand");
          },
        },
        {
          label: `Collapse all posts`,
          callback: () => {
            collapsePostEvents$.next("collapse");
          },
        },
      ];
    },
    deps: [createNewDraft],
  });

  return (
    <>
      <ContentList<IPostDoc | IPostDocFromUnsafeDraft>
        ref={listRef}
        entries={postsAndSentDraft}
        onArrowUpOverflow={onArrowUpOverflow}
        onArrowDownOverflow={onArrowDownOverflow}
        focusOnMouseOver={false}
        initiallyFocusEntryId={
          initiallyFocusEntryId === "draft" ? undefined : initiallyFocusEntryId
        }
      >
        {postsAndSentDraft.map((post, index) => {
          return (
            <PostEntry
              key={post.id}
              post={post}
              readStatus={readStatus}
              isLastPost={index === postsAndSentDraft.length - 1}
              collapsePostEvents={collapsePostEvents$}
              onPostInView={updateThreadReadStatus}
            />
          );
        })}
      </ContentList>

      {!localSentDraftExists && props.draft && (
        <ComposePostReply
          ref={editorRef}
          thread={props.thread}
          draft={props.draft}
          listRef={listRef}
          onClose={(post) => {
            if (post) setSentDraft(post);
          }}
          focusOnInit={initiallyFocusEntryId === "draft"}
        />
      )}
    </>
  );
};
