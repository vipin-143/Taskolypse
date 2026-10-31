/**
 * Taskocalypse: Fast-Paced Folder Defense & Digital Chore Engine
 * Pure Vanilla JavaScript (No Frameworks, No External Dependencies)
 */

"use strict";

(function () {
  // Application State
  const state = {
    csrfToken: "",
    rootPath: "",
    files: [],
    currentIndex: 0,
    decisions: [],
    score: 0,
    combo: 1,
    maxCombo: 1,
    duplicatesCount: 0,
    calmMode: false,
    speedMs: 6000,
    soundEnabled: true,
    lastJournalId: null,
    
    // Timer state
    timerStart: 0,
    timerDuration: 6000,
    timerAnimFrame: null,
    isPaused: false,
  };

  // Bunker Mapping
  const BUNKERS = {
    "1": "Documents",
    "2": "Images",
    "3": "Videos",
    "4": "Code",
    "5": "Archives",
    "6": "Installers",
    "7": "Trash-Quarantine",
    "8": "Keep",
  };

  // DOM Elements
  const el = {
    srAnnouncer: document.getElementById("sr-announcer"),
    
    // Header controls
    btnSoundToggle: document.getElementById("btn-sound-toggle"),
    btnCalmToggle: document.getElementById("btn-calm-toggle"),
    btnHelp: document.getElementById("btn-help"),
    helpDialog: document.getElementById("help-dialog"),
    btnCloseHelp: document.getElementById("btn-close-help"),
    btnDismissHelp: document.getElementById("btn-dismiss-help"),
    
    // Views
    viewSetup: document.getElementById("view-setup"),
    viewGame: document.getElementById("view-game"),
    viewSummary: document.getElementById("view-summary"),
    viewSuccess: document.getElementById("view-success"),
    
    // Setup View
    scanForm: document.getElementById("scan-form"),
    folderPathInput: document.getElementById("folder-path-input"),
    btnUseDemo: document.getElementById("btn-use-demo"),
    checkRecursive: document.getElementById("check-recursive"),
    gameSpeedSelect: document.getElementById("game-speed-select"),
    scanError: document.getElementById("scan-error"),
    btnStartScan: document.getElementById("btn-start-scan"),
    
    // Game HUD
    hudRemaining: document.getElementById("hud-remaining"),
    hudScore: document.getElementById("hud-score"),
    hudCombo: document.getElementById("hud-combo"),
    hudComboTitle: document.getElementById("hud-combo-title"),
    hudDuplicates: document.getElementById("hud-duplicates"),
    
    // Arena
    timerTrack: document.getElementById("timer-progressbar"),
    timerFill: document.getElementById("timer-fill"),
    fileCard: document.getElementById("file-card"),
    fileIcon: document.getElementById("file-icon"),
    fileExtBadge: document.getElementById("file-ext-badge"),
    fileDuplicateBadge: document.getElementById("file-duplicate-badge"),
    fileName: document.getElementById("file-name"),
    fileSize: document.getElementById("file-size"),
    fileAge: document.getElementById("file-age"),
    
    // Suggestion
    suggestionConfidence: document.getElementById("suggestion-confidence"),
    suggestionBunkerName: document.getElementById("suggestion-bunker-name"),
    suggestionReason: document.getElementById("suggestion-reason"),
    btnQuickAccept: document.getElementById("btn-quick-accept"),
    
    // Bunker buttons
    bunkerButtons: document.querySelectorAll(".bunker-btn"),
    
    // Summary
    sumSorted: document.getElementById("sum-sorted"),
    sumQuarantined: document.getElementById("sum-quarantined"),
    sumSaved: document.getElementById("sum-saved"),
    sumScore: document.getElementById("sum-score"),
    planItemsTbody: document.getElementById("plan-items-tbody"),
    btnExecutePlan: document.getElementById("btn-execute-plan"),
    btnDiscardPlan: document.getElementById("btn-discard-plan"),
    execFeedback: document.getElementById("exec-feedback"),
    
    // Success / Undo
    successTitle: document.getElementById("success-title"),
    successMessage: document.getElementById("success-message"),
    btnUndoRun: document.getElementById("btn-undo-run"),
    btnPlayAgain: document.getElementById("btn-play-again"),
    undoFeedback: document.getElementById("undo-feedback"),
  };

  // ==========================================================================
  // Web Audio API Synthesizer (Zero External Assets)
  // ==========================================================================
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playTone(freq, duration, type = "sine", gainVal = 0.1) {
    if (!state.soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {
      // Audio fallback silent
    }
  }

  function playSfx(name) {
    if (!state.soundEnabled) return;
    initAudio();
    switch (name) {
      case "match":
        playTone(587.33, 0.12, "triangle", 0.15); // D5
        setTimeout(() => playTone(880.0, 0.16, "triangle", 0.12), 60); // A5
        break;
      case "combo":
        playTone(440, 0.08, "sine", 0.15);
        setTimeout(() => playTone(659.25, 0.08, "sine", 0.15), 50);
        setTimeout(() => playTone(880.0, 0.15, "sine", 0.2), 100);
        break;
      case "override":
        playTone(330, 0.1, "sine", 0.1);
        break;
      case "trash":
        playTone(180, 0.2, "sawtooth", 0.15);
        break;
      case "victory":
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          setTimeout(() => playTone(freq, 0.25, "triangle", 0.18), i * 110);
        });
        break;
      case "warning":
        playTone(220, 0.08, "square", 0.08);
        break;
    }
  }

  // ==========================================================================
  // Screen Reader Accessibility Announcer
  // ==========================================================================
  function announce(message) {
    if (el.srAnnouncer) {
      el.srAnnouncer.textContent = "";
      setTimeout(() => {
        el.srAnnouncer.textContent = message;
      }, 50);
    }
  }

  // ==========================================================================
  // Helper Formatters
  // ==========================================================================
  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatAge(epochSec) {
    const diffSec = Math.max(0, (Date.now() / 1000) - epochSec);
    const days = Math.floor(diffSec / 86400);
    if (days === 0) return "Modified today";
    if (days === 1) return "Modified yesterday";
    if (days < 30) return `Modified ${days} days ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `Modified ${months} month${months > 1 ? "s" : ""} ago`;
    const years = (days / 365).toFixed(1);
    return `Modified ${years} years ago`;
  }

  function getFileIcon(ext, isDuplicate) {
    if (isDuplicate) return "☣️";
    const e = (ext || "").toLowerCase();
    if ([".pdf", ".docx", ".doc", ".txt", ".xlsx"].includes(e)) return "📄";
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(e)) return "🖼️";
    if ([".mp4", ".mov", ".mkv", ".avi"].includes(e)) return "🎬";
    if ([".py", ".js", ".ts", ".html", ".css", ".json"].includes(e)) return "💻";
    if ([".zip", ".tar", ".gz", ".7z"].includes(e)) return "📦";
    if ([".exe", ".msi", ".dmg"].includes(e)) return "⚙️";
    return "📁";
  }

  // ==========================================================================
  // API Calls
  // ==========================================================================
  async function fetchSession() {
    try {
      const res = await fetch("/api/session");
      if (res.ok) {
        const data = await res.json();
        state.csrfToken = data.csrf_token;
      }
    } catch (_) {}
  }

  async function apiScanFolder(folderPath, includeSubfolders) {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder_path: folderPath,
        include_subfolders: includeSubfolders,
        max_files: 300,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Scan failed" }));
      throw new Error(err.detail || "Scanning failed");
    }
    return await res.json();
  }

  async function apiGeneratePlan(rootPath, decisions) {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        root_path: rootPath,
        decisions: decisions,
        csrf_token: state.csrfToken,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Plan generation failed" }));
      throw new Error(err.detail || "Plan generation failed");
    }
    return await res.json();
  }

  async function apiExecutePlan(rootPath, items) {
    const res = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        root_path: rootPath,
        items: items,
        confirmed: true,
        csrf_token: state.csrfToken,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Execution failed" }));
      throw new Error(err.detail || "Execution failed");
    }
    return await res.json();
  }

  async function apiUndoRun(rootPath, journalId) {
    const res = await fetch("/api/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        root_path: rootPath,
        journal_id: journalId,
        csrf_token: state.csrfToken,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Undo failed" }));
      throw new Error(err.detail || "Undo failed");
    }
    return await res.json();
  }

  async function apiRecordOverride(extension, chosenBunker, originalBunker) {
    try {
      await fetch("/api/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extension: extension,
          chosen_bunker: chosenBunker,
          original_bunker: originalBunker,
          csrf_token: state.csrfToken,
        }),
      });
    } catch (_) {}
  }

  // ==========================================================================
  // Views Navigation
  // ==========================================================================
  function showView(viewName) {
    [el.viewSetup, el.viewGame, el.viewSummary, el.viewSuccess].forEach((v) => {
      v.classList.add("hidden");
    });
    if (viewName === "setup") el.viewSetup.classList.remove("hidden");
    if (viewName === "game") el.viewGame.classList.remove("hidden");
    if (viewName === "summary") el.viewSummary.classList.remove("hidden");
    if (viewName === "success") el.viewSuccess.classList.remove("hidden");
  }

  // ==========================================================================
  // Game Loop & Card Presentation
  // ==========================================================================
  function startDefense(scanResponse) {
    state.rootPath = scanResponse.root_path;
    state.files = scanResponse.files;
    state.csrfToken = scanResponse.csrf_token;
    state.currentIndex = 0;
    state.decisions = [];
    state.score = 0;
    state.combo = 1;
    state.maxCombo = 1;
    state.duplicatesCount = scanResponse.duplicate_count;

    if (state.files.length === 0) {
      alert("No files found to organize in the chosen folder!");
      return;
    }

    showView("game");
    updateHud();
    presentCurrentCard();
  }

  function updateHud() {
    el.hudRemaining.textContent = `${state.files.length - state.currentIndex} / ${state.files.length}`;
    el.hudScore.textContent = state.score.toLocaleString();
    el.hudCombo.textContent = `x${state.combo}`;
    el.hudDuplicates.textContent = state.duplicatesCount;

    // Combo title
    if (state.combo >= 8) el.hudComboTitle.textContent = "RAMPAGE!";
    else if (state.combo >= 5) el.hudComboTitle.textContent = "ON FIRE!";
    else if (state.combo >= 3) el.hudComboTitle.textContent = "STREAK!";
    else el.hudComboTitle.textContent = "READY";
  }

  function presentCurrentCard() {
    if (state.currentIndex >= state.files.length) {
      endRun();
      return;
    }

    const current = state.files[state.currentIndex];
    const file = current.file;
    const suggestion = current.suggestion;

    // Render safely using textContent
    el.fileName.textContent = file.name;
    el.fileName.title = file.relative_path;
    el.fileIcon.textContent = getFileIcon(file.extension, file.is_duplicate);
    el.fileExtBadge.textContent = file.extension ? file.extension.toUpperCase() : "FILE";

    if (file.is_duplicate) {
      el.fileDuplicateBadge.classList.remove("hidden");
    } else {
      el.fileDuplicateBadge.classList.add("hidden");
    }

    el.fileSize.textContent = formatBytes(file.size_bytes);
    el.fileAge.textContent = formatAge(file.mtime);

    // Suggestion banner
    const confPct = Math.round(suggestion.confidence * 100);
    el.suggestionConfidence.textContent = `${confPct}% Match`;
    el.suggestionBunkerName.textContent = `Suggested: ${suggestion.bunker}`;
    el.suggestionReason.textContent = suggestion.reason;

    // Highlight suggested bunker button
    el.bunkerButtons.forEach((btn) => {
      btn.classList.remove("suggested-pulse");
      if (btn.getAttribute("data-bunker") === suggestion.bunker) {
        btn.classList.add("suggested-pulse");
      }
    });

    // Screen reader announcement
    announce(
      `File ${state.currentIndex + 1} of ${state.files.length}: ${file.name}, ${formatBytes(file.size_bytes)}. ` +
      `Suggested bunker: ${suggestion.bunker}. Reason: ${suggestion.reason}`
    );

    // Reset and start countdown timer
    resetCountdown();
  }

  function resetCountdown() {
    if (state.timerAnimFrame) {
      cancelAnimationFrame(state.timerAnimFrame);
      state.timerAnimFrame = null;
    }

    if (state.calmMode) {
      el.timerFill.style.width = "100%";
      el.timerFill.classList.remove("timer-warning");
      el.timerTrack.setAttribute("aria-valuenow", "100");
      return;
    }

    state.timerDuration = state.speedMs;
    state.timerStart = performance.now();

    function stepTimer(now) {
      const elapsed = now - state.timerStart;
      const remainingPct = Math.max(0, 1 - (elapsed / state.timerDuration));

      el.timerFill.style.width = `${remainingPct * 100}%`;
      el.timerTrack.setAttribute("aria-valuenow", Math.round(remainingPct * 100).toString());

      if (remainingPct < 0.25) {
        el.timerFill.classList.add("timer-warning");
      } else {
        el.timerFill.classList.remove("timer-warning");
      }

      if (remainingPct <= 0) {
        // Time expired: auto-assign suggestion to keep pace
        handleCardDecision(state.files[state.currentIndex].suggestion.bunker, false, true);
        return;
      }

      state.timerAnimFrame = requestAnimationFrame(stepTimer);
    }

    state.timerAnimFrame = requestAnimationFrame(stepTimer);
  }

  function handleCardDecision(chosenBunker, isOverrideExplicit = false, isTimeout = false) {
    if (state.timerAnimFrame) {
      cancelAnimationFrame(state.timerAnimFrame);
      state.timerAnimFrame = null;
    }

    const current = state.files[state.currentIndex];
    const suggestion = current.suggestion;
    const isMatch = (chosenBunker === suggestion.bunker);

    // Score calculation
    let basePoints = 100;
    if (isMatch) {
      state.combo += 1;
      if (state.combo > state.maxCombo) state.maxCombo = state.combo;
      state.score += basePoints * state.combo;
      playSfx(state.combo % 3 === 0 ? "combo" : "match");
    } else {
      // Overrode suggestion
      state.combo = 1;
      state.score += basePoints;
      playSfx("override");
      // Record override feedback asynchronously to adapt heuristics
      apiRecordOverride(current.file.extension, chosenBunker, suggestion.bunker);
    }

    if (chosenBunker === "Trash-Quarantine") {
      playSfx("trash");
    }

    // Record decision
    state.decisions.push({
      relative_path: current.file.relative_path,
      bunker: chosenBunker,
      override: !isMatch,
    });

    state.currentIndex += 1;
    updateHud();

    // Visual card transition
    el.fileCard.style.transform = "scale(0.96)";
    setTimeout(() => {
      el.fileCard.style.transform = "none";
      presentCurrentCard();
    }, 90);
  }

  // ==========================================================================
  // Summary & Dry-Run Plan
  // ==========================================================================
  async function endRun() {
    playSfx("victory");
    showView("summary");

    announce("Defense run complete! Generating dry-run action preview.");
    el.btnExecutePlan.disabled = true;
    el.btnExecutePlan.textContent = "Generating Plan...";

    try {
      const plan = await apiGeneratePlan(state.rootPath, state.decisions);
      populateSummaryView(plan);
    } catch (err) {
      el.execFeedback.textContent = `Error building plan: ${err.message}`;
      el.execFeedback.classList.remove("hidden");
      el.execFeedback.classList.add("alert-error");
    } finally {
      el.btnExecutePlan.disabled = false;
      el.btnExecutePlan.innerHTML = '<span aria-hidden="true">⚡</span> Execute Plan on Disk';
    }
  }

  function populateSummaryView(plan) {
    el.sumSorted.textContent = plan.items.length.toString();
    el.sumQuarantined.textContent = plan.total_quarantined.toString();
    el.sumSaved.textContent = formatBytes(plan.bytes_saved);
    el.sumScore.textContent = state.score.toLocaleString();

    // Clear and safely populate plan items table using textContent
    el.planItemsTbody.innerHTML = "";
    plan.items.forEach((item) => {
      const tr = document.createElement("tr");

      // Action cell
      const tdAction = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `action-badge action-${item.action}`;
      badge.textContent = item.action;
      tdAction.appendChild(badge);

      // Source cell
      const tdSource = document.createElement("td");
      tdSource.textContent = item.source_path;

      // Target cell
      const tdTarget = document.createElement("td");
      tdTarget.textContent = item.target_path || "(Stay in place)";

      // Size cell
      const tdSize = document.createElement("td");
      tdSize.textContent = formatBytes(item.size_bytes);

      tr.appendChild(tdAction);
      tr.appendChild(tdSource);
      tr.appendChild(tdTarget);
      tr.appendChild(tdSize);
      el.planItemsTbody.appendChild(tr);
    });

    state.currentPlan = plan;
  }

  async function executeActionPlan() {
    if (!state.currentPlan) return;

    el.btnExecutePlan.disabled = true;
    el.btnExecutePlan.textContent = "Applying Changes to Disk...";
    el.execFeedback.classList.add("hidden");

    try {
      const result = await apiExecutePlan(state.rootPath, state.currentPlan.items);
      if (result.success) {
        state.lastJournalId = result.journal_id;
        showView("success");
        el.successMessage.textContent = result.message;
        announce(`Disk organization executed successfully! ${result.message}`);
      } else {
        el.execFeedback.textContent = `Execution warning: ${result.message}`;
        el.execFeedback.className = "alert alert-error";
        el.execFeedback.classList.remove("hidden");
      }
    } catch (err) {
      el.execFeedback.textContent = `Execution error: ${err.message}`;
      el.execFeedback.className = "alert alert-error";
      el.execFeedback.classList.remove("hidden");
    } finally {
      el.btnExecutePlan.disabled = false;
      el.btnExecutePlan.innerHTML = '<span aria-hidden="true">⚡</span> Execute Plan on Disk';
    }
  }

  async function handleUndo() {
    if (!state.lastJournalId) return;

    el.btnUndoRun.disabled = true;
    el.btnUndoRun.textContent = "Restoring Files...";
    el.undoFeedback.classList.add("hidden");

    try {
      const result = await apiUndoRun(state.rootPath, state.lastJournalId);
      el.undoFeedback.textContent = result.message;
      el.undoFeedback.className = result.success ? "alert alert-success" : "alert alert-error";
      el.undoFeedback.classList.remove("hidden");
      if (result.success) {
        el.btnUndoRun.classList.add("hidden");
        announce(result.message);
      }
    } catch (err) {
      el.undoFeedback.textContent = `Undo failed: ${err.message}`;
      el.undoFeedback.className = "alert alert-error";
      el.undoFeedback.classList.remove("hidden");
    } finally {
      el.btnUndoRun.disabled = false;
      el.btnUndoRun.innerHTML = '<span aria-hidden="true">↩️</span> Undo This Run (Press Z)';
    }
  }

  // ==========================================================================
  // Event Listeners & Keyboard Controls
  // ==========================================================================
  function setupEventListeners() {
    // Session token initialization
    fetchSession();

    // Use Demo Folder Button
    el.btnUseDemo.addEventListener("click", () => {
      // Set to demo_folder in root
      el.folderPathInput.value = "demo_folder";
      el.folderPathInput.focus();
    });

    // Scan Form Submission
    el.scanForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      initAudio();
      el.scanError.classList.add("hidden");
      el.btnStartScan.disabled = true;
      el.btnStartScan.textContent = "Scanning...";

      const folderPath = el.folderPathInput.value.trim();
      const includeSubfolders = el.checkRecursive.checked;
      const speedVal = el.gameSpeedSelect.value;

      if (speedVal === "calm") {
        state.calmMode = true;
      } else {
        state.calmMode = false;
        state.speedMs = parseInt(speedVal, 10);
      }

      try {
        const scanRes = await apiScanFolder(folderPath, includeSubfolders);
        startDefense(scanRes);
      } catch (err) {
        el.scanError.textContent = err.message;
        el.scanError.classList.remove("hidden");
      } finally {
        el.btnStartScan.disabled = false;
        el.btnStartScan.innerHTML = '<span aria-hidden="true">🚀</span> Scan & Start Defense';
      }
    });

    // Accept Suggestion Button
    el.btnQuickAccept.addEventListener("click", () => {
      if (state.files[state.currentIndex]) {
        handleCardDecision(state.files[state.currentIndex].suggestion.bunker, false);
      }
    });

    // Bunker Lane Buttons (Click / Tap)
    el.bunkerButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const bunker = btn.getAttribute("data-bunker");
        handleCardDecision(bunker, true);
      });
    });

    // Sound toggle
    el.btnSoundToggle.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      el.btnSoundToggle.setAttribute("aria-pressed", state.soundEnabled.toString());
      el.btnSoundToggle.querySelector(".btn-label").textContent = `Sound: ${state.soundEnabled ? "ON" : "OFF"}`;
      el.btnSoundToggle.querySelector(".btn-icon-symbol").textContent = state.soundEnabled ? "🔊" : "🔇";
      if (state.soundEnabled) playSfx("match");
    });

    // Calm mode toggle
    el.btnCalmToggle.addEventListener("click", () => {
      state.calmMode = !state.calmMode;
      el.btnCalmToggle.setAttribute("aria-pressed", state.calmMode.toString());
      el.btnCalmToggle.querySelector(".btn-label").textContent = `Calm Mode: ${state.calmMode ? "ON" : "OFF"}`;
      resetCountdown();
    });

    // Help Dialog
    el.btnHelp.addEventListener("click", () => el.helpDialog.showModal());
    el.btnCloseHelp.addEventListener("click", () => el.helpDialog.close());
    el.btnDismissHelp.addEventListener("click", () => el.helpDialog.close());

    // Execute plan
    el.btnExecutePlan.addEventListener("click", executeActionPlan);

    // Discard plan
    el.btnDiscardPlan.addEventListener("click", () => {
      if (confirm("Discard queued actions? No files on disk will be changed.")) {
        showView("setup");
      }
    });

    // Undo button
    el.btnUndoRun.addEventListener("click", handleUndo);

    // Play again
    el.btnPlayAgain.addEventListener("click", () => {
      showView("setup");
      el.btnUndoRun.classList.remove("hidden");
      el.undoFeedback.classList.add("hidden");
    });

    // Global Keyboard Navigation
    window.addEventListener("keydown", (e) => {
      // Don't intercept when user is typing inside text input
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") {
        return;
      }

      // Help toggle
      if (e.key === "?") {
        e.preventDefault();
        if (el.helpDialog.open) el.helpDialog.close();
        else el.helpDialog.showModal();
        return;
      }

      // Calm mode toggle
      if (e.key.toLowerCase() === "c" && !el.helpDialog.open) {
        el.btnCalmToggle.click();
        return;
      }

      // Sound toggle
      if (e.key.toLowerCase() === "m" && !el.helpDialog.open) {
        el.btnSoundToggle.click();
        return;
      }

      // Undo hotkey
      if (e.key.toLowerCase() === "z" && !el.helpDialog.open) {
        if (!el.viewSuccess.classList.contains("hidden") && !el.btnUndoRun.classList.contains("hidden")) {
          e.preventDefault();
          handleUndo();
          return;
        }
      }

      // During active gameplay
      if (!el.viewGame.classList.contains("hidden") && !el.helpDialog.open) {
        // Quick Accept: Space or Enter
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (state.files[state.currentIndex]) {
            handleCardDecision(state.files[state.currentIndex].suggestion.bunker, false);
          }
          return;
        }

        // Bunker number hotkeys: 1 - 8
        if (BUNKERS[e.key]) {
          e.preventDefault();
          handleCardDecision(BUNKERS[e.key], true);
          return;
        }
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupEventListeners);
  } else {
    setupEventListeners();
  }
})();
