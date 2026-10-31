// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import { BUNKERS, ENEMY_TYPES, GAME_CONFIG, GAME_MODES, POWERUPS } from "../../static/js/engine/constants.js";
import { createInitialState } from "../../static/js/engine/state.js";
import {
  createRNG,
  determineEnemyType,
  groupFilesIntoWaves,
  createEnemy,
} from "../../static/js/engine/spawner.js";
import {
  calculateTotalWaves,
  calculateWaveClearBonus,
  getWaveEnvironment,
  splitIntoWaves,
} from "../../static/js/engine/waves.js";
import { calculateRouteScore, calculateRunSummary, formatBytes } from "../../static/js/engine/scoring.js";
import {
  activateEMP,
  canPurchasePowerup,
  purchasePowerup,
  triggerAutoTurret,
  tryAbsorbDamageWithShield,
  updatePowerupTimers,
} from "../../static/js/engine/powerups.js";

test("Spawner: PRNG determinism", () => {
  const rng1 = createRNG(42);
  const rng2 = createRNG(42);
  const sequence1 = [rng1(), rng1(), rng1(), rng1()];
  const sequence2 = [rng2(), rng2(), rng2(), rng2()];
  assert.deepEqual(sequence1, sequence2);
});

test("Spawner: Determine enemy types from file attributes", () => {
  // 1. Content duplicate -> Glitch Monster
  const dupItem = {
    file: {
      relative_path: "copy.pdf",
      name: "copy.pdf",
      extension: ".pdf",
      size_bytes: 500,
      mtime: 1000,
      mime_type: "application/pdf",
      is_duplicate: true,
      duplicate_of: "orig.pdf",
    },
    suggestion: { bunker: BUNKERS.TRASH, confidence: 0.98, reason: "Duplicate" },
  };
  assert.equal(determineEnemyType(dupItem), ENEMY_TYPES.GLITCH_MONSTER);

  // 2. Zero-byte -> Ghost
  const zeroItem = {
    file: {
      relative_path: "empty.log",
      name: "empty.log",
      extension: ".log",
      size_bytes: 0,
      mtime: 1000,
      mime_type: "text/plain",
      is_duplicate: false,
      duplicate_of: null,
    },
    suggestion: { bunker: BUNKERS.TRASH, confidence: 0.95, reason: "Empty" },
  };
  assert.equal(determineEnemyType(zeroItem), ENEMY_TYPES.GHOST);

  // 3. Temp fragment -> Temp Zombie
  const tempItem = {
    file: {
      relative_path: "video.mp4.crdownload",
      name: "video.mp4.crdownload",
      extension: ".crdownload",
      size_bytes: 1234,
      mtime: 1000,
      mime_type: "application/octet-stream",
      is_duplicate: false,
      duplicate_of: null,
    },
    suggestion: { bunker: BUNKERS.TRASH, confidence: 0.95, reason: "Temp" },
  };
  assert.equal(determineEnemyType(tempItem), ENEMY_TYPES.TEMP_ZOMBIE);

  // 4. Boss Hydra cluster
  assert.equal(determineEnemyType(dupItem, true), ENEMY_TYPES.BOSS_HYDRA);
});

test("Spawner: Duplicate Hydra clustering", () => {
  const files = [
    {
      file: { relative_path: "report.pdf", name: "report.pdf", extension: ".pdf", size_bytes: 100, mtime: 1, mime_type: "application/pdf", is_duplicate: false, duplicate_of: null },
      suggestion: { bunker: BUNKERS.DOCUMENTS, confidence: 0.9, reason: "Doc" },
    },
    {
      file: { relative_path: "report (1).pdf", name: "report (1).pdf", extension: ".pdf", size_bytes: 100, mtime: 1, mime_type: "application/pdf", is_duplicate: true, duplicate_of: "report.pdf" },
      suggestion: { bunker: BUNKERS.TRASH, confidence: 0.98, reason: "Dup 1" },
    },
    {
      file: { relative_path: "report_copy.pdf", name: "report_copy.pdf", extension: ".pdf", size_bytes: 100, mtime: 1, mime_type: "application/pdf", is_duplicate: true, duplicate_of: "report.pdf" },
      suggestion: { bunker: BUNKERS.TRASH, confidence: 0.98, reason: "Dup 2" },
    },
  ];

  const grouped = groupFilesIntoWaves(files);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].primary.file.relative_path, "report.pdf");
  assert.equal(grouped[0].cluster.length, 2);
});

test("Waves: progression, batching, and day/night cycles", () => {
  const env0 = getWaveEnvironment(1);
  const env1 = getWaveEnvironment(2);
  const env2 = getWaveEnvironment(3);
  const env3 = getWaveEnvironment(4);
  assert.notEqual(env0.name, env1.name);
  assert.equal(env3.name, "Night");
  assert.equal(env3.isNight, true);

  assert.equal(calculateTotalWaves(15, 5), 3);
  assert.equal(calculateTotalWaves(0, 5), 1);

  const batches = splitIntoWaves([1, 2, 3, 4, 5, 6, 7], 3);
  assert.equal(batches.length, 3);
  assert.equal(batches[0].length, 3);
  assert.equal(batches[2].length, 1);

  const bonus = calculateWaveClearBonus(2, 100, 3);
  assert.ok(bonus > 500);
});

test("Scoring: combo scaling, overrides, and statistical summary", () => {
  // Correct routing builds combo
  const r1 = calculateRouteScore(BUNKERS.DOCUMENTS, BUNKERS.DOCUMENTS, 1);
  assert.equal(r1.isCorrect, true);
  assert.equal(r1.newCombo, 2);
  assert.equal(r1.pointsEarned, 200);

  // Override breaks combo without penalty
  const r2 = calculateRouteScore(BUNKERS.KEEP, BUNKERS.DOCUMENTS, 4);
  assert.equal(r2.isCorrect, false);
  assert.equal(r2.newCombo, 1);
  assert.equal(r2.pointsEarned, GAME_CONFIG.BASE_SCORE_OVERRIDE);

  // Format bytes
  assert.equal(formatBytes(0), "0 KB");
  assert.equal(formatBytes(1048576), "1 MB");

  // Statistical summary
  const state = createInitialState();
  state.score = 1250;
  state.highestCombo = 5;
  state.accuracyHits = 4;
  state.decisions = [
    { relativePath: "a.txt", chosenBunker: BUNKERS.DOCUMENTS, override: false, originalSuggestion: BUNKERS.DOCUMENTS, sizeBytes: 100, extension: ".txt", isCluster: false },
    { relativePath: "b.tmp", chosenBunker: BUNKERS.TRASH, override: false, originalSuggestion: BUNKERS.TRASH, sizeBytes: 500, extension: ".tmp", isCluster: false },
  ];
  state.skippedPaths.add("skipped.bin");

  const summary = calculateRunSummary(state);
  assert.equal(summary.finalScore, 1250);
  assert.equal(summary.filesSorted, 2);
  assert.equal(summary.filesSkipped, 1);
  assert.equal(summary.quarantinedCount, 1);
  assert.equal(summary.reclaimedBytes, 500);
});

test("Powerups: purchase, EMP timer, City Shield, Auto-Turret", () => {
  const state = createInitialState();
  state.score = 500;

  // Can purchase
  assert.equal(canPurchasePowerup(state, "SHIELD"), true);
  assert.equal(purchasePowerup(state, "SHIELD"), true);
  assert.equal(state.powerups.shieldCharges, 1);
  assert.equal(state.score, 300);

  // City Shield absorbs damage
  assert.equal(tryAbsorbDamageWithShield(state), true);
  assert.equal(state.powerups.shieldCharges, 0);
  assert.equal(tryAbsorbDamageWithShield(state), false);

  // EMP timer
  activateEMP(state);
  assert.equal(state.powerups.empActiveTimer, POWERUPS.EMP.duration);
  updatePowerupTimers(state, 2.0);
  assert.equal(state.powerups.empActiveTimer, POWERUPS.EMP.duration - 2.0);

  // Auto-Turret targets
  state.powerups.autoTurretCharges = 2;
  const enemyHigh = createEnemy(
    { file: { relative_path: "high.pdf", name: "high.pdf", extension: ".pdf", size_bytes: 10, mtime: 1, mime_type: "application/pdf", is_duplicate: false, duplicate_of: null }, suggestion: { bunker: BUNKERS.DOCUMENTS, confidence: 0.95, reason: "High" } },
    0, 1
  );
  const enemyLow = createEnemy(
    { file: { relative_path: "low.xyz", name: "low.xyz", extension: ".xyz", size_bytes: 10, mtime: 1, mime_type: "application/octet-stream", is_duplicate: false, duplicate_of: null }, suggestion: { bunker: BUNKERS.KEEP, confidence: 0.4, reason: "Low" } },
    1, 1
  );

  state.activeEnemies = [enemyHigh, enemyLow];
  const autoTargets = triggerAutoTurret(state);
  assert.equal(autoTargets.length, 1);
  assert.equal(autoTargets[0].filename, "high.pdf");
});

