// @ts-check
/**
 * Taskocalypse: Bunker Defense - Main Game Coordinator
 * Clean ES Module wiring with requestAnimationFrame loop and accessible DOM mirroring.
 */

import { ApiClient } from "./api/client.js";
import { AudioSynthesizer } from "./audio/synth.js";
import { BUNKERS, GAME_CONFIG, GAME_MODES } from "./engine/constants.js";
import { buildBackendPlanPayload, extractOverridesForTraining } from "./engine/planBuilder.js";
import {
  calculateRouteScore,
  calculateRunSummary,
} from "./engine/scoring.js";
import {
  createEnemy,
  createRNG,
  groupFilesIntoWaves,
} from "./engine/spawner.js";
import { createInitialState } from "./engine/state.js";
import {
  calculateTotalWaves,
  calculateWaveClearBonus,
  splitIntoWaves,
} from "./engine/waves.js";
import { KeyboardController } from "./input/keyboard.js";
import { PointerController } from "./input/pointer.js";
import { CanvasController } from "./render/canvas.js";
import { ScreenReaderAnnouncer } from "./ui/announcer.js";
import { DialogManager } from "./ui/dialogs.js";
import { HudController } from "./ui/hud.js";
import { PlanReviewController } from "./ui/planReview.js";

// Global singleton instances
const api = new ApiClient();
const synth = new AudioSynthesizer();
const announcer = new ScreenReaderAnnouncer(document.getElementById("sr-announcer"));
const hud = new HudController();
const dialogs = new DialogManager();
const planReview = new PlanReviewController();

const canvasEl = /** @type {HTMLCanvasElement} */ (document.getElementById("game-canvas"));
const canvasCtrl = new CanvasController(canvasEl);

let state = createInitialState();
let waveBatches = [];
let rng = createRNG(Date.now());
let lastFrameTime = performance.now();
let lastJournalId = "";

// ---------------------------------------------------------------------------
// Game Loop (Fixed Timestep with Delta Clamping)
// ---------------------------------------------------------------------------

function gameLoop(currentTimestamp) {
  const rawDelta = (currentTimestamp - lastFrameTime) / 1000;
  lastFrameTime = currentTimestamp;
  // Delta clamping to max 0.1s prevents spiral of death on tab switch
  const deltaSeconds = Math.min(0.1, Math.max(0.001, rawDelta));

  if (!state.isPaused && state.waveState === "active") {
    updateGameLogic(deltaSeconds);
  }

  canvasCtrl.renderFrame(state, deltaSeconds);
  hud.update(state);

  requestAnimationFrame(gameLoop);
}

// ---------------------------------------------------------------------------
// Logic Updates
// ---------------------------------------------------------------------------

function updateGameLogic(deltaSeconds) {
  // Update powerup timers (EMP)
  const isEMPActive = state.powerups.empActiveTimer > 0;
  if (isEMPActive) {
    state.powerups.empActiveTimer = Math.max(0, state.powerups.empActiveTimer - deltaSeconds);
  }

  const speedMultiplier = isEMPActive ? 0.25 : 1.0;
  let remainingUnrouted = 0;

  for (const enemy of state.activeEnemies) {
    if (enemy.routed || enemy.reachedWall) continue;
    remainingUnrouted++;

    // In Calm mode, enemies advance to lane midpoints and wait without wall damage
    if (state.mode === GAME_MODES.CALM) {
      if (enemy.x > GAME_CONFIG.WALL_X + 160) {
        enemy.x -= enemy.speed * speedMultiplier * deltaSeconds;
      }
      continue;
    }

    // Standard march towards defense wall
    enemy.x -= enemy.speed * speedMultiplier * deltaSeconds;

    // Check Wall Collision (Unrouted file reaches city)
    if (enemy.x <= GAME_CONFIG.WALL_X) {
      enemy.reachedWall = true;
      state.totalSkipped++;
      state.skippedPaths.add(enemy.rawFile.file.relative_path);

      // Try absorbing hit with City Shield
      if (state.powerups.shieldCharges > 0) {
        state.powerups.shieldCharges--;
        synth.playRoute(false);
        canvasCtrl.particles.spawnText("SHIELD BLOCKED!", GAME_CONFIG.WALL_X + 40, enemy.y, "#38bdf8", true);
        announcer.announce(`Shield absorbed breach by ${enemy.filename}.`);
      } else {
        // Take damage
        state.cityHealth = Math.max(0, state.cityHealth - GAME_CONFIG.DAMAGE_PER_UNROUTED);
        state.combo = 1;
        synth.playWallHit();
        canvasCtrl.particles.burst(GAME_CONFIG.WALL_X, enemy.y, "#ef4444", 20);
        canvasCtrl.particles.spawnText(`-${GAME_CONFIG.DAMAGE_PER_UNROUTED} HP`, GAME_CONFIG.WALL_X + 30, enemy.y, "#ef4444", true);
        announcer.announce(`Breach! ${enemy.filename} hit the city wall. Health ${state.cityHealth}%.`);

        if (state.cityHealth <= 0) {
          handleGameOver();
          return;
        }
      }

      // Automatically select next available enemy
      selectNextEnemy();
    }
  }

  // Wave Cleared Check
  if (remainingUnrouted === 0 && state.activeEnemies.length > 0) {
    handleWaveCleared();
  }
}

// ---------------------------------------------------------------------------
// Enemy Targeting & Selection
// ---------------------------------------------------------------------------

function autoSelectTarget() {
  // Select the foremost (closest to wall) unrouted enemy
  let foremost = null;
  let minX = Infinity;

  for (const e of state.activeEnemies) {
    if (!e.routed && !e.reachedWall && e.x < minX) {
      minX = e.x;
      foremost = e;
    }
  }

  state.selectedEnemyId = foremost ? foremost.id : null;

  if (foremost) {
    announcer.announce(
      `Targeted ${foremost.filename}. Suggested bunker: ${foremost.suggestedBunker}. ${foremost.reason}`
    );
  }
}

function selectNextEnemy() {
  const eligible = state.activeEnemies.filter((e) => !e.routed && !e.reachedWall);
  if (eligible.length === 0) {
    state.selectedEnemyId = null;
    return;
  }
  const currentIndex = eligible.findIndex((e) => e.id === state.selectedEnemyId);
  const next = eligible[(currentIndex + 1) % eligible.length];
  state.selectedEnemyId = next ? next.id : null;
}

function selectPrevEnemy() {
  const eligible = state.activeEnemies.filter((e) => !e.routed && !e.reachedWall);
  if (eligible.length === 0) {
    state.selectedEnemyId = null;
    return;
  }
  const currentIndex = eligible.findIndex((e) => e.id === state.selectedEnemyId);
  const prev = eligible[(currentIndex - 1 + eligible.length) % eligible.length];
  state.selectedEnemyId = prev ? prev.id : null;
}

// ---------------------------------------------------------------------------
// Bunker Routing Action
// ---------------------------------------------------------------------------

function routeTargetToBunker(bunkerName) {
  const target = state.activeEnemies.find((e) => e.id === state.selectedEnemyId);
  if (!target || target.routed || target.reachedWall) return;

  target.routed = true;
  state.totalRouted++;

  // Muzzle flash on corresponding turret
  const bunkerIndex = Object.values(BUNKERS).indexOf(/** @type {any} */ (bunkerName));
  if (bunkerIndex >= 0) {
    canvasCtrl.fireTurret(bunkerIndex);
  }

  const result = calculateRouteScore(
    bunkerName,
    target.suggestedBunker,
    state.combo,
    target.isCluster
  );

  state.score += result.pointsEarned;
  state.combo = result.newCombo;
  state.highestCombo = Math.max(state.highestCombo, state.combo);

  if (result.isCorrect) {
    state.accuracyHits++;
    synth.playRoute(true, state.combo);
    canvasCtrl.particles.burst(target.x, target.y, "#38bdf8", 16);
    canvasCtrl.particles.spawnText(result.feedbackMessage, target.x, target.y - 15, "#38bdf8", state.combo >= 5);
  } else {
    synth.playRoute(false);
    canvasCtrl.particles.burst(target.x, target.y, "#fbbf24", 10);
    canvasCtrl.particles.spawnText(result.feedbackMessage, target.x, target.y - 15, "#fbbf24", false);

    // Record override event in backend
    api.recordOverride(
      target.rawFile.file.extension,
      bunkerName,
      target.suggestedBunker
    );
  }

  // Record for backend dry-run action plan
  state.decisions.push({
    relativePath: target.rawFile.file.relative_path,
    chosenBunker: bunkerName,
    override: !result.isCorrect,
    originalSuggestion: target.suggestedBunker,
    sizeBytes: target.sizeBytes,
    extension: target.rawFile.file.extension,
    isCluster: target.isCluster,
    clusterFilePaths: target.clusterFilePaths,
  });

  announcer.announce(`Routed ${target.filename} to ${bunkerName}. ${result.feedbackMessage}`);

  // In Assist mode, pause automatically when a new target arrives
  if (state.assistMode) {
    state.isPaused = true;
  }

  autoSelectTarget();
}

// ---------------------------------------------------------------------------
// Wave Progression
// ---------------------------------------------------------------------------

function startWave(waveIndex) {
  state.currentWave = waveIndex + 1;
  state.waveState = "active";
  synth.playWaveStart();

  const waveItems = waveBatches[waveIndex] || [];
  state.activeEnemies = waveItems.map((grouped, idx) =>
    createEnemy(grouped.primary, idx, state.currentWave, rng, grouped.cluster)
  );

  autoSelectTarget();
  announcer.announce(`Wave ${state.currentWave} began. ${state.activeEnemies.length} files incoming.`);
}

function handleWaveCleared() {
  state.waveState = "cleared";
  const bonus = calculateWaveClearBonus(state.currentWave, state.cityHealth, state.combo);
  state.score += bonus;
  canvasCtrl.particles.spawnText(`WAVE CLEARED! +${bonus}`, 500, 200, "#4ade80", true);

  if (state.currentWave < state.totalWaves) {
    setTimeout(() => {
      startWave(state.currentWave);
    }, 1200);
  } else {
    // All waves completed! Transition to Victory & Action Plan Dry-Run
    handleVictory();
  }
}

async function handleVictory() {
  state.waveState = "victory";
  synth.playWaveStart();
  await transitionToPlanReview();
}

async function handleGameOver() {
  state.waveState = "game_over";
  announcer.announce("City breached! Game over. Compiling action plan preview for routed files.");
  await transitionToPlanReview();
}

// ---------------------------------------------------------------------------
// Dry-Run Review & Execution Flow
// ---------------------------------------------------------------------------

async function transitionToPlanReview() {
  // Hide game view, reveal summary view
  const gameView = document.getElementById("view-game");
  const summaryView = document.getElementById("view-summary");
  if (gameView) gameView.classList.add("hidden");
  if (summaryView) summaryView.classList.remove("hidden");

  const stats = calculateRunSummary(state);

  // Compile dry-run plan through backend
  try {
    const payload = buildBackendPlanPayload(state.decisions, state.rootPath, state.csrfToken);
    const planRes = await api.buildPlan(state.rootPath, payload.decisions);
    planReview.renderSummary(stats, planRes.items || []);
  } catch (err) {
    planReview.renderSummary(stats, []);
    const fb = document.getElementById("exec-feedback");
    if (fb) {
      fb.textContent = `Could not compile dry run: ${err.message}`;
      fb.classList.remove("hidden");
    }
  }
}

// ---------------------------------------------------------------------------
// Wire UI Handlers & Inputs
// ---------------------------------------------------------------------------

function setupEventHandlers() {
  // 1. Keyboard Inputs
  new KeyboardController({
    onRoute: (bunker) => routeTargetToBunker(bunker),
    onAcceptSuggestion: () => {
      const target = state.activeEnemies.find((e) => e.id === state.selectedEnemyId);
      if (target) routeTargetToBunker(target.suggestedBunker);
    },
    onCycleTargetForward: () => selectNextEnemy(),
    onCycleTargetBackward: () => selectPrevEnemy(),
    onTogglePause: () => {
      state.isPaused = !state.isPaused;
      announcer.announce(state.isPaused ? "Game paused." : "Game resumed.");
    },
    onUndo: () => {
      const btnUndo = document.getElementById("btn-undo-run");
      if (btnUndo && !btnUndo.classList.contains("hidden")) {
        btnUndo.click();
      }
    },
    onToggleMute: () => {
      const isSoundOn = synth.toggleSound();
      const soundBtn = document.getElementById("btn-sound-toggle");
      if (soundBtn) {
        soundBtn.setAttribute("aria-pressed", String(isSoundOn));
        soundBtn.textContent = isSoundOn ? "🔊 Sound: ON" : "🔇 Sound: OFF";
      }
      announcer.announce(isSoundOn ? "Sound enabled." : "Sound muted.");
    },
    onToggleCalm: () => {
      state.mode = state.mode === GAME_MODES.CALM ? GAME_MODES.CAMPAIGN : GAME_MODES.CALM;
      announcer.announce(`Switched to ${state.mode} mode.`);
    },
  });

  // 2. Pointer Inputs
  new PointerController(canvasEl, canvasCtrl, {
    onSelectEnemy: (enemy) => {
      state.selectedEnemyId = enemy.id;
      announcer.announce(`Selected ${enemy.filename}.`);
    },
    onRouteToBunker: (bunker) => routeTargetToBunker(bunker),
    getActiveEnemies: () => state.activeEnemies,
  });

  // 3. Scan & Start Defense Form
  const scanForm = document.getElementById("scan-form");
  if (scanForm) {
    scanForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const folderInput = /** @type {HTMLInputElement} */ (document.getElementById("folder-path-input"));
      const recursiveCheck = /** @type {HTMLInputElement} */ (document.getElementById("check-recursive"));
      const speedSelect = /** @type {HTMLSelectElement} */ (document.getElementById("game-speed-select"));
      const errorDiv = document.getElementById("scan-error");

      const folderPath = folderInput ? folderInput.value.trim() : "";
      if (!folderPath) return;

      if (errorDiv) errorDiv.classList.add("hidden");

      try {
        const scanData = await api.scanFolder(folderPath, recursiveCheck?.checked || false);
        state = createInitialState(speedSelect?.value === "calm" ? GAME_MODES.CALM : GAME_MODES.CAMPAIGN);
        state.csrfToken = scanData.csrf_token || api.csrfToken;
        state.rootPath = scanData.root_path;
        state.duplicateCount = scanData.duplicate_count || 0;
        state.totalScannedFiles = scanData.total_files;
        state.totalScannedBytes = scanData.total_size_bytes;

        const grouped = groupFilesIntoWaves(scanData.files);
        waveBatches = splitIntoWaves(grouped, 6);
        state.totalWaves = waveBatches.length;

        // Switch views: hide setup, show game arena
        const setupView = document.getElementById("view-setup");
        const gameView = document.getElementById("view-game");
        if (setupView) setupView.classList.add("hidden");
        if (gameView) gameView.classList.remove("hidden");

        canvasCtrl.resize();
        startWave(0);
      } catch (err) {
        if (errorDiv) {
          errorDiv.textContent = `Scan failed: ${err.message}`;
          errorDiv.classList.remove("hidden");
        }
      }
    });
  }

  // 4. Demo Folder Auto-fill
  const btnDemo = document.getElementById("btn-use-demo");
  if (btnDemo) {
    btnDemo.addEventListener("click", () => {
      const folderInput = /** @type {HTMLInputElement} */ (document.getElementById("folder-path-input"));
      if (folderInput) {
        folderInput.value = "demo_folder";
        folderInput.focus();
      }
    });
  }

  // 5. Sound Toggle Button
  const btnSound = document.getElementById("btn-sound-toggle");
  if (btnSound) {
    btnSound.addEventListener("click", () => {
      const on = synth.toggleSound();
      btnSound.setAttribute("aria-pressed", String(on));
      btnSound.textContent = on ? "🔊 Sound: ON" : "🔇 Sound: OFF";
    });
  }

  // 6. Help Dialog
  const btnHelp = document.getElementById("btn-help");
  const helpDialog = /** @type {HTMLDialogElement} */ (document.getElementById("help-dialog"));
  const btnCloseHelp = document.getElementById("btn-close-help");
  const btnDismissHelp = document.getElementById("btn-dismiss-help");

  if (btnHelp && helpDialog) {
    btnHelp.addEventListener("click", () => dialogs.openDialog(helpDialog, btnHelp));
  }
  if (btnCloseHelp && helpDialog) {
    btnCloseHelp.addEventListener("click", () => dialogs.closeDialog(helpDialog));
  }
  if (btnDismissHelp && helpDialog) {
    btnDismissHelp.addEventListener("click", () => dialogs.closeDialog(helpDialog));
  }

  // 7. Execute Action Plan Button
  const btnExecute = document.getElementById("btn-execute-plan");
  if (btnExecute) {
    btnExecute.addEventListener("click", async () => {
      const feedback = document.getElementById("exec-feedback");
      try {
        const payload = buildBackendPlanPayload(state.decisions, state.rootPath, state.csrfToken);
        const planRes = await api.buildPlan(state.rootPath, payload.decisions);
        const execRes = await api.executePlan(state.rootPath, planRes.items || []);
        lastJournalId = execRes.journal_id;
        planReview.showSuccess(`Cleaned and organized ${execRes.executed_count} files successfully!`);
      } catch (err) {
        if (feedback) {
          feedback.textContent = `Execution failed: ${err.message}`;
          feedback.classList.remove("hidden");
        }
      }
    });
  }

  // 8. Undo Button
  const btnUndo = document.getElementById("btn-undo-run");
  if (btnUndo) {
    btnUndo.addEventListener("click", async () => {
      const feedback = document.getElementById("undo-feedback");
      if (!lastJournalId) return;
      try {
        const undoRes = await api.undoRun(state.rootPath, lastJournalId);
        if (feedback) {
          feedback.textContent = `Reverted: ${undoRes.message}`;
          feedback.className = "alert alert-success";
          feedback.classList.remove("hidden");
        }
      } catch (err) {
        if (feedback) {
          feedback.textContent = `Undo failed: ${err.message}`;
          feedback.className = "alert alert-error";
          feedback.classList.remove("hidden");
        }
      }
    });
  }

  // 9. Play Again Button
  const btnPlayAgain = document.getElementById("btn-play-again");
  if (btnPlayAgain) {
    btnPlayAgain.addEventListener("click", () => {
      window.location.reload();
    });
  }
}

// ---------------------------------------------------------------------------
// Start Application
// ---------------------------------------------------------------------------

window.addEventListener("DOMContentLoaded", async () => {
  setupEventHandlers();
  // Obtain session CSRF token
  try {
    await api.getSession();
  } catch {
    // Non-blocking initial session attempt
  }
  requestAnimationFrame(gameLoop);
});

