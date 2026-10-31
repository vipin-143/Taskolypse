// @ts-check
/**
 * Taskocalypse: Bunker Defense - Pointer & Touch Controller
 * Click selection, tap routing, and drag-and-drop support.
 */

/**
 * @typedef {Object} PointerHandlers
 * @property {(enemy: import("../engine/state.js").Enemy) => void} onSelectEnemy
 * @property {(bunkerName: string) => void} onRouteToBunker
 * @property {() => import("../engine/state.js").Enemy[]} getActiveEnemies
 */

export class PointerController {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import("../render/canvas.js").CanvasController} canvasCtrl
   * @param {PointerHandlers} handlers
   */
  constructor(canvas, canvasCtrl, handlers) {
    this.canvas = canvas;
    this.canvasCtrl = canvasCtrl;
    this.handlers = handlers;

    this.draggedEnemy = null;

    this.initCanvasPointer();
    this.initBunkerButtons();
  }

  initCanvasPointer() {
    this.canvas.addEventListener("pointerdown", (e) => {
      const enemies = this.handlers.getActiveEnemies();
      const hit = this.canvasCtrl.hitTestEnemy(e.clientX, e.clientY, enemies);
      if (hit) {
        this.handlers.onSelectEnemy(hit);
        this.draggedEnemy = hit;
      }
    });

    window.addEventListener("pointerup", (e) => {
      if (this.draggedEnemy) {
        // Check if dropped onto a bunker button
        const elem = document.elementFromPoint(e.clientX, e.clientY);
        const bunkerBtn = elem ? elem.closest(".bunker-btn") : null;
        if (bunkerBtn) {
          const bunker = bunkerBtn.getAttribute("data-bunker");
          if (bunker) {
            this.handlers.onRouteToBunker(bunker);
          }
        }
        this.draggedEnemy = null;
      }
    });
  }

  initBunkerButtons() {
    const buttons = document.querySelectorAll(".bunker-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const bunker = btn.getAttribute("data-bunker");
        if (bunker) {
          this.handlers.onRouteToBunker(bunker);
        }
      });
    });
  }
}
