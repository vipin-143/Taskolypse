// @ts-check
/**
 * Taskocalypse: Bunker Defense - Keyboard Controller
 * Full keyboard playability: 1-8, Space, Tab, P/Esc, Z, M, C.
 */

import { BUNKER_KEYS } from "../engine/constants.js";

/**
 * @typedef {Object} KeyboardHandlers
 * @property {(bunkerName: string) => void} onRoute
 * @property {() => void} onAcceptSuggestion
 * @property {() => void} onCycleTargetForward
 * @property {() => void} onCycleTargetBackward
 * @property {() => void} onTogglePause
 * @property {() => void} onUndo
 * @property {() => void} onToggleMute
 * @property {() => void} onToggleCalm
 */

export class KeyboardController {
  /**
   * @param {KeyboardHandlers} handlers
   */
  constructor(handlers) {
    this.handlers = handlers;

    window.addEventListener("keydown", (e) => this.handleKeyDown(e));
  }

  /**
   * @param {KeyboardEvent} e
   */
  handleKeyDown(e) {
    // Ignore keystrokes when user is typing in form inputs
    const target = /** @type {HTMLElement} */ (e.target);
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    // 1. Bunker routing (1-8 and Numpad 1-8)
    const key = e.key;
    if (BUNKER_KEYS[key]) {
      e.preventDefault();
      this.handlers.onRoute(BUNKER_KEYS[key]);
      return;
    }

    // 2. Accept suggestion (Space or Enter)
    if (key === " " || key === "Enter") {
      e.preventDefault();
      this.handlers.onAcceptSuggestion();
      return;
    }

    // 3. Cycle targeted enemy (Tab / Shift+Tab)
    if (key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        this.handlers.onCycleTargetBackward();
      } else {
        this.handlers.onCycleTargetForward();
      }
      return;
    }

    // 4. Pause (P or Escape)
    if (key === "p" || key === "P" || key === "Escape") {
      e.preventDefault();
      this.handlers.onTogglePause();
      return;
    }

    // 5. Undo (Z or z)
    if (key === "z" || key === "Z") {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.handlers.onUndo();
        return;
      }
    }

    // 6. Mute toggle (M or m)
    if (key === "m" || key === "M") {
      e.preventDefault();
      this.handlers.onToggleMute();
      return;
    }

    // 7. Calm mode toggle (C or c)
    if (key === "c" || key === "C") {
      e.preventDefault();
      this.handlers.onToggleCalm();
    }
  }
}
