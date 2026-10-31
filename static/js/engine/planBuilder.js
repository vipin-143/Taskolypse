// @ts-check
/**
 * Taskocalypse: Bunker Defense - Action Plan Builder
 * Translates arcade routing actions into the backend's reversible PlanRequest.
 * Enforces safety guarantee: Unrouted/skipped files produce NO disk actions.
 */

/**
 * @typedef {Object} RecordedDecision
 * @property {string} relativePath
 * @property {string} chosenBunker
 * @property {boolean} override
 * @property {string} originalSuggestion
 * @property {number} sizeBytes
 * @property {string} extension
 * @property {boolean} isCluster
 * @property {string[]} [clusterFilePaths]
 */

/**
 * @typedef {Object} BackendDecisionItem
 * @property {string} relative_path
 * @property {string} bunker
 * @property {boolean} override
 */

/**
 * Compile queued game decisions into the backend PlanRequest payload.
 *
 * CRITICAL SAFETY PROPERTY:
 * Skipped files (files that reached the defense wall unrouted) are NEVER included
 * in the payload. They remain untouched on disk.
 *
 * @param {RecordedDecision[]} decisions
 * @param {string} rootPath
 * @param {string} csrfToken
 * @returns {{ root_path: string, decisions: BackendDecisionItem[], csrf_token: string }}
 */
export function buildBackendPlanPayload(decisions, rootPath, csrfToken) {
  /** @type {BackendDecisionItem[]} */
  const backendDecisions = [];
  const processedPaths = new Set();

  for (const dec of decisions) {
    if (dec.isCluster && dec.clusterFilePaths && dec.clusterFilePaths.length > 0) {
      // Cluster Boss (Hydra): apply decision to every duplicate file in the cluster
      for (const p of dec.clusterFilePaths) {
        if (!processedPaths.has(p)) {
          processedPaths.add(p);
          backendDecisions.push({
            relative_path: p,
            bunker: dec.chosenBunker,
            override: dec.override,
          });
        }
      }
    } else {
      if (!processedPaths.has(dec.relativePath)) {
        processedPaths.add(dec.relativePath);
        backendDecisions.push({
          relative_path: dec.relativePath,
          bunker: dec.chosenBunker,
          override: dec.override,
        });
      }
    }
  }

  return {
    root_path: rootPath,
    decisions: backendDecisions,
    csrf_token: csrfToken,
  };
}

/**
 * Extract player overrides to report to `/api/override` for heuristic learning.
 * @param {RecordedDecision[]} decisions
 * @param {string} csrfToken
 * @returns {Array<{ extension: string, chosen_bunker: string, original_bunker: string, csrf_token: string }>}
 */
export function extractOverridesForTraining(decisions, csrfToken) {
  const overrides = [];
  const seen = new Set();

  for (const d of decisions) {
    if (d.override && d.extension) {
      const key = `${d.extension}_${d.chosenBunker}`;
      if (!seen.has(key)) {
        seen.add(key);
        overrides.push({
          extension: d.extension,
          chosen_bunker: d.chosenBunker,
          original_bunker: d.originalSuggestion,
          csrf_token: csrfToken,
        });
      }
    }
  }

  return overrides;
}
