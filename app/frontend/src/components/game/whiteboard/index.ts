/**
 * Whiteboard sub-components barrel export.
 *
 * Exports all 3 display mode components and the mode registry so that
 * Whiteboard.tsx can import everything from a single path.
 */

export { ConsoMode } from "./ConsoMode";

export { StarMode } from "./StarMode";
export type { StarModeProps } from "./StarMode";

export { TodoListMode } from "./TodoListMode";
export type { TodoListModeProps } from "./TodoListMode";

export {
  MODE_INFO,
  WHITEBOARD_MODE_COUNT,
  getNextMode,
  getModeInfo,
} from "./WhiteboardModeRegistry";
export type { ModeInfo } from "./WhiteboardModeRegistry";
