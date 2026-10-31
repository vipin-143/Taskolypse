// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import { BUNKERS } from "../../static/js/engine/constants.js";
import { buildBackendPlanPayload, extractOverridesForTraining } from "../../static/js/engine/planBuilder.js";

test("PlanBuilder: Compiles standard decisions correctly", () => {
  const decisions = [
    {
      relativePath: "taxes.pdf",
      chosenBunker: BUNKERS.DOCUMENTS,
      override: false,
      originalSuggestion: BUNKERS.DOCUMENTS,
      sizeBytes: 1000,
      extension: ".pdf",
      isCluster: false,
    },
    {
      relativePath: "script.py",
      chosenBunker: BUNKERS.CODE,
      override: true,
      originalSuggestion: BUNKERS.DOCUMENTS,
      sizeBytes: 500,
      extension: ".py",
      isCluster: false,
    },
  ];

  const payload = buildBackendPlanPayload(decisions, "C:/target", "csrf_123");
  assert.equal(payload.root_path, "C:/target");
  assert.equal(payload.csrf_token, "csrf_123");
  assert.equal(payload.decisions.length, 2);
  assert.equal(payload.decisions[0].relative_path, "taxes.pdf");
  assert.equal(payload.decisions[0].bunker, BUNKERS.DOCUMENTS);
  assert.equal(payload.decisions[1].relative_path, "script.py");
  assert.equal(payload.decisions[1].bunker, BUNKERS.CODE);
  assert.equal(payload.decisions[1].override, true);
});

test("PlanBuilder: SAFETY - Skipped/unrouted files are never included in plan", () => {
  // If an enemy reaches the wall unrouted, it is never added to state.decisions.
  // We verify here that empty decisions produce an empty decision list.
  const decisions = [];
  const payload = buildBackendPlanPayload(decisions, "D:/folder", "token");
  assert.equal(payload.decisions.length, 0);
});

test("PlanBuilder: Duplicate Hydra cluster routing", () => {
  const decisions = [
    {
      relativePath: "invoice.pdf",
      chosenBunker: BUNKERS.TRASH,
      override: false,
      originalSuggestion: BUNKERS.TRASH,
      sizeBytes: 200,
      extension: ".pdf",
      isCluster: true,
      clusterFilePaths: ["invoice.pdf", "invoice (1).pdf", "invoice_copy.pdf"],
    },
  ];

  const payload = buildBackendPlanPayload(decisions, "D:/sandbox", "token");
  // All 3 files in the cluster must be queued for routing to Trash!
  assert.equal(payload.decisions.length, 3);
  const paths = payload.decisions.map((d) => d.relative_path);
  assert.deepEqual(paths, ["invoice.pdf", "invoice (1).pdf", "invoice_copy.pdf"]);
});

test("PlanBuilder: Extract player overrides for ML/heuristic training", () => {
  const decisions = [
    {
      relativePath: "data.log",
      chosenBunker: BUNKERS.CODE,
      override: true,
      originalSuggestion: BUNKERS.DOCUMENTS,
      sizeBytes: 300,
      extension: ".log",
      isCluster: false,
    },
    {
      relativePath: "photo.jpg",
      chosenBunker: BUNKERS.IMAGES,
      override: false,
      originalSuggestion: BUNKERS.IMAGES,
      sizeBytes: 1500,
      extension: ".jpg",
      isCluster: false,
    },
  ];

  const overrides = extractOverridesForTraining(decisions, "token_99");
  assert.equal(overrides.length, 1);
  assert.equal(overrides[0].extension, ".log");
  assert.equal(overrides[0].chosen_bunker, BUNKERS.CODE);
  assert.equal(overrides[0].original_bunker, BUNKERS.DOCUMENTS);
  assert.equal(overrides[0].csrf_token, "token_99");
});
