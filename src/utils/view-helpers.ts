function getElementPositionInContainer(
  containerPos: DOMRect,
  elementPos: number,
) {
  if (elementPos < containerPos.top) {
    return "above" as const;
  } else if (elementPos > containerPos.bottom) {
    return "below" as const;
  } else {
    return "visible" as const;
  }
}

/**
 * Get the position of an relevant it's container.
 */
export function elementPositionInContainer(
  container: HTMLElement,
  element: HTMLElement,
) {
  const containerPos = container.getBoundingClientRect();
  const elementPos = element.getBoundingClientRect();

  return {
    top: getElementPositionInContainer(containerPos, elementPos.top),
    bottom: getElementPositionInContainer(containerPos, elementPos.bottom),
  };
}

export function scrollContainerToBottomOfElement(
  container: HTMLElement,
  element: HTMLElement,
) {
  container.scrollTop = element.offsetTop + element.offsetHeight;
}

export function scrollContainerToTopOfElement(
  container: HTMLElement,
  element: HTMLElement,
) {
  container.scrollTop = element.offsetTop;
}
