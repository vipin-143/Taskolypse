// @ts-check
/**
 * Taskocalypse: Bunker Defense - File Spawner & Type Mapping
 * Pure logic mapping backend file classifications into enemy archetypes.
 */

import { BUNKERS, ENEMY_TYPES, GAME_CONFIG } from "./constants.js";

/**
 * @typedef {Object} RawFileInfo
 * @property {string} relative_path
 * @property {string} name
 * @property {string} extension
 * @property {number} size_bytes
 * @property {number} mtime
 * @property {string} mime_type
 * @property {boolean} is_duplicate
 * @property {string|null} duplicate_of
 */

/**
 * @typedef {Object} RawSuggestion
 * @property {string} bunker
 * @property {number} confidence
 * @property {string} reason
 */

/**
 * @typedef {Object} ClassifiedFile
 * @property {RawFileInfo} file
 * @property {RawSuggestion} suggestion
 */

/**
 * Simple deterministic pseudo-random number generator (Mulberry32).
 * @param {number} seed
 * @returns {() => number} Returns float in [0, 1)
 */
export function createRNG(seed = 12345678) {
  let s = Math.imul(seed, 0x6d2b79f5);
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Classify a raw classified file into a game enemy archetype.
 * @param {ClassifiedFile} item
 * @param {boolean} [isCluster=false]
 * @returns {string} Enemy archetype
 */
export function determineEnemyType(item, isCluster = false) {
  if (isCluster) {
    return ENEMY_TYPES.BOSS_HYDRA;
  }

  const { file, suggestion } = item;

  // 1. Content Hash Duplicate
  if (file.is_duplicate) {
    return ENEMY_TYPES.GLITCH_MONSTER;
  }

  // 2. Empty or Zero-byte
  if (file.size_bytes === 0) {
    return ENEMY_TYPES.GHOST;
  }

  // 3. Temp fragments
  const ext = (file.extension || "").toLowerCase();
  if (
    ext === ".tmp" ||
    ext === ".crdownload" ||
    ext === ".part" ||
    file.name.toLowerCase().endsWith(".tmp")
  ) {
    return ENEMY_TYPES.TEMP_ZOMBIE;
  }

  // 4. Map by suggestion bunker
  switch (suggestion.bunker) {
    case BUNKERS.DOCUMENTS:
      return ENEMY_TYPES.DOCUMENT_SURVIVOR;
    case BUNKERS.IMAGES:
      return ENEMY_TYPES.IMAGE_SURVIVOR;
    case BUNKERS.VIDEOS:
      return ENEMY_TYPES.VIDEO_MARAUDER;
    case BUNKERS.CODE:
      return ENEMY_TYPES.CODE_RUNNER;
    case BUNKERS.ARCHIVES:
      return ENEMY_TYPES.ARCHIVE_GOLEM;
    case BUNKERS.INSTALLERS:
      return ENEMY_TYPES.INSTALLER_BRUTE;
    case BUNKERS.TRASH:
      return ENEMY_TYPES.TEMP_ZOMBIE;
    default:
      return ENEMY_TYPES.DOCUMENT_SURVIVOR;
  }
}

/**
 * Group raw files, detecting duplicate clusters for Hydra Bosses.
 * @param {ClassifiedFile[]} files
 * @returns {Array<{ primary: ClassifiedFile, cluster: ClassifiedFile[] }>}
 */
export function groupFilesIntoWaves(files) {
  /** @type {Map<string, ClassifiedFile[]>} */
  const duplicateGroups = new Map();
  /** @type {Array<{ primary: ClassifiedFile, cluster: ClassifiedFile[] }>} */
  const result = [];

  // Group duplicates by duplicate_of target
  for (const item of files) {
    if (item.file.is_duplicate && item.file.duplicate_of) {
      const parent = item.file.duplicate_of;
      if (!duplicateGroups.has(parent)) {
        duplicateGroups.set(parent, []);
      }
      duplicateGroups.get(parent)?.push(item);
    }
  }

  const handledDuplicates = new Set();

  for (const item of files) {
    // Check if this item is a duplicate that was clustered
    if (item.file.is_duplicate && handledDuplicates.has(item.file.relative_path)) {
      continue;
    }

    const relPath = item.file.relative_path;
    // Check if this item has 2 or more duplicates associated with it -> Duplicate Hydra!
    if (duplicateGroups.has(relPath) && (duplicateGroups.get(relPath)?.length || 0) >= 2) {
      const cluster = duplicateGroups.get(relPath) || [];
      for (const c of cluster) {
        handledDuplicates.add(c.file.relative_path);
      }
      result.push({ primary: item, cluster });
    } else {
      result.push({ primary: item, cluster: [] });
    }
  }

  return result;
}

/**
 * Create a live enemy object for the canvas loop.
 * @param {ClassifiedFile} item
 * @param {number} index
 * @param {number} wave
 * @param {() => number} [rng]
 * @param {ClassifiedFile[]} [cluster=[]]
 * @returns {import("./state.js").Enemy}
 */
export function createEnemy(item, index, wave, rng = Math.random, cluster = []) {
  const isCluster = cluster.length > 0;
  const enemyType = determineEnemyType(item, isCluster);
  const lane = Math.floor(rng() * GAME_CONFIG.LANES);
  const laneY = GAME_CONFIG.LANE_Y_START + lane * GAME_CONFIG.LANE_HEIGHT;

  const baseSpeed = GAME_CONFIG.BASE_SPEED + (wave - 1) * GAME_CONFIG.SPEED_INCREMENT_PER_WAVE;
  // Slower speed for heavy bosses, faster for code runners
  let speedMultiplier = 1.0;
  if (enemyType === ENEMY_TYPES.BOSS_HYDRA) speedMultiplier = 0.65;
  else if (enemyType === ENEMY_TYPES.CODE_RUNNER) speedMultiplier = 1.2;
  else if (enemyType === ENEMY_TYPES.INSTALLER_BRUTE) speedMultiplier = 0.85;

  const speed = Math.min(GAME_CONFIG.MAX_SPEED, baseSpeed * speedMultiplier);

  const clusterFilePaths = isCluster
    ? [item.file.relative_path, ...cluster.map((c) => c.file.relative_path)]
    : [item.file.relative_path];

  return {
    id: `enemy_${index}_${Math.floor(rng() * 100000)}`,
    rawFile: item,
    type: enemyType,
    filename: item.file.name,
    sizeBytes: item.file.size_bytes,
    suggestedBunker: item.suggestion.bunker,
    confidence: item.suggestion.confidence,
    reason: item.suggestion.reason,
    x: GAME_CONFIG.SPAWN_X + (index % 3) * 60,
    y: laneY,
    lane,
    speed,
    routed: false,
    reachedWall: false,
    isCluster,
    clusterFilePaths,
  };
}

