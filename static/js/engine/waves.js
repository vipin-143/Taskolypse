// @ts-check
/**
 * Taskocalypse: Bunker Defense - Wave Progression & Day/Night Cycle
 * Pure logic controlling pacing, enemy batching, and environmental atmosphere.
 */

/**
 * Ambient environmental color palette based on day/night wave cycle.
 * @type {Record<number, { name: string, skyTop: string, skyBottom: string, wallColor: string, isNight: boolean }>}
 */
export const DAY_NIGHT_CYCLES = Object.freeze({
  0: {
    name: "Dawn",
    skyTop: "#1e1b4b",
    skyBottom: "#4338ca",
    wallColor: "#475569",
    isNight: false,
  },
  1: {
    name: "Day",
    skyTop: "#0f172a",
    skyBottom: "#1e293b",
    wallColor: "#64748b",
    isNight: false,
  },
  2: {
    name: "Dusk",
    skyTop: "#31103f",
    skyBottom: "#701a75",
    wallColor: "#581c87",
    isNight: false,
  },
  3: {
    name: "Night",
    skyTop: "#020617",
    skyBottom: "#0b1329",
    wallColor: "#334155",
    isNight: true,
  },
});

/**
 * Get environmental theme for a given wave.
 * @param {number} wave
 * @returns {typeof DAY_NIGHT_CYCLES[0]}
 */
export function getWaveEnvironment(wave) {
  const index = (wave - 1) % 4;
  return DAY_NIGHT_CYCLES[index];
}

/**
 * Calculate total waves for a given file count.
 * @param {number} totalFiles
 * @param {number} [filesPerWave=6]
 * @returns {number}
 */
export function calculateTotalWaves(totalFiles, filesPerWave = 6) {
  if (totalFiles <= 0) return 1;
  return Math.max(1, Math.ceil(totalFiles / filesPerWave));
}

/**
 * Slice the full file list into wave batches.
 * @template T
 * @param {T[]} items
 * @param {number} [filesPerWave=6]
 * @returns {T[][]}
 */
export function splitIntoWaves(items, filesPerWave = 6) {
  const waves = [];
  for (let i = 0; i < items.length; i += filesPerWave) {
    waves.push(items.slice(i, i + filesPerWave));
  }
  return waves.length > 0 ? waves : [[]];
}

/**
 * Calculate score bonus awarded for clearing a wave.
 * @param {number} wave
 * @param {number} cityHealth
 * @param {number} combo
 * @returns {number}
 */
export function calculateWaveClearBonus(wave, cityHealth, combo) {
  const baseBonus = wave * 250;
  const healthMultiplier = Math.max(0.5, cityHealth / 100);
  const comboBonus = combo * 50;
  return Math.round((baseBonus + comboBonus) * healthMultiplier);
}
