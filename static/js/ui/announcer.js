// @ts-check
/**
 * Taskocalypse: Bunker Defense - Throttled ARIA-Live Announcer
 * Ensures screen readers receive timely, uncluttered updates.
 */

export class ScreenReaderAnnouncer {
  /**
   * @param {HTMLElement|null} element
   * @param {number} [throttleMs=750]
   */
  constructor(element, throttleMs = 750) {
    this.element = element;
    this.throttleMs = throttleMs;
    this.lastAnnouncementTime = 0;
    this.pendingTimeout = null;
  }

  /**
   * Announce a message to assistive technology.
   * @param {string} message
   * @param {boolean} [immediate=false]
   */
  announce(message, immediate = false) {
    if (!this.element || !message) return;

    const now = Date.now();
    if (immediate || now - this.lastAnnouncementTime >= this.throttleMs) {
      this.lastAnnouncementTime = now;
      this.element.textContent = "";
      // Brief RAF timeout to ensure screen reader detects text node mutation
      requestAnimationFrame(() => {
        if (this.element) {
          this.element.textContent = message;
        }
      });
    } else {
      if (this.pendingTimeout) clearTimeout(this.pendingTimeout);
      this.pendingTimeout = setTimeout(() => {
        if (this.element) {
          this.element.textContent = message;
          this.lastAnnouncementTime = Date.now();
        }
      }, this.throttleMs - (now - this.lastAnnouncementTime));
    }
  }
}

