// @ts-check
/**
 * Taskocalypse: Bunker Defense - Power-Up Logic Engine
 * Pure logic handling EMP, Auto-Turret, City Shield, and Cluster Purge.
 */

import { GAME_CONFIG, POWERUPS } from "./constants.js";

/**
 * Check if the player has enough score to purchase a power-up.
 * @param {import("./state.js").GameState} state
 * @param {keyof typeof POWERUPS} powerupKey
 * @returns {boolean}
 */
export function canPurchasePowerup(state, powerupKey) {
  const conf = POWERUPS[powerupKey];
  if (!conf) return false;
  return state.score >= conf.cost;
}

/**
 * Purchase a power-up, deducting score.
 * @param {import("./state.js").GameState} state
 * @param {keyof typeof POWERUPS} powerupKey
 * @returns {boolean}
 */
export function purchasePowerup(state, powerupKey) {
  const conf = POWERUPS[powerupKey];
  if (!conf || state.score < conf.cost) return false;

  state.score -= conf.cost;

  if (powerupKey === "SHIELD") {
    state.powerups.shieldCharges = Math.min(
      conf.maxCharges || 2,
      state.powerups.shieldCharges + 1
    );
  } else if (powerupKey === "AUTO_TURRET") {
    state.powerups.autoTurretCharges += conf.shots || 3;
  } else if (powerupKey === "EMP") {
    state.powerups.empActiveTimer = conf.duration;
  }

  return true;
}

/**
 * Activate Slow-Mo EMP.
 * @param {import("./state.js").GameState} state
 */
export function activateEMP(state) {
  state.powerups.empActiveTimer = POWERUPS.EMP.duration;
}

/**
 * Update active power-up timers.
 * @param {import("./state.js").GameState} state
 * @param {number} deltaSeconds
 */
export function updatePowerupTimers(state, deltaSeconds) {
  if (state.powerups.empActiveTimer > 0) {
    state.powerups.empActiveTimer = Math.max(0, state.powerups.empActiveTimer - deltaSeconds);
  }
}

/**
 * Check if City Shield can absorb an unrouted file hit.
 * @param {import("./state.js").GameState} state
 * @returns {boolean} True if damage was absorbed
 */
export function tryAbsorbDamageWithShield(state) {
  if (state.powerups.shieldCharges > 0) {
    state.powerups.shieldCharges -= 1;
    return true; // Damage absorbed!
  }
  return false;
}

/**
 * Auto-Turret execution: routes high-confidence enemies automatically.
 * @param {import("./state.js").GameState} state
 * @returns {import("./state.js").Enemy[]} Array of auto-routed enemies
 */
export function triggerAutoTurret(state) {
  if (state.powerups.autoTurretCharges <= 0) return [];

  const eligible = state.activeEnemies.filter(
    (e) => !e.routed && !e.reachedWall && e.confidence >= GAME_CONFIG.CONFIDENCE_AUTO_THRESHOLD
  );

  const targets = eligible.slice(0, state.powerups.autoTurretCharges);
  state.powerups.autoTurretCharges -= targets.length;

  return targets;
}

