/**
 * The ONE place in Braillix where a cell count appears as a literal.
 *
 * CLAUDE.md Law 1 says the cell count is discovered, never known. But with nothing plugged in
 * there is nothing to discover, so the simulator needs a starting value. Rather than let that
 * value leak into fifty files as `4`, it lives here once, named, and is enforced by
 * `src/invariants.test.ts` — which fails the build if any other file writes a cell count literal.
 *
 * It is ONE because one working muscle cell is what will physically exist on 22 August, and
 * because a single cell is exactly the case the Reader exists to make readable. Starting the
 * app at the hardest setting is the honest default.
 */
export const DEFAULT_SIMULATED_CELLS = 1;

/** Bounds for the simulator's cell-count control. Not a claim about hardware — just UI range. */
export const SIMULATOR_MIN_CELLS = 1;
export const SIMULATOR_MAX_CELLS = 40;

/** Where the on-device recognition model is served from once `npm run fetch:model` has run. */
export const LOCAL_MODEL_PATH = 'models/';

/** Where postinstall copied the ONNX Runtime wasm files. */
export const ORT_WASM_PATH = 'ort/';

export const APP_NAME = 'Braillix';
