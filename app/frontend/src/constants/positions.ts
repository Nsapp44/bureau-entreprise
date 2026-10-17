/**
 * Position constants for office elements.
 *
 * All positions are in pixels relative to the canvas origin (top-left).
 */

// ============================================================================
// WALL DECORATIONS
// ============================================================================

/** Employee of the Month frame position */
export const EMPLOYEE_OF_MONTH_POSITION = { x: 184, y: 50 };

/** Wall logo (center of the logo; text is drawn below). Free wall gap between whiteboard (ends x~971) and safety sign (x1120), above the water cooler */
export const WALL_LOGO_POSITION = { x: 1045, y: 55 };

/** City window position */
export const CITY_WINDOW_POSITION = { x: 319, y: 30 };

/** Safety sign position */

/** Wall clock position */
export const WALL_CLOCK_POSITION = { x: 581, y: 80 };

/** Wall outlet position (below clock) */
export const WALL_OUTLET_POSITION = { x: 581, y: 209 };

/** Whiteboard position */
export const WHITEBOARD_POSITION = { x: 641, y: 11 };

/** Water cooler position */
export const WATER_COOLER_POSITION = { x: 1010, y: 200 };

/** Coffee machine position (to the right of water cooler) */
export const COFFEE_MACHINE_POSITION = { x: 1081, y: 191 };

// ============================================================================
// FLOOR ELEMENTS
// ============================================================================

/**
 * Decor in the space freed by the 8-desk room (row 3 and the side strips).
 * Positions are top-left corners; sizes match the drawn components.
 */
export const PRINT_LAB_POSITION = { x: 300, y: 672 }; // 4 printers, 240 x 104
export const LOUNGE_POSITION = { x: 770, y: 690 }; // 220 x 110
/** Two filament racks in the bottom-left corner (drawn at 0.85 scale: 71 x 128 each). */
export const FILAMENT_RACK_POSITIONS = [
  { x: 10, y: 890 },
  { x: 84, y: 890 },
];
export const ARCADE_POSITION = { x: 1092, y: 330 }; // 40 x 76
/** Cat tree (bottom-right corner, drawn at CAT_TREE_SCALE: 114 x 192) and the two bowls on the floor to its left. */
export const CAT_TREE_SCALE = 1.5;
export const CAT_TREE_POSITION = { x: 1160, y: 822 };
export const CAT_WATER_BOWL_POSITION = { x: 920, y: 1000 };
export const CAT_FOOD_BOWL_POSITION = { x: 984, y: 1000 };
/** Feet position of a sleeping cat in each niche (world coordinates). */
export const CAT_SLEEP_SPOTS = [
  {
    x: CAT_TREE_POSITION.x + 18 * CAT_TREE_SCALE,
    y: CAT_TREE_POSITION.y + 70 * CAT_TREE_SCALE,
  },
  {
    x: CAT_TREE_POSITION.x + 58 * CAT_TREE_SCALE,
    y: CAT_TREE_POSITION.y + 104 * CAT_TREE_SCALE,
  },
];
/** Floor tiles (centres) where a cat stands to drink / eat, and the tree foot. */
export const CAT_WATER_STAND = { x: 892, y: 996 };
export const CAT_FOOD_STAND = { x: 956, y: 996 };
/** Cat nap on the lounge sofa: seat (feet) and the floor tile in front of it. */
export const CAT_SOFA_SPOT = {
  x: LOUNGE_POSITION.x + 85,
  y: LOUNGE_POSITION.y + 36,
};
export const CAT_SOFA_STAND = {
  x: LOUNGE_POSITION.x + 85,
  y: LOUNGE_POSITION.y + 106,
};
export const CAT_TREE_BASE = { x: 1104, y: 996 };
/** Where the cats chase each other when they play. */
export const CAT_PLAY_CENTER = { x: 990, y: 940 };
export const PLANT_POSITIONS = [
  { x: 190, y: 760 },
  { x: 1110, y: 600 },
  { x: 1110, y: 790 },
];

/** Floor areas agents must walk around (x1, y1, x2, y2). */
export const DECOR_OBSTACLES: ReadonlyArray<
  readonly [number, number, number, number]
> = [
  [300, 682, 540, 776],
  [770, 690, 990, 800],
  [10, 890, 156, 1018], // filament racks
  [1092, 330, 1132, 406],
  [1156, 818, 1280, 1018], // cat tree
];

// ============================================================================
// BOSS AREA
// ============================================================================

/** Boss area rug position (centered under boss desk) */
export const BOSS_RUG_POSITION = { x: 640, y: 940 };

/** Trash can offset from boss desk position */
export const TRASH_CAN_OFFSET = { x: 110, y: 65 };

// ============================================================================
// DESK GRID
// ============================================================================

/**
 * Desk grid shape â€” keep in sync with backend `state_machine.py`
 * `StateMachine.DESKS_PER_ROW` / `StateMachine.MIN_DESK_COUNT`.
 * A shared cross-component source is intentionally out of scope; update both
 * sides together when changing the desk grid.
 */
export const DESKS_PER_ROW = 4;
export const MIN_DESK_COUNT = 8;

/** Number of desk rows (MIN_DESK_COUNT / DESKS_PER_ROW). All desks are always drawn. */
export const DESK_ROW_COUNT = 2;

/**
 * Desk geometry â€” single source of truth for DeskGrid rendering, agent seat
 * positions and navigation-grid obstacles.
 *
 * Origins are the desk container position (desk sprite drawn below it).
 * 4 columns centred on x=640, kept clear of the queue lanes at x=70 / x=1210;
 * 2 rows kept between the wall (yâ‰ˆ247) and the boss slots (y=868).
 */
export const DESK_ORIGIN_X_START = 340;
export const DESK_SPACING_X = 200;
export const DESK_ORIGIN_Y_START = 344;
export const DESK_SPACING_Y = 168;
/** Décalage horizontal de chaque demi-grille par rapport à l'axe x=640. */
export const DESK_AISLE_SHIFT = 16;

/**
 * Vue globale (Bureau général) : 4 colonnes compactes dans la moitié gauche
 * (zone ouverte x < 680, colonne des pièces d'atelier à droite). Centres des colonnes.
 */
export const CONV_DESK_COLS_X = [225, 428, 625, 817];
/** Vue globale : y de la 1re rangée (sous le mur de 188 px) et pas entre rangées. */
export const CONV_DESK_ORIGIN_Y_START = 400;
export const CONV_DESK_SPACING_Y = 240;

/** Desk container origin (vue globale) for a 1-based desk number. */
export function getConvDeskOrigin(deskNum: number): { x: number; y: number } {
  const index = deskNum - 1;
  return {
    x: CONV_DESK_COLS_X[index % DESKS_PER_ROW],
    y:
      CONV_DESK_ORIGIN_Y_START +
      Math.floor(index / DESKS_PER_ROW) * CONV_DESK_SPACING_Y,
  };
}

/** Agent bottom-circle centre relative to the desk origin (seated on the chair). */
export const DESK_SEAT_OFFSET_Y = 24;

/** Desk container origin for a 1-based desk number. */
export function getDeskOrigin(deskNum: number): { x: number; y: number } {
  const index = deskNum - 1;
  const row = Math.floor(index / DESKS_PER_ROW);
  const col = index % DESKS_PER_ROW;
  // Allée centrale élargie : colonnes de gauche −16, colonnes de droite +16.
  const aisleShift =
    col < DESKS_PER_ROW / 2 ? -DESK_AISLE_SHIFT : DESK_AISLE_SHIFT;
  return {
    x: DESK_ORIGIN_X_START + col * DESK_SPACING_X + aisleShift,
    y: DESK_ORIGIN_Y_START + row * DESK_SPACING_Y,
  };
}
