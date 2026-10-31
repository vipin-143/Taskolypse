// @ts-check
/**
 * Taskocalypse: Bunker Defense - Engine Constants
 * Pure JS, zero external dependencies.
 */

/**
 * Bunker IDs matching backend classification
 * @readonly
 * @enum {string}
 */
export const BUNKERS = Object.freeze({
  DOCUMENTS: "Documents",
  IMAGES: "Images",
  VIDEOS: "Videos",
  CODE: "Code",
  ARCHIVES: "Archives",
  INSTALLERS: "Installers",
  TRASH: "Trash-Quarantine",
  KEEP: "Keep",
});

/**
 * Bunker key bindings (1-8)
 * @readonly
 */
export const BUNKER_KEYS = Object.freeze({
  "1": BUNKERS.DOCUMENTS,
  "2": BUNKERS.IMAGES,
  "3": BUNKERS.VIDEOS,
  "4": BUNKERS.CODE,
  "5": BUNKERS.ARCHIVES,
  "6": BUNKERS.INSTALLERS,
  "7": BUNKERS.TRASH,
  "8": BUNKERS.KEEP,
});

/**
 * Enemy archetypes mapped from file properties
 * @readonly
 * @enum {string}
 */
export const ENEMY_TYPES = Object.freeze({
  DOCUMENT_SURVIVOR: "Document Survivor",
  IMAGE_SURVIVOR: "Image Survivor",
  VIDEO_MARAUDER: "Video Marauder",
  CODE_RUNNER: "Code Runner",
  ARCHIVE_GOLEM: "Archive Golem",
  INSTALLER_BRUTE: "Installer Brute",
  TEMP_ZOMBIE: "Temp Zombie",
  GLITCH_MONSTER: "Glitch Monster",
  GHOST: "Ghost",
  BOSS_HYDRA: "Duplicate Hydra",
});

/**
 * Enemy metadata: icon, primary bunker, description, color
 * @type {Record<string, { icon: string, baseBunker: string, color: string, description: string }>}
 */
export const ENEMY_META = Object.freeze({
  [ENEMY_TYPES.DOCUMENT_SURVIVOR]: {
    icon: "📄",
    baseBunker: BUNKERS.DOCUMENTS,
    color: "#38bdf8",
    description: "Documents & Spreadsheets",
  },
  [ENEMY_TYPES.IMAGE_SURVIVOR]: {
    icon: "🖼️",
    baseBunker: BUNKERS.IMAGES,
    color: "#4ade80",
    description: "Photos & Screenshots",
  },
  [ENEMY_TYPES.VIDEO_MARAUDER]: {
    icon: "🎬",
    baseBunker: BUNKERS.VIDEOS,
    color: "#f472b6",
    description: "Media Clips & Recordings",
  },
  [ENEMY_TYPES.CODE_RUNNER]: {
    icon: "💻",
    baseBunker: BUNKERS.CODE,
    color: "#fbbf24",
    description: "Source Scripts & Configs",
  },
  [ENEMY_TYPES.ARCHIVE_GOLEM]: {
    icon: "📦",
    baseBunker: BUNKERS.ARCHIVES,
    color: "#a78bfa",
    description: "Compressed Archives",
  },
  [ENEMY_TYPES.INSTALLER_BRUTE]: {
    icon: "⚙️",
    baseBunker: BUNKERS.INSTALLERS,
    color: "#fb923c",
    description: "Software Setups & Executables",
  },
  [ENEMY_TYPES.TEMP_ZOMBIE]: {
    icon: "☣️",
    baseBunker: BUNKERS.TRASH,
    color: "#f87171",
    description: "Temporary Junk & Incomplete Downloads",
  },
  [ENEMY_TYPES.GLITCH_MONSTER]: {
    icon: "👾",
    baseBunker: BUNKERS.TRASH,
    color: "#c084fc",
    description: "Duplicate Content Match",
  },
  [ENEMY_TYPES.GHOST]: {
    icon: "👻",
    baseBunker: BUNKERS.TRASH,
    color: "#94a3b8",
    description: "Zero-Byte Empty / Ancient File",
  },
  [ENEMY_TYPES.BOSS_HYDRA]: {
    icon: "🐉",
    baseBunker: BUNKERS.TRASH,
    color: "#ef4444",
    description: "Cluster of Exact Duplicates",
  },
});

/**
 * Game Modes
 * @readonly
 * @enum {string}
 */
export const GAME_MODES = Object.freeze({
  CAMPAIGN: "campaign",
  ENDLESS: "endless",
  CALM: "calm",
});

/**
 * Power-up types and score purchase costs
 * @readonly
 */
export const POWERUPS = Object.freeze({
  EMP: { id: "emp", name: "Slow-Mo EMP", cost: 150, duration: 6.0, icon: "⚡" },
  AUTO_TURRET: { id: "auto_turret", name: "Auto-Turret", cost: 300, shots: 3, icon: "🤖" },
  SHIELD: { id: "shield", name: "City Shield", cost: 200, maxCharges: 2, icon: "🛡️" },
  CLUSTER_PURGE: { id: "purge", name: "Cluster Purge", cost: 250, icon: "💥" },
});

/**
 * Gameplay balance constants
 */
export const GAME_CONFIG = Object.freeze({
  MAX_CITY_HEALTH: 100,
  DAMAGE_PER_UNROUTED: 15,
  BASE_SPEED: 45, // pixels per second
  SPEED_INCREMENT_PER_WAVE: 4,
  MAX_SPEED: 130,
  BASE_SCORE_CORRECT: 100,
  BASE_SCORE_OVERRIDE: 50,
  MAX_COMBO: 10,
  WALL_X: 120, // city defense wall location from left
  SPAWN_X: 980, // right boundary spawn point
  LANES: 4,
  LANE_Y_START: 130,
  LANE_HEIGHT: 75,
  MAX_PARTICLES: 150,
  CONFIDENCE_AUTO_THRESHOLD: 0.90,
});

