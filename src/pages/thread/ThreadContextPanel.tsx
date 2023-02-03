import { IThreadDoc } from "@libs/firestore-models";
import { ComponentType, Fragment, memo, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  IThreadSubscriptionsDoc,
  useThreadSubscriptions,
} from "~/services/subscription.service";
import { isEqual } from "@libs/utils/isEqual";
import { SetNonNullable } from "@libs/utils/type-helpers";
import { IThreadDocFromUnsafeDraft } from "~/services/draft.service";
import { groupBy } from "lodash-es";
import { ContextPanel } from "~/page-layouts/thread-layout";

export const ThreadContextPanel: ComponentType<{
  thread?: IThreadDoc | IThreadDocFromUnsafeDraft | null | undefined;
}> = memo(({ thread }) => {
  const channelRecipients = useMemo(() => {
    if (!thread) return [];

    return Object.entries(thread.channelPermissions).map(
      ([channelId, channelData]) => {
        return {
          type: "channel" as const,
          id: channelId,
          ...channelData,
        };
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, thread?.channelPermissions]);

  const userParticipants = useMemo(() => {
    if (!thread) return [];

    return Object.entries(thread.participatingUsers).map(
      ([userId, userData]) => {
        return {
          type: "user" as const,
          id: userId,
          ...userData,
        };
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, thread?.participatingUsers]);

  const subscriptions = useThreadSubscriptions(thread?.id);

  const [knownSubscriptions, unknownSubscriptions] = useMemo(() => {
    if (!subscriptions) return [[], []];

    const { true: knownSubs = [], false: unknownSubs = [] } = groupBy(
      subscriptions,
      (s) => !!s.__local.fromWorkspaceMember,
    );

    return [
      knownSubs as Array<
        IThreadSubscriptionsDoc & {
          __local: SetNonNullable<
            IThreadSubscriptionsDoc["__local"],
            "fromWorkspaceMember"
          >;
        }
      >,
      unknownSubs,
    ] as const;
  }, [subscriptions]);

  const userRecipients = useMemo(() => {
    const recipients: Array<{ key: string; id: string; name: string }> = [];

    userParticipants.forEach((user) => {
      const sub = knownSubscriptions.find((sub) => sub.userId === user.id);

      const preference = sub?.preference;

      if (preference === "mentioned" || preference === "ignore") return;

      recipients.push({ key: user.id, id: user.id, name: user.name });
    });

    knownSubscriptions.forEach((sub) => {
      if (userParticipants.some((user) => user.id === sub.userId)) return;

      const preference = sub.preference;
      if (preference === "mentioned" || preference === "ignore") return;

      recipients.push({
        key: sub.userId + sub.id,
        id: sub.id,
        name: sub.__local.fromWorkspaceMember.name,
      });
    });

    return recipients;
  }, [userParticipants, knownSubscriptions]);

  return (
    <ContextPanel>
      <div className="h-4" />

      <div className="mx-6 my-4">
        <p className="text-slate-9">Recipients</p>

        <div className="inline-flex flex-wrap mt-2">
          {channelRecipients.map((recipient, index) => {
            return (
              <Fragment key={recipient.id}>
                <Link
                  to={`/channels/${recipient.id}`}
                  className="hover:underline"
                >
                  #{recipient.name}
                </Link>

                {index !== channelRecipients.length - 1 && (
                  <span className="mr-2">,</span>
                )}
              </Fragment>
            );
          })}
        </div>

        <div className="mt-2">
          {userRecipients.map((recipient, index) => {
            return (
              <Fragment key={recipient.key}>
                <span>{recipient.name}</span>

                {index !== userRecipients.length - 1 && (
                  <span className="mr-2">,</span>
                )}
              </Fragment>
            );
          })}

          {unknownSubscriptions.length > 0 && (
            <span className="mr-2">
              and
              {unknownSubscriptions.length === 1
                ? " 1 other person"
                : ` ${unknownSubscriptions.length} other people`}
            </span>
          )}
        </div>
      </div>
    </ContextPanel>
  );
}, isEqual);
