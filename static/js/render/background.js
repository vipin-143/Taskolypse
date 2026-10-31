// @ts-check
/**
 * Taskocalypse: Bunker Defense - Procedural Parallax Background
 * Day/night sky, stars, city skyline, and defense wall.
 */

import { GAME_CONFIG } from "../engine/constants.js";
import { getWaveEnvironment } from "../engine/waves.js";

export class ParallaxBackground {
  constructor() {
    /** @type {Array<{ x: number, y: number, r: number, alpha: number }>} */
    this.stars = [];
    for (let i = 0; i < 45; i++) {
      this.stars.push({
        x: Math.random() * 1000,
        y: Math.random() * 180,
        r: 0.8 + Math.random() * 1.5,
        alpha: 0.3 + Math.random() * 0.7,
      });
    }

    /** @type {Array<{ x: number, w: number, h: number, winRows: number, winCols: number }>} */
    this.buildings = [];
    let curX = 0;
    while (curX < 1100) {
      const w = 45 + Math.random() * 55;
      const h = 80 + Math.random() * 140;
      this.buildings.push({
        x: curX,
        w,
        h,
        winRows: Math.floor(h / 18),
        winCols: Math.floor(w / 14),
      });
      curX += w - 8;
    }
  }

  /**
   * Draw the environment based on wave progress.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} wave
   * @param {number} width
   * @param {number} height
   * @param {number} timeSeconds
   * @param {number} shieldCharges
   */
  render(ctx, wave, width, height, timeSeconds, shieldCharges = 0) {
    const env = getWaveEnvironment(wave);

    // 1. Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, env.skyTop);
    skyGrad.addColorStop(1, env.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Stars (twinkling when dark)
    if (env.isNight || env.name === "Dusk" || env.name === "Dawn") {
      ctx.fillStyle = "#ffffff";
      for (const s of this.stars) {
        const twinkle = Math.sin(timeSeconds * 3 + s.x) * 0.3 + s.alpha;
        ctx.globalAlpha = Math.max(0.1, Math.min(1.0, twinkle));
        ctx.beginPath();
        ctx.arc(s.x % width, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }

    // 3. Distant City Skyline
    ctx.fillStyle = env.wallColor;
    for (const b of this.buildings) {
      const by = height - 60 - b.h;
      ctx.fillRect(b.x % width, by, b.w, b.h);

      // Lit windows
      ctx.fillStyle = "#fef08a";
      ctx.globalAlpha = 0.25;
      for (let r = 0; r < b.winRows; r++) {
        for (let c = 0; c < b.winCols; c++) {
          if ((r + c + Math.floor(b.x)) % 3 === 0) {
            ctx.fillRect(
              (b.x % width) + 6 + c * 10,
              by + 8 + r * 14,
              5,
              7
            );
          }
        }
      }
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = env.wallColor;
    }

    // 4. Defense Wall on Left
    const wallX = GAME_CONFIG.WALL_X;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, wallX, height - 52);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wallX, 0);
    ctx.lineTo(wallX, height - 52);
    ctx.stroke();

    // Wall shield energy field
    if (shieldCharges > 0) {
      const pulse = Math.sin(timeSeconds * 5) * 0.15 + 0.35;
      ctx.fillStyle = `rgba(56, 189, 248, ${pulse})`;
      ctx.fillRect(wallX - 8, 0, 16, height - 52);
    }

    // 5. Marching Lane Dividers
    ctx.strokeStyle = "rgba(71, 85, 105, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    for (let l = 0; l <= GAME_CONFIG.LANES; l++) {
      const ly = GAME_CONFIG.LANE_Y_START + l * GAME_CONFIG.LANE_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(wallX, ly);
      ctx.lineTo(width, ly);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}
