import { IPostDoc, IThreadReadStatus } from "@libs/firestore-models";
import {
  ComponentType,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isEqual } from "@libs/utils/isEqual";
import { List, useListScrollboxContext } from "~/components/list";
import { useAuthGuardContext } from "~/route-guards/withAuthGuard";
import { cx } from "@emotion/css";
import { EntryTimestamp, Summary } from "~/components/content-list/layout";
import { useSearchParams } from "react-router-dom";
import { observe } from "react-intersection-observer";
import { Observable } from "rxjs";

export const PostEntry: ComponentType<{
  post: IPostDoc;
  readStatus: IThreadReadStatus | null;
  isLastPost: boolean;
  collapsePostEvents: Observable<"expand" | "collapse">;
  onPostInView: (post: IPostDoc) => void;
}> = memo((props) => {
  const { scrollboxRef } = useListScrollboxContext();
  const ref = useRef<HTMLLIElement>(null);

  const isRead = useMemo(() => {
    if (!props.readStatus) return false;
    if (
      props.readStatus.readToSentAt.valueOf() >= props.post.sentAt.valueOf() &&
      props.readStatus.readToScheduledToBeSentAt.valueOf() >=
        props.post.scheduledToBeSentAt.valueOf()
    ) {
      return true;
    }

    return false;
  }, [props.post, props.readStatus]);

  useEffect(() => {
    if (!scrollboxRef.current || !ref.current) return;
    if (isRead) return;

    return observe(
      ref.current,
      (inView) => {
        if (!inView) return;
        props.onPostInView(props.post);
      },
      {
        root: scrollboxRef.current,
        threshold: 0.5,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRead, props.post, props.onPostInView]);

  useEffect(() => {
    const sub = props.collapsePostEvents.subscribe((e) => {
      setIsClosed(e === "collapse");
    });

    return () => sub.unsubscribe();
  }, [props.collapsePostEvents]);

  const [searchParams] = useSearchParams();

  const isPostIdAQueryParam = searchParams.get("post") === props.post.id;

  const [isClosed, setIsClosed] = useState(
    isPostIdAQueryParam || props.isLastPost ? false : isRead,
  );

  const cssClasses = useMemo(() => {
    return isClosed
      ? cx(
          "Post flex px-8 py-4 hover:cursor-pointer",
          "bg-white border-l-[3px] border-transparent bg-transparent",
          "focus:outline-none focus:border-black focus:bg-white focus:shadow-lg",
        )
      : cx(
          "Post bg-white my-4 shadow-lg border-l-[3px] border-white",
          "focus:outline-none focus-within:border-black",
        );
  }, [isClosed]);

  return (
    <List.Entry<IPostDoc>
      id={props.post.id}
      data={props.post}
      onEntrySelect={(e) => {
        if (
          e.target instanceof HTMLAnchorElement ||
          e.target instanceof HTMLButtonElement
        ) {
          // if the user has focused an anchor or button element and they've
          // pressed "Enter", we don't want to collapse the entry.
          return;
        }

        setIsClosed((s) => !s);
      }}
    >
      <li ref={ref} className={cssClasses}>
        {isClosed ? (
          <CollapsedPost post={props.post} />
        ) : (
          <ExpandedPost post={props.post} />
        )}
      </li>
    </List.Entry>
  );
}, isEqual);

const CollapsedPost: ComponentType<{
  post: IPostDoc;
}> = memo((props) => {
  const { post } = props;
  const { currentUser } = useAuthGuardContext();

  return (
    <>
      <div className="flex items-center w-28 mr-4">
        <span className="font-bold truncate">
          {currentUser.id === post.creatorId ? "Me" : post.creatorName}
        </span>
      </div>

      <Summary details={post.bodyText} />

      <EntryTimestamp datetime={post.sentAt} />
    </>
  );
}, isEqual);

const ExpandedPost: ComponentType<{
  post: IPostDoc;
}> = memo((props) => {
  const { post } = props;
  const { currentUser } = useAuthGuardContext();

  return (
    <>
      <div className="PostHeader flex px-8 py-4">
        <div className="PostSender flex-1">
          <strong>
            {currentUser.id === post.creatorId ? "Me" : post.creatorName}
          </strong>
        </div>

        <EntryTimestamp datetime={post.sentAt} />
      </div>

      <div
        className="PostBody prose px-8 py-4"
        dangerouslySetInnerHTML={{ __html: post.bodyHTML }}
      />
    </>
  );
}, isEqual);
