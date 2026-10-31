// @ts-check
/**
 * Taskocalypse: Bunker Defense - Backend API Client
 * Wraps REST endpoints, manages CSRF token lifecycle, handles errors gracefully.
 */

export class ApiClient {
  constructor() {
    this.csrfToken = "";
  }

  /**
   * Set or update active CSRF token.
   * @param {string} token
   */
  setToken(token) {
    this.csrfToken = token;
  }

  /**
   * Fetch initial session and anti-forgery token.
   * @returns {Promise<{ csrf_token: string }>}
   */
  async getSession() {
    const res = await fetch("/api/session", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Failed to obtain session token: HTTP ${res.status}`);
    }
    const data = await res.json();
    this.setToken(data.csrf_token);
    return data;
  }

  /**
   * Scan folder and retrieve classified files.
   * @param {string} folderPath
   * @param {boolean} [includeSubfolders=false]
   * @param {number} [maxFiles=500]
   * @returns {Promise<import("../engine/spawner.js").ClassifiedFile[]>}
   */
  async scanFolder(folderPath, includeSubfolders = false, maxFiles = 500) {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        folder_path: folderPath,
        include_subfolders: includeSubfolders,
        max_files: maxFiles,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || "Scanning failed.");
    }

    const data = await res.json();
    if (data.csrf_token) {
      this.setToken(data.csrf_token);
    }
    return data;
  }

  /**
   * Compile dry-run action plan on backend.
   * @param {string} rootPath
   * @param {import("../engine/planBuilder.js").BackendDecisionItem[]} decisions
   */
  async buildPlan(rootPath, decisions) {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": this.csrfToken,
      },
      body: JSON.stringify({
        root_path: rootPath,
        decisions,
        csrf_token: this.csrfToken,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || "Plan building failed.");
    }
    return res.json();
  }

  /**
   * Execute approved action plan on disk.
   * @param {string} rootPath
   * @param {any[]} items
   */
  async executePlan(rootPath, items) {
    const res = await fetch("/api/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": this.csrfToken,
      },
      body: JSON.stringify({
        root_path: rootPath,
        items,
        confirmed: true,
        csrf_token: this.csrfToken,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || "Plan execution failed.");
    }
    return res.json();
  }

  /**
   * Undo a previous execution run.
   * @param {string} rootPath
   * @param {string} journalId
   */
  async undoRun(rootPath, journalId) {
    const res = await fetch("/api/undo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": this.csrfToken,
      },
      body: JSON.stringify({
        root_path: rootPath,
        journal_id: journalId,
        csrf_token: this.csrfToken,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || "Undo failed.");
    }
    return res.json();
  }

  /**
   * Report an override event to adapt heuristics.
   * @param {string} extension
   * @param {string} chosenBunker
   * @param {string} originalBunker
   */
  async recordOverride(extension, chosenBunker, originalBunker) {
    try {
      await fetch("/api/override", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.csrfToken,
        },
        body: JSON.stringify({
          extension,
          chosen_bunker: chosenBunker,
          original_bunker: originalBunker,
          csrf_token: this.csrfToken,
        }),
      });
    } catch {
      // Non-critical background event
    }
  }
}
