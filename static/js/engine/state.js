// @ts-check
/**
 * Taskocalypse: Bunker Defense - Central Game State
 * Pure logic state container without DOM dependencies.
 */

import { GAME_CONFIG, GAME_MODES } from "./constants.js";

/**
 * @typedef {Object} Enemy
 * @property {string} id
 * @property {import("./spawner.js").ClassifiedFile} rawFile
 * @property {string} type
 * @property {string} filename
 * @property {number} sizeBytes
 * @property {string} suggestedBunker
 * @property {number} confidence
 * @property {string} reason
 * @property {number} x
 * @property {number} y
 * @property {number} lane
 * @property {number} speed
 * @property {boolean} routed
 * @property {boolean} reachedWall
 * @property {boolean} isCluster
 * @property {string[]} clusterFilePaths
 */

/**
 * Create a fresh initial game state.
 * @param {string} [mode=GAME_MODES.CAMPAIGN]
 * @returns {GameState}
 */
export function createInitialState(mode = GAME_MODES.CAMPAIGN) {
  return {
    mode,
    cityHealth: GAME_CONFIG.MAX_CITY_HEALTH,
    maxCityHealth: GAME_CONFIG.MAX_CITY_HEALTH,
    score: 0,
    combo: 1,
    highestCombo: 1,
    accuracyHits: 0,
    totalRouted: 0,
    totalSkipped: 0,
    currentWave: 1,
    totalWaves: 1,
    waveState: "intro", // "intro" | "spawning" | "active" | "cleared" | "game_over" | "victory"
    isPaused: false,
    assistMode: false,
    highContrast: false,
    reducedMotion: false,

    // Active power-ups
    powerups: {
      empActiveTimer: 0,
      autoTurretCharges: 0,
      shieldCharges: 0,
    },

    // File processing queue and active entities
    queue: [],
    activeEnemies: [],
    selectedEnemyId: null,

    // Decisions logged for backend execution plan
    // Each decision: { relativePath, chosenBunker, override, originalSuggestion, isCluster }
    decisions: [],
    // Skipped file paths (reached wall unrouted - no disk action)
    skippedPaths: new Set(),

    // Player override history recorded during this run
    overridesRecorded: [],

    // Session metadata
    csrfToken: "",
    rootPath: "",
    duplicateCount: 0,
    totalScannedFiles: 0,
    totalScannedBytes: 0,
  };
}

/**
 * @typedef {ReturnType<typeof createInitialState>} GameState
 */

