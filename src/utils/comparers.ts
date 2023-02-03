export * from "@libs/utils/comparers";

/**
 * Sorts DOM nodes based on their relative position in the DOM.
 */
// See https://developer.mozilla.org/en-US/docs/Web/API/Node/compareDocumentPosition
export function domNodeComparer(a: Node, b: Node) {
  const compare = a.compareDocumentPosition(b);

  if (
    compare & Node.DOCUMENT_POSITION_FOLLOWING ||
    compare & Node.DOCUMENT_POSITION_CONTAINED_BY
  ) {
    // a < b
    return -1;
  }

  if (
    compare & Node.DOCUMENT_POSITION_PRECEDING ||
    compare & Node.DOCUMENT_POSITION_CONTAINS
  ) {
    // a > b
    return 1;
  }

  if (
    compare & Node.DOCUMENT_POSITION_DISCONNECTED ||
    compare & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC
  ) {
    throw Error("unsortable");
  } else {
    return 0;
  }
}
