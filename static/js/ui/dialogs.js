// @ts-check
/**
 * Taskocalypse: Bunker Defense - Accessible Modal Dialog Manager
 * Focus trapping, Escape key closing, and focus restoration.
 */

export class DialogManager {
  constructor() {
    this.activeDialog = null;
    this.triggerElement = null;

    // Global Escape handler
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.activeDialog) {
        this.closeDialog(this.activeDialog);
      }
    });
  }

  /**
   * Open an accessible modal dialog.
   * @param {HTMLDialogElement} dialog
   * @param {HTMLElement} [triggerEl]
   */
  openDialog(dialog, triggerEl) {
    if (!dialog) return;
    this.triggerElement = triggerEl || /** @type {HTMLElement} */ (document.activeElement);
    this.activeDialog = dialog;

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.classList.remove("hidden");
    }

    // Move focus inside dialog
    const focusable = dialog.querySelector("button, input, select, [tabindex='0']");
    if (focusable instanceof HTMLElement) {
      focusable.focus();
    }
  }

  /**
   * Close dialog and restore focus.
   * @param {HTMLDialogElement} dialog
   */
  closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.classList.add("hidden");
    }
    this.activeDialog = null;

    if (this.triggerElement && typeof this.triggerElement.focus === "function") {
      this.triggerElement.focus();
    }
  }
}
