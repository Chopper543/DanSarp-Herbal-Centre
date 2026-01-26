/**
 * Focus management utilities for accessibility
 */

/**
 * Traps focus within an element (for modals, dropdowns, etc.)
 */
export function trapFocus(element: HTMLElement) {
  const focusableElements = element.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ) as NodeListOf<HTMLElement>;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  function handleTabKey(e: KeyboardEvent) {
    if (e.key !== "Tab") return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }

  element.addEventListener("keydown", handleTabKey);

  // Focus first element
  if (firstElement) {
    firstElement.focus();
  }

  // Return cleanup function
  return () => {
    element.removeEventListener("keydown", handleTabKey);
  };
}

/**
 * Restores focus to previously focused element
 */
export function restoreFocus(previousElement: HTMLElement | null) {
  if (previousElement && typeof previousElement.focus === "function") {
    previousElement.focus();
  }
}

/**
 * Saves current focus and traps focus in element
 */
export function saveFocusAndTrap(element: HTMLElement) {
  const previousElement = document.activeElement as HTMLElement;
  const cleanup = trapFocus(element);

  return {
    cleanup: () => {
      cleanup();
      restoreFocus(previousElement);
    },
  };
}

/**
 * Scrolls element into view with smooth behavior
 */
export function scrollIntoView(element: HTMLElement, options?: ScrollIntoViewOptions) {
  element.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    ...options,
  });
}

/**
 * Announces message to screen readers
 */
export function announceToScreenReader(message: string, priority: "polite" | "assertive" = "polite") {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}
