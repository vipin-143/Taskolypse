// @ts-check
/**
 * Taskocalypse: Bunker Defense - DOM HUD Controller
 * Updates accessible mirrored DOM elements without layout thrashing.
 */

import { formatBytes } from "../engine/scoring.js";

export class HudController {
  constructor() {
    this.el = {
      healthFill: document.getElementById("hud-health-fill"),
      healthVal: document.getElementById("hud-health-val"),
      healthBar: document.getElementById("hud-health-bar"),
      waveVal: document.getElementById("hud-wave-val"),
      scoreVal: document.getElementById("hud-score-val"),
      comboVal: document.getElementById("hud-combo-val"),
      targetCard: document.getElementById("hud-target-card"),
      targetName: document.getElementById("hud-target-name"),
      targetType: document.getElementById("hud-target-type"),
      targetSize: document.getElementById("hud-target-size"),
      targetSuggestion: document.getElementById("hud-target-suggestion"),
      targetReason: document.getElementById("hud-target-reason"),
      empBtn: document.getElementById("btn-powerup-emp"),
      turretBtn: document.getElementById("btn-powerup-turret"),
      shieldBtn: document.getElementById("btn-powerup-shield"),
      bunkerButtons: document.querySelectorAll(".bunker-btn"),
    };

    this.lastState = {
      health: -1,
      score: -1,
      combo: -1,
      wave: -1,
      selectedId: "",
      suggestedBunker: "",
      shieldCharges: -1,
      turretCharges: -1,
    };
  }

  /**
   * Update HUD elements based on current game state.
   * @param {import("../engine/state.js").GameState} state
   */
  update(state) {
    // 1. Health Bar
    if (this.lastState.health !== state.cityHealth) {
      this.lastState.health = state.cityHealth;
      const pct = Math.max(0, Math.min(100, state.cityHealth));
      if (this.el.healthFill) this.el.healthFill.style.width = `${pct}%`;
      if (this.el.healthVal) this.el.healthVal.textContent = `${pct}%`;
      if (this.el.healthBar) this.el.healthBar.setAttribute("aria-valuenow", String(pct));
    }

    // 2. Score & Combo
    if (this.lastState.score !== state.score) {
      this.lastState.score = state.score;
      if (this.el.scoreVal) this.el.scoreVal.textContent = state.score.toLocaleString();
    }
    if (this.lastState.combo !== state.combo) {
      this.lastState.combo = state.combo;
      if (this.el.comboVal) {
        this.el.comboVal.textContent = `x${state.combo}`;
        this.el.comboVal.classList.toggle("combo-fire", state.combo >= 5);
      }
    }

    // 3. Wave
    if (this.lastState.wave !== state.currentWave) {
      this.lastState.wave = state.currentWave;
      if (this.el.waveVal) {
        this.el.waveVal.textContent = `${state.currentWave} / ${state.totalWaves}`;
      }
    }

    // 4. Targeted Enemy DOM Mirroring
    const selected = state.activeEnemies.find((e) => e.id === state.selectedEnemyId);
    const selectedId = selected ? selected.id : "";
    const suggestedBunker = selected ? selected.suggestedBunker : "";

    if (this.lastState.selectedId !== selectedId) {
      this.lastState.selectedId = selectedId;
      if (selected) {
        if (this.el.targetCard) this.el.targetCard.classList.remove("hidden");
        if (this.el.targetName) this.el.targetName.textContent = selected.filename;
        if (this.el.targetType) this.el.targetType.textContent = selected.type;
        if (this.el.targetSize) this.el.targetSize.textContent = formatBytes(selected.sizeBytes);
        if (this.el.targetSuggestion) {
          const confPct = Math.round(selected.confidence * 100);
          this.el.targetSuggestion.textContent = `${selected.suggestedBunker} (${confPct}% confidence)`;
        }
        if (this.el.targetReason) this.el.targetReason.textContent = selected.reason;
      } else {
        if (this.el.targetCard) this.el.targetCard.classList.add("hidden");
      }
    }

    // 5. Highlight Suggested Bunker Button
    if (this.lastState.suggestedBunker !== suggestedBunker) {
      this.lastState.suggestedBunker = suggestedBunker;
      this.el.bunkerButtons.forEach((btn) => {
        const b = btn.getAttribute("data-bunker");
        btn.classList.toggle("suggested-glow", b === suggestedBunker);
      });
    }

    // 6. Power-up Button States
    if (this.el.shieldBtn) {
      this.el.shieldBtn.classList.toggle("active-charge", state.powerups.shieldCharges > 0);
      this.el.shieldBtn.setAttribute("data-charges", String(state.powerups.shieldCharges));
    }
    if (this.el.turretBtn) {
      this.el.turretBtn.classList.toggle("active-charge", state.powerups.autoTurretCharges > 0);
      this.el.turretBtn.setAttribute("data-charges", String(state.powerups.autoTurretCharges));
    }
    if (this.el.empBtn) {
      this.el.empBtn.classList.toggle("active-charge", state.powerups.empActiveTimer > 0);
    }
  }
}
