// @ts-check
/**
 * Taskocalypse: Bunker Defense - Scoring & Combo Engine
 * Pure logic for score calculations, combo progression, and end-of-run statistics.
 */

import { GAME_CONFIG } from "./constants.js";

/**
 * @typedef {Object} RouteResult
 * @property {number} pointsEarned
 * @property {number} newCombo
 * @property {boolean} isCorrect
 * @property {string} feedbackMessage
 */

/**
 * Calculate points and combo impact for a routing decision.
 * @param {string} chosenBunker
 * @param {string} suggestedBunker
 * @param {number} currentCombo
 * @param {boolean} [isCluster=false]
 * @returns {RouteResult}
 */
export function calculateRouteScore(chosenBunker, suggestedBunker, currentCombo, isCluster = false) {
  const isCorrect = chosenBunker === suggestedBunker;

  if (isCorrect) {
    const nextCombo = Math.min(GAME_CONFIG.MAX_COMBO, currentCombo + 1);
    const clusterMultiplier = isCluster ? 3.0 : 1.0;
    const points = Math.round(GAME_CONFIG.BASE_SCORE_CORRECT * nextCombo * clusterMultiplier);

    let feedbackMessage = `+${points} Combo x${nextCombo}!`;
    if (nextCombo >= 8) {
      feedbackMessage = `🔥 RAMPAGE! +${points}`;
    } else if (nextCombo >= 5) {
      feedbackMessage = `⚡ ULTRA! +${points}`;
    }

    return {
      pointsEarned: points,
      newCombo: nextCombo,
      isCorrect: true,
      feedbackMessage,
    };
  }

  // Player override
  return {
    pointsEarned: GAME_CONFIG.BASE_SCORE_OVERRIDE,
    newCombo: 1, // breaks combo without health penalty
    isCorrect: false,
    feedbackMessage: `Override (+${GAME_CONFIG.BASE_SCORE_OVERRIDE})`,
  };
}

/**
 * Format bytes into human-readable unit (KB, MB, GB).
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes <= 0) return "0 KB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${val} ${sizes[i]}`;
}

/**
 * Compile end-of-run statistical performance summary.
 * @param {import("./state.js").GameState} state
 * @returns {RunSummaryStats}
 */
export function calculateRunSummary(state) {
  const totalDecisions = state.decisions.length;
  const accuracy = totalDecisions > 0 ? Math.round((state.accuracyHits / totalDecisions) * 100) : 100;

  let totalReclaimedBytes = 0;
  let quarantinedCount = 0;

  for (const dec of state.decisions) {
    if (dec.chosenBunker === "Trash-Quarantine") {
      quarantinedCount += 1;
      totalReclaimedBytes += dec.sizeBytes || 0;
    }
  }

  return {
    finalScore: state.score,
    highestCombo: state.highestCombo,
    accuracyPercent: accuracy,
    filesSorted: totalDecisions,
    filesSkipped: state.skippedPaths.size,
    quarantinedCount,
    reclaimedBytesFormatted: formatBytes(totalReclaimedBytes),
    reclaimedBytes: totalReclaimedBytes,
    cityHealthRemaining: state.cityHealth,
  };
}

/**
 * @typedef {ReturnType<typeof calculateRunSummary>} RunSummaryStats
 */
