import { FieldValue, Timestamp } from "firebase/firestore";
import {
  buildSubscriptionD,
  buildSentUnsafeDraftD,
  buildWipUnsafeDraftD,
} from "@libs/firestore-models/decoders";
import {
  ISubscriptionDoc,
  IUnsafeDraftDoc,
  WithServerTimestamp,
} from "@libs/firestore-models";
import * as d from "ts-decoders/decoders";
import {
  areDecoderErrors,
  assert,
  Decoder,
  DecoderError,
  DecoderSuccess,
} from "ts-decoders";
import { dateComparer } from "./comparers";
import dayjs from "dayjs";

const TimestampOrFieldValueD = d.anyOfD([
  d.instanceOfD(Timestamp),
  d.instanceOfD(
    FieldValue as typeof FieldValue & { new (...args: unknown[]): FieldValue },
  ),
]);

export function getFnToMapToValidDecoderResultOrNull<T>(
  decoder: Decoder<T>,
  errorMsg?: string,
): (item: T) => T | null {
  return (item) => {
    const result = decoder.decode(item);

    if (areDecoderErrors(result)) {
      if (errorMsg) console.warn(errorMsg, result);
      return null;
    }

    return result.value;
  };
}

export const WipUnsafeDraftD = buildWipUnsafeDraftD<IUnsafeDraftDoc>(
  {},
  {
    // When a new post is created on the client and a `serverTimestamp()` is set,
    // that serverTimestamp value is initially returned as `null` in documents
    // until the post is persisted on the server and the "rea" timestamp is set.
    // When this happens, we should just use `Timestamp.now()` as a placeholder.
    timestampD: d
      .nullableD(d.instanceOfD(Timestamp))
      .map((input) => input || Timestamp.now()),
  },
);

export const WipUnsafeDraftCreateD = buildWipUnsafeDraftD<
  WithServerTimestamp<IUnsafeDraftDoc>
>(
  {},
  {
    // When a new post is created on the client and a `serverTimestamp()` is set,
    // that serverTimestamp value is initially returned as `null` in documents
    // until the post is persisted on the server and the "rea" timestamp is set.
    // When this happens, we should just use `Timestamp.now()` as a placeholder.
    timestampD: d
      .nullableD(TimestampOrFieldValueD)
      .map((input) => input || Timestamp.now()),
  },
);

export const validateWipDraft = assert(WipUnsafeDraftCreateD);

export const SentUnsafeDraftD = buildSentUnsafeDraftD<IUnsafeDraftDoc>(
  {},
  {
    // When a new post is created on the client and a `serverTimestamp()` is set,
    // that serverTimestamp value is initially returned as `null` in documents
    // until the post is persisted on the server and the "rea" timestamp is set.
    // When this happens, we should just use `Timestamp.now()` as a placeholder.
    timestampD: d
      .nullableD(d.instanceOfD(Timestamp))
      .map((input) => input || Timestamp.now()),
  },
);

export const SentUnsafeDraftCreateD = buildSentUnsafeDraftD<
  WithServerTimestamp<IUnsafeDraftDoc>
>(
  {},
  {
    timestampD: TimestampOrFieldValueD,
  },
).chain((input) => {
  if (
    input.scheduledToBeSentAt &&
    input.scheduledToBeSentAt instanceof Timestamp &&
    dateComparer(
      input.scheduledToBeSentAt.toDate(),
      dayjs().subtract(1, "second").toDate(),
    ) === -1
  ) {
    return new DecoderError(
      input,
      "invalid-prop",
      `scheduledToBeSentAt cannot be in the past`,
    );
  }

  return new DecoderSuccess(input);
});

export const validateSentDraft = assert(SentUnsafeDraftCreateD);

export const SubscriptionCreateD = buildSubscriptionD<
  WithServerTimestamp<ISubscriptionDoc>
>(
  {},
  {
    timestampD: TimestampOrFieldValueD,
  },
);

export const validateNewSubscription = assert(SubscriptionCreateD);
