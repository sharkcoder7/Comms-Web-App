import { NodeViewWrapper } from "@tiptap/react";
import { ComponentType, ReactElement, useEffect, useMemo } from "react";
import { Node } from "prosemirror-model";
import { stripIndent } from "common-tags";
import * as Progress from "@radix-ui/react-progress";
import { css, cx } from "@emotion/css";
import { blackA } from "@radix-ui/colors";
import { IImageExtentionAttrs } from "./context";
import { usePostEditorContext } from "../../context";
import { useObservable } from "~/utils/useObservable";
import { of } from "rxjs";
import {
  observeCachedImage,
  removeCachedImage,
  updateCachedImage,
} from "~/services/file-upload.service";

type UpdateAttributesFn = (attr: Record<string, unknown>) => void;

export const ImageNodeView: ComponentType<{
  // editor: Editor;
  node: Node;
  // decorations: this.decorations,
  // selected: false,
  // extension: this.extension,
  // getPos: () => this.getPos(),
  updateAttributes: UpdateAttributesFn;
  deleteNode: () => void;
}> = (props) => {
  const { control } = usePostEditorContext();

  const attrs = props.node.attrs as IImageExtentionAttrs;

  const localImage = useObservable(
    () => (attrs.imageId ? observeCachedImage(attrs.imageId) : of(null)),
    {
      deps: [attrs.imageId],
    },
  );

  // Monitor the localImage to make sure uploading hasn't crashed
  useEffect(() => {
    if (!attrs.imageId) return;
    if (attrs.src) return;
    if (!localImage || localImage.url || localImage.error) return;

    const timeout = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      updateCachedImage(attrs.imageId!, {
        error: stripIndent`
          The browser tab responsible for the upload appears 
          to have stopped uploading.
        `,
      });
      // This callback should never be called unless the tab handling the
      // upload has crashed / been closed.
      // The tab handling the uploading is sends a heartbeat by
      // updating the image's "updatedAt" time every second.
    }, 3000);

    return () => clearTimeout(timeout);
  }, [attrs.src, attrs.imageId, localImage]);

  // Cleanup cached images after the upload is complete
  useEffect(() => {
    if (!attrs.imageId) return;
    if (!localImage) return;
    if (!attrs.src) return;
    removeCachedImage(attrs.imageId).catch(console.debug);
  }, [attrs.imageId, attrs.src, localImage]);

  // Delete this img node if there's no src and no cached
  // image
  useEffect(() => {
    if (!attrs.imageId) return;

    if (!attrs.src && localImage === null) {
      props.deleteNode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attrs.imageId, attrs.src, localImage, props.deleteNode]);

  // Handle upload completion by adding image URL to img src.
  useEffect(() => {
    if (!attrs.imageId) return;
    if (!localImage || localImage.error) return;
    if (!localImage.url || localImage.downloadProgress !== 100) return;
    if (attrs.src) return;

    // Another effect handles removing the cached image
    props.updateAttributes({ src: localImage.url });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attrs.imageId, attrs.src, localImage]);

  // Mark control as pending until the image has been successfully
  // loaded.
  useEffect(() => {
    const imageId = attrs.imageId;
    // Will be null if the image was included by copy-and-pasting HTML
    // containing an image into the draft.
    if (!imageId) return;

    const isLoaded = !!attrs.src && localImage === null;

    control.controls.body.markPending(!isLoaded, {
      source: imageId,
    });

    return () => {
      control.controls.body.markPending(false, {
        source: imageId,
      });
    };
  }, [control, attrs.imageId, attrs.src, localImage]);

  // Mark control as errored if the image has an error.
  useEffect(() => {
    const imageId = attrs.imageId;

    // Will be null if the image was included by copy-and-pasting HTML
    // containing an image into the draft.
    if (!imageId) return;

    const controlError = localImage?.error
      ? { imageError: localImage.error }
      : null;

    control.controls.body.setErrors(controlError, {
      source: imageId,
    });

    return () => {
      control.controls.body.setErrors(null, {
        source: imageId,
      });
    };
  }, [control, attrs.imageId, localImage]);

  const progress = useMemo(() => {
    if (!localImage) return;

    return Math.round(
      localImage.uploadProgress * 0.8 + localImage.downloadProgress * 0.2,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localImage?.uploadProgress, localImage?.downloadProgress]);

  let content: ReactElement | null = null;

  if (attrs.src) {
    content = (
      <img
        src={attrs.src}
        alt={attrs.alt || undefined}
        title={attrs.title || undefined}
        width={attrs.width ?? undefined}
        height={attrs.height ?? undefined}
        className="rounded-lg overflow-hidden"
        data-drag-handle
      />
    );
  } else if (localImage) {
    content = (
      <UploadWrapper
        // progress is non-null when localimage is non-null
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        progress={progress!}
        maxWidth={attrs.width ?? undefined}
        maxHeight={attrs.height ?? undefined}
        error={localImage.error}
      >
        <img
          src={localImage.previewUrl}
          alt={attrs.alt || undefined}
          title={attrs.title || undefined}
          width={attrs.width ?? undefined}
          height={attrs.height ?? undefined}
        />
      </UploadWrapper>
    );
  }

  return <NodeViewWrapper>{content}</NodeViewWrapper>;
};

const rootCSS = css`
  overflow: hidden;
  background: ${blackA.blackA9};
  border-radius: 2px;
  width: 50%;
  height: 8px;
`;

const barCSS = css`
  background-color: white;
  width: 100%;
  height: 100%;
  transition: transform 250ms cubic-bezier(0.65, 0, 0.35, 1);
`;

const UploadWrapper: ComponentType<{
  progress: number;
  maxWidth?: number;
  maxHeight?: number;
  error?: string;
}> = (props) => {
  return (
    <div
      className="relative rounded-lg overflow-hidden"
      style={{ maxWidth: props.maxWidth, maxHeight: props.maxHeight }}
      data-drag-handle
    >
      <div
        className={cx(
          "absolute h-full w-full bg-blackA-8 flex justify-center",
          "items-center p-4",
          props.error && "bg-redA-9 text-white font-md border-4 border-black",
        )}
      >
        {props.error ? (
          <div className="text-center">
            <p>
              <strong>! Upload Error !</strong>
            </p>

            <p>{props.error}</p>
          </div>
        ) : (
          <Progress.Root value={props.progress} className={rootCSS}>
            <Progress.ProgressIndicator
              className={barCSS}
              style={{
                transform: `translateX(-${100 - props.progress}%)`,
              }}
            />
          </Progress.Root>
        )}
      </div>

      {props.children}
    </div>
  );
};
