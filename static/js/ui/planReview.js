// @ts-check
/**
 * Taskocalypse: Bunker Defense - Action Plan Review & Undo UI
 * Safe DOM rendering (textContent only, safe element construction).
 */

import { formatBytes } from "../engine/scoring.js";

export class PlanReviewController {
  constructor() {
    this.el = {
      summaryView: document.getElementById("view-summary"),
      successView: document.getElementById("view-success"),
      gameView: document.getElementById("view-game"),
      setupView: document.getElementById("view-setup"),

      // Summary stats
      sumScore: document.getElementById("sum-score"),
      sumAccuracy: document.getElementById("sum-accuracy"),
      sumCombo: document.getElementById("sum-combo"),
      sumSorted: document.getElementById("sum-sorted"),
      sumQuarantined: document.getElementById("sum-quarantined"),
      sumReclaimed: document.getElementById("sum-reclaimed"),
      sumSkipped: document.getElementById("sum-skipped"),

      // Plan table
      planTableBody: document.getElementById("plan-items-tbody"),
      btnExecute: document.getElementById("btn-execute-plan"),
      btnDiscard: document.getElementById("btn-discard-plan"),
      execFeedback: document.getElementById("exec-feedback"),

      // Success & Undo
      successMessage: document.getElementById("success-message"),
      btnUndo: document.getElementById("btn-undo-run"),
      undoFeedback: document.getElementById("undo-feedback"),
      btnPlayAgain: document.getElementById("btn-play-again"),
    };
  }

  /**
   * Render the summary screen and dry-run preview table.
   * @param {import("../engine/scoring.js").RunSummaryStats} stats
   * @param {Array<{ action: string, source_path: string, target_path: string|null, size_bytes: number }>} planItems
   */
  renderSummary(stats, planItems) {
    if (this.el.sumScore) this.el.sumScore.textContent = stats.finalScore.toLocaleString();
    if (this.el.sumAccuracy) this.el.sumAccuracy.textContent = `${stats.accuracyPercent}%`;
    if (this.el.sumCombo) this.el.sumCombo.textContent = `x${stats.highestCombo}`;
    if (this.el.sumSorted) this.el.sumSorted.textContent = String(stats.filesSorted);
    if (this.el.sumQuarantined) this.el.sumQuarantined.textContent = String(stats.quarantinedCount);
    if (this.el.sumReclaimed) this.el.sumReclaimed.textContent = stats.reclaimedBytesFormatted;
    if (this.el.sumSkipped) this.el.sumSkipped.textContent = String(stats.filesSkipped);

    // Populate plan table safely using textContent & createElement
    if (this.el.planTableBody) {
      this.el.planTableBody.textContent = ""; // Clear existing rows

      if (planItems.length === 0) {
        const emptyRow = document.createElement("tr");
        const emptyCell = document.createElement("td");
        emptyCell.colSpan = 4;
        emptyCell.textContent = "No files were queued for disk reorganization. All files remain in place.";
        emptyRow.appendChild(emptyCell);
        this.el.planTableBody.appendChild(emptyRow);
      } else {
        for (const item of planItems) {
          const row = document.createElement("tr");

          // Action Cell
          const actionCell = document.createElement("td");
          const badge = document.createElement("span");
          badge.className = `action-badge action-${item.action}`;
          badge.textContent = item.action.toUpperCase();
          actionCell.appendChild(badge);
          row.appendChild(actionCell);

          // Source Cell
          const sourceCell = document.createElement("td");
          sourceCell.textContent = item.source_path;
          row.appendChild(sourceCell);

          // Target Cell
          const targetCell = document.createElement("td");
          targetCell.textContent = item.target_path || "(Kept In Place)";
          row.appendChild(targetCell);

          // Size Cell
          const sizeCell = document.createElement("td");
          sizeCell.textContent = formatBytes(item.size_bytes);
          row.appendChild(sizeCell);

          this.el.planTableBody.appendChild(row);
        }
      }
    }
  }

  /**
   * Show post-execution success view.
   * @param {string} message
   */
  showSuccess(message) {
    if (this.el.summaryView) this.el.summaryView.classList.add("hidden");
    if (this.el.successView) this.el.successView.classList.remove("hidden");
    if (this.el.successMessage) this.el.successMessage.textContent = message;
  }
}
