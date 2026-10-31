// @ts-check
/**
 * Taskocalypse: Bunker Defense - Particle & Floating Text Pool
 * High-performance object pool with zero hot-loop allocations.
 */

import { GAME_CONFIG } from "../engine/constants.js";

/**
 * @typedef {Object} Particle
 * @property {boolean} active
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} size
 * @property {string} color
 * @property {number} life
 * @property {number} maxLife
 * @property {number} alpha
 */

/**
 * @typedef {Object} FloatingText
 * @property {boolean} active
 * @property {string} text
 * @property {number} x
 * @property {number} y
 * @property {number} vy
 * @property {string} color
 * @property {number} life
 * @property {number} maxLife
 * @property {boolean} isCrit
 */

export class ParticlePool {
  /**
   * @param {number} [maxSize=GAME_CONFIG.MAX_PARTICLES]
   */
  constructor(maxSize = GAME_CONFIG.MAX_PARTICLES) {
    this.maxSize = maxSize;
    /** @type {Particle[]} */
    this.pool = [];
    /** @type {FloatingText[]} */
    this.textPool = [];

    // Pre-allocate particles
    for (let i = 0; i < this.maxSize; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 3,
        color: "#fff",
        life: 0,
        maxLife: 1,
        alpha: 1,
      });
    }

    // Pre-allocate floating text items
    for (let i = 0; i < 30; i++) {
      this.textPool.push({
        active: false,
        text: "",
        x: 0,
        y: 0,
        vy: -30,
        color: "#fbbf24",
        life: 0,
        maxLife: 1,
        isCrit: false,
      });
    }
  }

  /**
   * Spawn a burst of hit/routing particles.
   * @param {number} x
   * @param {number} y
   * @param {string} color
   * @param {number} [count=12]
   */
  burst(x, y, color, count = 12) {
    let spawned = 0;
    for (const p of this.pool) {
      if (!p.active) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 90;
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.size = 2.5 + Math.random() * 3.5;
        p.color = color;
        p.life = 0;
        p.maxLife = 0.4 + Math.random() * 0.35;
        p.alpha = 1;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  /**
   * Spawn floating feedback score text.
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {string} [color="#fbbf24"]
   * @param {boolean} [isCrit=false]
   */
  spawnText(text, x, y, color = "#fbbf24", isCrit = false) {
    for (const t of this.textPool) {
      if (!t.active) {
        t.active = true;
        t.text = text;
        t.x = x;
        t.y = y;
        t.vy = isCrit ? -45 : -30;
        t.color = color;
        t.life = 0;
        t.maxLife = isCrit ? 1.0 : 0.75;
        t.isCrit = isCrit;
        break;
      }
    }
  }

  /**
   * Update all active particles and texts.
   * @param {number} deltaSeconds
   */
  update(deltaSeconds) {
    for (const p of this.pool) {
      if (p.active) {
        p.life += deltaSeconds;
        if (p.life >= p.maxLife) {
          p.active = false;
        } else {
          p.x += p.vx * deltaSeconds;
          p.y += p.vy * deltaSeconds;
          p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        }
      }
    }

    for (const t of this.textPool) {
      if (t.active) {
        t.life += deltaSeconds;
        if (t.life >= t.maxLife) {
          t.active = false;
        } else {
          t.y += t.vy * deltaSeconds;
        }
      }
    }
  }

  /**
   * Render all particles and floating text.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    ctx.save();
    for (const p of this.pool) {
      if (p.active) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.textAlign = "center";
    for (const t of this.textPool) {
      if (t.active) {
        const progress = t.life / t.maxLife;
        ctx.globalAlpha = Math.max(0, 1 - progress);
        ctx.font = t.isCrit ? "bold 18px monospace" : "bold 14px monospace";
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      }
    }
    ctx.restore();
  }
}

