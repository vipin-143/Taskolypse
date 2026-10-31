// @ts-check
/**
 * Taskocalypse: Bunker Defense - Procedural Sprite Drawing
 * Pure canvas drawing for all 10 enemy archetypes, bunkers, and targeting HUD.
 * Strict CSP: ZERO external images, ZERO inline SVG strings.
 */

import { BUNKERS, ENEMY_META, ENEMY_TYPES, GAME_CONFIG } from "../engine/constants.js";

/**
 * Safely truncate a string to fit a maximum character width.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
export function safeTruncate(text, maxChars = 18) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  const keep = Math.floor((maxChars - 3) / 2);
  return `${text.slice(0, keep)}...${text.slice(-keep)}`;
}

/**
 * Draw an enemy survivor / mutant on the canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import("../engine/state.js").Enemy} enemy
 * @param {boolean} isSelected
 * @param {number} timeSeconds
 */
export function drawEnemy(ctx, enemy, isSelected, timeSeconds) {
  const meta = ENEMY_META[enemy.type] || ENEMY_META[ENEMY_TYPES.DOCUMENT_SURVIVOR];
  const x = enemy.x;
  const y = enemy.y;
  const bobbing = Math.sin(timeSeconds * 6 + enemy.lane) * 2.5;

  ctx.save();
  ctx.translate(x, y + bobbing);

  // 1. Selection indicator / Targeting Reticle
  if (isSelected) {
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Reticle brackets
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    const s = 32;
    // Top-left
    ctx.strokeRect(-s / 2 - 4, -s / 2 - 4, 8, 8);
    // Bottom-right
    ctx.strokeRect(s / 2 - 4, s / 2 - 4, 8, 8);
  }

  // 2. Procedural Body based on Enemy Type
  ctx.fillStyle = meta.color;
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;

  switch (enemy.type) {
    case ENEMY_TYPES.DOCUMENT_SURVIVOR: {
      // Document sheet with folded corner
      ctx.beginPath();
      ctx.moveTo(-16, -20);
      ctx.lineTo(8, -20);
      ctx.lineTo(16, -12);
      ctx.lineTo(16, 20);
      ctx.lineTo(-16, 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Fold lines
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-10, -8, 18, 3);
      ctx.fillRect(-10, -1, 20, 3);
      ctx.fillRect(-10, 6, 14, 3);
      break;
    }

    case ENEMY_TYPES.IMAGE_SURVIVOR: {
      // Photo frame with landscape triangle & sun
      ctx.beginPath();
      ctx.roundRect(-18, -16, 36, 32, 4);
      ctx.fill();
      ctx.stroke();

      // Mountain triangles inside
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.moveTo(-12, 10);
      ctx.lineTo(-2, -4);
      ctx.lineTo(8, 10);
      ctx.fill();

      // Sun
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(8, -6, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case ENEMY_TYPES.VIDEO_MARAUDER: {
      // Film slate / play frame
      ctx.beginPath();
      ctx.roundRect(-20, -15, 40, 30, 6);
      ctx.fill();
      ctx.stroke();

      // Play triangle
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.lineTo(8, 0);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case ENEMY_TYPES.CODE_RUNNER: {
      // Terminal box with chevron >_
      ctx.beginPath();
      ctx.roundRect(-18, -16, 36, 32, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#022c22";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(">_", 0, 0);
      break;
    }

    case ENEMY_TYPES.ARCHIVE_GOLEM: {
      // Heavy banded crate / zipped box
      ctx.beginPath();
      ctx.rect(-18, -18, 36, 36);
      ctx.fill();
      ctx.stroke();

      // Cross bands
      ctx.strokeStyle = "#4c1d95";
      ctx.lineWidth = 4;
      ctx.strokeRect(-18, -18, 36, 36);
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(18, 0);
      ctx.moveTo(0, -18);
      ctx.lineTo(0, 18);
      ctx.stroke();
      break;
    }

    case ENEMY_TYPES.INSTALLER_BRUTE: {
      // Octagonal cog wheel
      const r = 20;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const dist = i % 2 === 0 ? r : r - 5;
        const px = Math.cos(a) * dist;
        const py = Math.sin(a) * dist;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner axle
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case ENEMY_TYPES.TEMP_ZOMBIE: {
      // Toxic barrel with radioactive biohazard symbol
      ctx.beginPath();
      ctx.roundRect(-16, -18, 32, 36, 6);
      ctx.fill();
      ctx.stroke();

      // Radiation stripes
      ctx.fillStyle = "#450a0a";
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case ENEMY_TYPES.GLITCH_MONSTER: {
      // Jittering glitch duplicate block
      const jitter = (Math.random() - 0.5) * 4;
      ctx.beginPath();
      ctx.rect(-18 + jitter, -16, 36, 32);
      ctx.fill();
      ctx.stroke();

      // Glitch scanline
      ctx.fillStyle = "#f43f5e";
      ctx.fillRect(-18, -4, 36, 4);
      break;
    }

    case ENEMY_TYPES.GHOST: {
      // Translucent floating phantom
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.arc(0, -8, 16, Math.PI, 0);
      ctx.lineTo(16, 14);
      ctx.lineTo(6, 8);
      ctx.lineTo(0, 14);
      ctx.lineTo(-6, 8);
      ctx.lineTo(-16, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // 0-byte badge
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("0B", 0, 2);
      break;
    }

    case ENEMY_TYPES.BOSS_HYDRA: {
      // Multi-headed giant duplicate boss dragon
      ctx.beginPath();
      ctx.roundRect(-26, -22, 52, 44, 8);
      ctx.fill();
      ctx.stroke();

      // Multiple dragon eye cores
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(-10, -6, 4, 0, Math.PI * 2);
      ctx.arc(10, -6, 4, 0, Math.PI * 2);
      ctx.arc(0, 4, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  // 3. Render filename safely below enemy (Canvas fillText)
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  const nameStr = safeTruncate(enemy.filename, 16);
  // Shadow box for text readability
  ctx.fillRect(-45, 24, 90, 16);
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(nameStr, 0, 36);

  ctx.restore();
}

/**
 * Render the bunkers as defense turrets at the bottom of the arena.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string|null} suggestedBunker
 * @param {number} activeMuzzleIndex
 * @param {number} width
 * @param {number} height
 */
export function drawBunkerTurrets(ctx, suggestedBunker, activeMuzzleIndex, width, height) {
  const bunkerList = Object.values(BUNKERS);
  const bunkerCount = bunkerList.length;
  const bunkerWidth = width / bunkerCount;
  const bunkerHeight = 52;
  const y = height - bunkerHeight;

  ctx.save();
  for (let i = 0; i < bunkerCount; i++) {
    const bName = bunkerList[i];
    const bx = i * bunkerWidth;
    const isSuggested = bName === suggestedBunker;
    const isFiring = i === activeMuzzleIndex;

    // Bunker base pad
    ctx.fillStyle = isSuggested ? "rgba(6, 182, 212, 0.25)" : "rgba(30, 41, 59, 0.75)";
    ctx.strokeStyle = isSuggested ? "#06b6d4" : "#475569";
    ctx.lineWidth = isSuggested ? 2.5 : 1;
    ctx.fillRect(bx + 4, y + 4, bunkerWidth - 8, bunkerHeight - 8);
    ctx.strokeRect(bx + 4, y + 4, bunkerWidth - 8, bunkerHeight - 8);

    // Turret gun barrel
    const centerX = bx + bunkerWidth / 2;
    ctx.fillStyle = isSuggested ? "#38bdf8" : "#94a3b8";
    ctx.beginPath();
    ctx.roundRect(centerX - 4, y - 6, 8, 14, 2);
    ctx.fill();

    // Muzzle flash when firing
    if (isFiring) {
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(centerX, y - 8, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
