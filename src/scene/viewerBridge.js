/**
 * Lets UI layers (e.g. PrimaryStage) send camera commands to the live SceneManager
 * without threading React refs through Shell.
 */

/** @type {null | ((cmd: { type: string }) => void)} */
let handler = null;

/** @param {null | ((cmd: { type: string }) => void)} fn */
export function setViewerCommandHandler(fn) {
  handler = fn;
}

/** @param {{ type: string }} cmd */
export function sendViewerCommand(cmd) {
  if (handler) handler(cmd);
}
