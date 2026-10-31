// @ts-check
/**
 * Taskocalypse: Bunker Defense - Canvas Render Loop & Viewport Controller
 * Fixed timestep, DPR scaling (capped at 2.0), delta clamping.
 */

import { ParallaxBackground } from "./background.js";
import { ParticlePool } from "./particles.js";
import { drawBunkerTurrets, drawEnemy } from "./sprites.js";

export class CanvasController {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not initialize 2D canvas context.");
    this.ctx = ctx;

    this.background = new ParallaxBackground();
    this.particles = new ParticlePool();

    this.virtualWidth = 1000;
    this.virtualHeight = 500;
    this.dpr = Math.min(2.0, window.devicePixelRatio || 1.0);

    this.lastTimestamp = 0;
    this.elapsedSeconds = 0;
    this.activeMuzzleIndex = -1;
    this.muzzleTimer = 0;

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  /**
   * Adjust canvas for HiDPI screens without layout thrashing.
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(320, rect.width || this.virtualWidth);
    const height = Math.max(240, rect.height || this.virtualHeight);

    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;

    this.ctx.resetTransform();
    this.ctx.scale(this.dpr, this.dpr);
    this.ctx.scale(width / this.virtualWidth, height / this.virtualHeight);
  }

  /**
   * Trigger a bunker turret firing flash.
   * @param {number} bunkerIndex
   */
  fireTurret(bunkerIndex) {
    this.activeMuzzleIndex = bunkerIndex;
    this.muzzleTimer = 0.12;
  }

  /**
   * Check if a screen coordinate hits an active enemy.
   * @param {number} screenX
   * @param {number} screenY
   * @param {import("../engine/state.js").Enemy[]} enemies
   * @returns {import("../engine/state.js").Enemy|null}
   */
  hitTestEnemy(screenX, screenY, enemies) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.virtualWidth / rect.width;
    const scaleY = this.virtualHeight / rect.height;
    const vx = (screenX - rect.left) * scaleX;
    const vy = (screenY - rect.top) * scaleY;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.routed || e.reachedWall) continue;
      const dx = vx - e.x;
      const dy = vy - e.y;
      if (dx * dx + dy * dy <= 30 * 30) {
        return e;
      }
    }
    return null;
  }

  /**
   * Render a complete frame.
   * @param {import("../engine/state.js").GameState} state
   * @param {number} deltaSeconds
   */
  renderFrame(state, deltaSeconds) {
    this.elapsedSeconds += deltaSeconds;

    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= deltaSeconds;
      if (this.muzzleTimer <= 0) this.activeMuzzleIndex = -1;
    }

    this.particles.update(deltaSeconds);

    this.ctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);

    // 1. Parallax background
    this.background.render(
      this.ctx,
      state.currentWave,
      this.virtualWidth,
      this.virtualHeight,
      this.elapsedSeconds,
      state.powerups.shieldCharges
    );

    // 2. Active Enemies
    for (const enemy of state.activeEnemies) {
      if (!enemy.routed && !enemy.reachedWall) {
        const isSelected = enemy.id === state.selectedEnemyId;
        drawEnemy(this.ctx, enemy, isSelected, this.elapsedSeconds);
      }
    }

    // 3. Particles & Floating Text
    this.particles.render(this.ctx);

    // 4. Bunkers / Turrets
    const selected = state.activeEnemies.find((e) => e.id === state.selectedEnemyId);
    const suggestedBunker = selected ? selected.suggestedBunker : null;
    drawBunkerTurrets(
      this.ctx,
      suggestedBunker,
      this.activeMuzzleIndex,
      this.virtualWidth,
      this.virtualHeight
    );
  }
}
