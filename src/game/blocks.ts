// Emberfall block registry + procedural texture atlas (all textures generated at boot).
import { mulberry } from "./noise";

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7,
  PINE_LOG: 8, PINE_LEAVES: 9, BIRCH_LOG: 10, BIRCH_LEAVES: 11, PLANKS: 12,
  COBBLE: 13, BEDROCK: 14, COAL_ORE: 15, IRON_ORE: 16, GOLD_ORE: 17, EMBER_ORE: 18,
  TORCH: 19, TABLE: 20, FURNACE: 21, CHEST: 22, BED_FOOT: 23, BED_HEAD: 24,
  SNOW_GRASS: 25, SNOW: 26, GRAVEL: 27, CLAY: 28, BRICK: 29, THATCH: 30, FENCE: 31,
  DOOR_B: 32, DOOR_T: 33, DOOR_B_OPEN: 34, DOOR_T_OPEN: 35, TALLGRASS: 36,
  FLOWER_R: 37, FLOWER_Y: 38, MUSHROOM: 39, REED: 40, DEADBUSH: 41, GLOWSHROOM: 42,
  MOSSY: 43, EMBERSTONE: 44, PORTAL: 45, BARREL: 46, HAY: 47, WOOL: 48, EMBERFLUID: 49,
  LANTERN: 50, BOARD: 51, DARK_LOG: 52, DARK_LEAVES: 53, BOOKS: 54, WELL: 55, GRAVE: 56,
};

export interface BlockDef {
  id: number; name: string; tex: number[]; // [top, side, bottom] or [cross]
  solid: boolean; opaque: boolean; fluid?: boolean; cross?: boolean; gravity?: boolean;
  hard: number; tool: number; // 0 none,1 pick,2 axe,3 shovel
  tier: number; // required tool tier
  drop?: number | null | { id: number; n: number };
  light: number; sound: string; color: string;
  interact?: "chest" | "furnace" | "table" | "bed" | "door" | "portal" | "board" | "barrel";
  unbreak?: boolean;
}

export const T = {
  grass_top: 0, dirt: 1, grass_side: 2, stone: 3, sand: 4, water: 5, log: 6, log_top: 7,
  leaves: 8, pine_log: 9, pine_leaves: 10, birch_log: 11, birch_leaves: 12, planks: 13,
  cobble: 14, bedrock: 15, coal: 16, iron: 17, gold: 18, ember: 19, torch: 20, table_top: 21,
  table_side: 22, furnace_front: 23, furnace_side: 24, chest_front: 25, chest_side: 26,
  bed_foot: 27, bed_head: 28, snow_side: 29, snow_top: 30, gravel: 31, clay: 32, brick: 33,
  thatch: 34, fence: 35, door_b: 36, door_t: 37, door_open: 38, tallgrass: 39, flower_r: 40,
  flower_y: 41, mushroom: 42, reed: 43, deadbush: 44, glowshroom: 45, mossy: 46,
  emberstone: 47, portal: 48, barrel_side: 49, barrel_top: 50, hay_side: 51, hay_top: 52,
  wool: 53, emberfluid: 54, lantern: 55, board: 56, dark_log: 57, dark_leaves: 58, books: 59,
  well: 60, grave: 61,
};

const def = (d: Partial<BlockDef> & { id: number; name: string; tex: number[] }): BlockDef => ({
  solid: true, opaque: true, hard: 1, tool: 0, tier: 0, light: 0, sound: "stone",
  color: "#888888", drop: undefined, ...d,
});

export const BLOCKS: BlockDef[] = [];
const reg = (d: BlockDef) => { BLOCKS[d.id] = d; };

reg(def({ id: B.AIR, name: "Air", tex: [0], solid: false, opaque: false, hard: 0 }));
reg(def({ id: B.GRASS, name: "Turf", tex: [T.grass_top, T.grass_side, T.dirt], hard: 0.6, tool: 3, sound: "grass", color: "#55673a", drop: B.DIRT }));
reg(def({ id: B.DIRT, name: "Earth", tex: [T.dirt], hard: 0.5, tool: 3, sound: "grass", color: "#6b4f33" }));
reg(def({ id: B.STONE, name: "Stone", tex: [T.stone], hard: 1.6, tool: 1, tier: 1, color: "#7d7d7a", drop: B.COBBLE }));
reg(def({ id: B.SAND, name: "Sand", tex: [T.sand], hard: 0.5, tool: 3, sound: "sand", color: "#c9b183", gravity: true }));
reg(def({ id: B.WATER, name: "Water", tex: [T.water], solid: false, opaque: false, fluid: true, hard: 0, unbreak: true, sound: "water", color: "#2b5a75" }));
reg(def({ id: B.LOG, name: "Oak Log", tex: [T.log_top, T.log, T.log_top], hard: 1.4, tool: 2, sound: "wood", color: "#6a4f2e" }));
reg(def({ id: B.LEAVES, name: "Oak Leaves", tex: [T.leaves], hard: 0.25, tool: 0, sound: "grass", color: "#3f5a2c", drop: null }));
reg(def({ id: B.PINE_LOG, name: "Pine Log", tex: [T.log_top, T.pine_log, T.log_top], hard: 1.4, tool: 2, sound: "wood", color: "#5a4430" }));
reg(def({ id: B.PINE_LEAVES, name: "Pine Boughs", tex: [T.pine_leaves], hard: 0.25, sound: "grass", color: "#2f4a33", drop: null }));
reg(def({ id: B.BIRCH_LOG, name: "Birch Log", tex: [T.log_top, T.birch_log, T.log_top], hard: 1.3, tool: 2, sound: "wood", color: "#cfc9b8" }));
reg(def({ id: B.BIRCH_LEAVES, name: "Birch Leaves", tex: [T.birch_leaves], hard: 0.25, sound: "grass", color: "#6b8a3f", drop: null }));
reg(def({ id: B.PLANKS, name: "Planks", tex: [T.planks], hard: 1.2, tool: 2, sound: "wood", color: "#8a6a42" }));
reg(def({ id: B.COBBLE, name: "Cobblestone", tex: [T.cobble], hard: 1.8, tool: 1, tier: 1, color: "#6f6f6c" }));
reg(def({ id: B.BEDROCK, name: "Bedrock", tex: [T.bedrock], hard: 999, unbreak: true, color: "#2a2a2a" }));
reg(def({ id: B.COAL_ORE, name: "Coal Seam", tex: [T.coal], hard: 2.0, tool: 1, tier: 1, color: "#555555", drop: { id: 257, n: 1 } }));
reg(def({ id: B.IRON_ORE, name: "Iron Ore", tex: [T.iron], hard: 2.4, tool: 1, tier: 2, color: "#8d7358" }));
reg(def({ id: B.GOLD_ORE, name: "Gold Ore", tex: [T.gold], hard: 2.6, tool: 1, tier: 3, color: "#b09a4e" }));
reg(def({ id: B.EMBER_ORE, name: "Ember Ore", tex: [T.ember], hard: 3.0, tool: 1, tier: 3, color: "#a34d1e", drop: { id: 260, n: 1 }, light: 4 }));
reg(def({ id: B.TORCH, name: "Torch", tex: [T.torch], solid: false, opaque: false, cross: true, hard: 0.05, sound: "wood", color: "#e0a33c", light: 13 }));
reg(def({ id: B.TABLE, name: "Workbench", tex: [T.table_top, T.table_side, T.planks], hard: 1.4, tool: 2, sound: "wood", color: "#8a6a42", interact: "table" }));
reg(def({ id: B.FURNACE, name: "Furnace", tex: [T.furnace_side, T.furnace_front, T.furnace_side], hard: 2.0, tool: 1, tier: 1, color: "#6f6f6c", interact: "furnace", light: 0 }));
reg(def({ id: B.CHEST, name: "Chest", tex: [T.chest_side, T.chest_front, T.chest_side], hard: 1.4, tool: 2, sound: "wood", color: "#7a5a34", interact: "chest" }));
reg(def({ id: B.BED_FOOT, name: "Bed", tex: [T.bed_foot], solid: false, opaque: false, hard: 0.4, tool: 2, sound: "cloth", color: "#8e3524", interact: "bed" }));
reg(def({ id: B.BED_HEAD, name: "Bed", tex: [T.bed_head], solid: false, opaque: false, hard: 0.4, tool: 2, sound: "cloth", color: "#8e3524", interact: "bed" }));
reg(def({ id: B.SNOW_GRASS, name: "Snowfield", tex: [T.snow_top, T.snow_side, T.dirt], hard: 0.6, tool: 3, sound: "grass", color: "#e8e8ee", drop: B.DIRT }));
reg(def({ id: B.SNOW, name: "Snow Block", tex: [T.snow_top], hard: 0.5, tool: 3, sound: "grass", color: "#e8e8ee" }));
reg(def({ id: B.GRAVEL, name: "Gravel", tex: [T.gravel], hard: 0.6, tool: 3, sound: "sand", color: "#7c746a", gravity: true }));
reg(def({ id: B.CLAY, name: "Clay", tex: [T.clay], hard: 0.7, tool: 3, sound: "grass", color: "#8d949c" }));
reg(def({ id: B.BRICK, name: "Bricks", tex: [T.brick], hard: 2.0, tool: 1, tier: 1, color: "#7e4a38" }));
reg(def({ id: B.THATCH, name: "Thatch", tex: [T.thatch], hard: 0.5, tool: 2, sound: "grass", color: "#b59a55" }));
reg(def({ id: B.FENCE, name: "Palisade", tex: [T.fence], hard: 1.2, tool: 2, sound: "wood", color: "#6e5433" }));
reg(def({ id: B.DOOR_B, name: "Door", tex: [T.door_b], hard: 1.2, tool: 2, sound: "wood", color: "#6e5433", interact: "door" }));
reg(def({ id: B.DOOR_T, name: "Door", tex: [T.door_t], hard: 1.2, tool: 2, sound: "wood", color: "#6e5433" }));
reg(def({ id: B.DOOR_B_OPEN, name: "Door", tex: [T.door_open], solid: false, opaque: false, cross: true, hard: 1.2, tool: 2, sound: "wood", color: "#6e5433", interact: "door" }));
reg(def({ id: B.DOOR_T_OPEN, name: "Door", tex: [T.door_open], solid: false, opaque: false, cross: true, hard: 1.2, tool: 2, sound: "wood", color: "#6e5433" }));
reg(def({ id: B.TALLGRASS, name: "Wild Grass", tex: [T.tallgrass], solid: false, opaque: false, cross: true, hard: 0.05, sound: "grass", color: "#55673a", drop: null }));
reg(def({ id: B.FLOWER_R, name: "Blood Poppy", tex: [T.flower_r], solid: false, opaque: false, cross: true, hard: 0.05, sound: "grass", color: "#96301f", drop: null }));
reg(def({ id: B.FLOWER_Y, name: "King's Crown", tex: [T.flower_y], solid: false, opaque: false, cross: true, hard: 0.05, sound: "grass", color: "#d4a63f", drop: null }));
reg(def({ id: B.MUSHROOM, name: "Mushroom", tex: [T.mushroom], solid: false, opaque: false, cross: true, hard: 0.05, sound: "grass", color: "#8a6a4e" }));
reg(def({ id: B.REED, name: "River Reeds", tex: [T.reed], solid: false, opaque: false, cross: true, hard: 0.05, sound: "grass", color: "#5a7a4a" }));
reg(def({ id: B.DEADBUSH, name: "Deadbrush", tex: [T.deadbush], solid: false, opaque: false, cross: true, hard: 0.05, sound: "wood", color: "#6e5a3a", drop: null }));
reg(def({ id: B.GLOWSHROOM, name: "Glowcap", tex: [T.glowshroom], solid: false, opaque: false, cross: true, hard: 0.05, sound: "grass", color: "#7fe0b0", light: 9 }));
reg(def({ id: B.MOSSY, name: "Mossy Stone", tex: [T.mossy], hard: 1.8, tool: 1, tier: 1, color: "#5f6f52" }));
reg(def({ id: B.EMBERSTONE, name: "Emberstone", tex: [T.emberstone], hard: 2.6, tool: 1, tier: 2, color: "#5a3a30", light: 3 }));
reg(def({ id: B.PORTAL, name: "The Hollow Gate", tex: [T.portal], solid: false, opaque: false, hard: 999, unbreak: true, color: "#7fe07a", light: 10, interact: "portal" }));
reg(def({ id: B.BARREL, name: "Barrel", tex: [T.barrel_top, T.barrel_side, T.barrel_top], hard: 1.2, tool: 2, sound: "wood", color: "#7a5a34", interact: "barrel" }));
reg(def({ id: B.HAY, name: "Hay Bale", tex: [T.hay_top, T.hay_side, T.hay_top], hard: 0.6, tool: 2, sound: "grass", color: "#b59a45" }));
reg(def({ id: B.WOOL, name: "Wool", tex: [T.wool], hard: 0.5, sound: "cloth", color: "#c9c2b0" }));
reg(def({ id: B.EMBERFLUID, name: "Molten Ember", tex: [T.emberfluid], solid: false, opaque: false, fluid: true, hard: 0, unbreak: true, color: "#ff7a2a", light: 14 }));
reg(def({ id: B.LANTERN, name: "Lantern", tex: [T.lantern], hard: 0.8, tool: 0, sound: "metal", color: "#e0a33c", light: 12 }));
reg(def({ id: B.BOARD, name: "Quest Board", tex: [T.planks, T.board, T.planks], hard: 1.0, tool: 2, sound: "wood", color: "#8a6a42", interact: "board" }));
reg(def({ id: B.DARK_LOG, name: "Elder Log", tex: [T.log_top, T.dark_log, T.log_top], hard: 1.6, tool: 2, sound: "wood", color: "#3a2c20" }));
reg(def({ id: B.DARK_LEAVES, name: "Elder Leaves", tex: [T.dark_leaves], hard: 0.3, sound: "grass", color: "#24381f", drop: null }));
reg(def({ id: B.BOOKS, name: "Scriptorium Shelf", tex: [T.books], hard: 1.0, tool: 2, sound: "wood", color: "#6e5433" }));
reg(def({ id: B.WELL, name: "Well Stone", tex: [T.well], hard: 1.8, tool: 1, tier: 1, color: "#6f6f6c" }));
reg(def({ id: B.GRAVE, name: "Gravestone", tex: [T.grave], hard: 1.6, tool: 1, tier: 1, color: "#6f6f6c" }));

// ---------------- Texture atlas ----------------
export const ATLAS_TILES = 16, TILE_PX = 16, ATLAS_PX = 256;
let atlasCanvas: HTMLCanvasElement | null = null;

export function getAtlas(): HTMLCanvasElement {
  if (atlasCanvas) return atlasCanvas;
  const c = document.createElement("canvas");
  c.width = ATLAS_PX; c.height = ATLAS_PX;
  const ctx = c.getContext("2d")!;
  paintAtlas(ctx);
  atlasCanvas = c;
  return c;
}

export function tileRect(t: number): [number, number] {
  return [(t % ATLAS_TILES) * TILE_PX, Math.floor(t / ATLAS_TILES) * TILE_PX];
}

type Ctx = CanvasRenderingContext2D;
function tile(ctx: Ctx, t: number, fn: (px: (x: number, y: number, col: string) => void, rnd: () => number) => void) {
  const [ox, oy] = tileRect(t);
  const px = (x: number, y: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(ox + x, oy + y, 1, 1); };
  const rnd = mulberry(t * 7919 + 13);
  ctx.clearRect(ox, oy, TILE_PX, TILE_PX);
  fn(px, rnd);
}
function fillTile(ctx: Ctx, t: number, base: string, speckles: [string, number][]) {
  tile(ctx, t, (px, rnd) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let col = base;
      const r = rnd();
      let acc = 0;
      for (const [sc, p] of speckles) { acc += p; if (r < acc) { col = sc; break; } }
      px(x, y, col);
    }
  });
}
function ore(ctx: Ctx, t: number, nugget: string, glow?: string) {
  fillTile(ctx, t, "#7d7d7a", [["#6e6e6b", 0.3], ["#8a8a86", 0.45], ["#60605e", 0.55]]);
  tile(ctx, t, (px, rnd) => {
    // keep stone: repaint done above; add nuggets (2nd pass draws on top)
  });
  const [ox, oy] = tileRect(t);
  const rnd = mulberry(t * 31 + 7);
  for (let i = 0; i < 5; i++) {
    const x = 1 + Math.floor(rnd() * 13), y = 1 + Math.floor(rnd() * 13);
    ctx.fillStyle = nugget;
    ctx.fillRect(ox + x, oy + y, 2, 2);
    if (glow) { ctx.fillStyle = glow; ctx.fillRect(ox + x, oy + y, 1, 1); }
  }
}

function paintAtlas(ctx: Ctx) {
  fillTile(ctx, T.grass_top, "#55673a", [["#47572f", 0.3], ["#63784a", 0.5], ["#3c4a28", 0.58]]);
  fillTile(ctx, T.dirt, "#6b4f33", [["#5d442c", 0.3], ["#7a5b3b", 0.5], ["#523b25", 0.58]]);
  // grass side
  fillTile(ctx, T.grass_side, "#6b4f33", [["#5d442c", 0.3], ["#7a5b3b", 0.5]]);
  tile(ctx, T.grass_side, (px, rnd) => {
    for (let x = 0; x < 16; x++) {
      const d = 3 + Math.floor(rnd() * 3);
      for (let y = 0; y < d; y++) px(x, y, rnd() < 0.5 ? "#55673a" : "#47572f");
    }
  });
  fillTile(ctx, T.stone, "#7d7d7a", [["#6e6e6b", 0.3], ["#8a8a86", 0.48], ["#60605e", 0.58]]);
  tile(ctx, T.stone, (px, rnd) => { for (let i = 0; i < 6; i++) { const x = Math.floor(rnd() * 14), y = Math.floor(rnd() * 14); px(x, y, "#585856"); px(x + 1, y, "#585856"); } });
  fillTile(ctx, T.sand, "#c9b183", [["#bca476", 0.3], ["#d6c193", 0.5], ["#b0986a", 0.58]]);
  fillTile(ctx, T.water, "#2b5a75", [["#25506a", 0.35], ["#3d718f", 0.5], ["#214862", 0.6]]);
  // logs
  const logSide = (t: number, a: string, b: string, cc: string) => tile(ctx, t, (px, rnd) => {
    for (let x = 0; x < 16; x++) { const col = x % 4 === 0 ? b : (rnd() < 0.25 ? cc : a); for (let y = 0; y < 16; y++) px(x, y, y % 7 === (x % 3) && rnd() < 0.3 ? b : col); }
  });
  logSide(T.log, "#6a4f2e", "#57401f", "#7a5b36");
  logSide(T.pine_log, "#5a4430", "#47331f", "#6b5138");
  logSide(T.dark_log, "#3a2c20", "#2a1f15", "#4a382a");
  tile(ctx, T.birch_log, (px, rnd) => {
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) px(x, y, rnd() < 0.1 ? "#9a948a" : "#cfc9b8");
    for (let i = 0; i < 6; i++) { const x = Math.floor(rnd() * 14), y = Math.floor(rnd() * 15); px(x, y, "#3a3a38"); px(x + 1, y, "#3a3a38"); px(x, y + 1, "#3a3a38"); }
  });
  tile(ctx, T.log_top, (px, rnd) => {
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      px(x, y, d > 6.5 ? "#57401f" : (Math.floor(d) % 2 === 0 ? "#8a6a42" : "#755836"));
    }
  });
  // leaves
  const leaves = (t: number, a: string, b: string, hole: string) => tile(ctx, t, (px, rnd) => {
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
      const r = rnd(); px(x, y, r < 0.12 ? hole : r < 0.5 ? a : b);
    }
  });
  leaves(T.leaves, "#3f5a2c", "#35502a", "#263d1c");
  leaves(T.pine_leaves, "#2f4a33", "#274029", "#1b2f1e");
  leaves(T.birch_leaves, "#6b8a3f", "#5d7a35", "#4a632a");
  leaves(T.dark_leaves, "#24381f", "#1d2f18", "#131f0f");
  fillTile(ctx, T.planks, "#8a6a42", [["#7d5f3a", 0.3], ["#97754a", 0.5]]);
  tile(ctx, T.planks, (px, rnd) => {
    for (let y = 3; y < 16; y += 4) for (let x = 0; x < 16; x++) px(x, y, "#6e5433");
    for (let y = 0; y < 16; y += 4) { const off = (y / 4) % 2 === 0 ? 4 : 11; for (let yy = y; yy < y + 3 && yy < 16; yy++) px(off, yy, "#6e5433"); }
  });
  // cobble
  const cobble = (t: number, base: string, dark: string, hi: string) => tile(ctx, t, (px, rnd) => {
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) px(x, y, dark);
    const blobs = [[1, 1, 5, 4], [8, 1, 6, 3], [1, 7, 4, 4], [6, 6, 5, 5], [12, 5, 3, 4], [1, 12, 6, 3], [9, 12, 5, 3]];
    for (const [bx, by, bw, bh] of blobs) for (let x = bx; x < bx + bw && x < 15; x++) for (let y = by; y < by + bh && y < 15; y++)
      px(x, y, rnd() < 0.25 ? hi : base);
  });
  cobble(T.cobble, "#777774", "#4a4a48", "#8a8a86");
  cobble(T.mossy, "#6f7d5a", "#44503a", "#5f6f52");
  fillTile(ctx, T.bedrock, "#2f2f2f", [["#1d1d1d", 0.35], ["#404040", 0.5], ["#151515", 0.6]]);
  ore(ctx, T.coal, "#232323");
  ore(ctx, T.iron, "#c9a57e");
  ore(ctx, T.gold, "#e3c15c", "#f5dc82");
  ore(ctx, T.ember, "#ff7a2a", "#ffc46a");
  // torch (alpha)
  tile(ctx, T.torch, (px, rnd) => {
    for (let y = 7; y < 16; y++) { px(7, y, "#6e5433"); px(8, y, "#57401f"); }
    for (let y = 2; y < 8; y++) for (let x = 6; x < 10; x++) {
      const r = rnd(); px(x, y, r < 0.3 ? "#fff3b0" : r < 0.7 ? "#ffb545" : "#e07b2f");
    }
    px(7, 1, "#ffe9a0"); px(8, 1, "#ffcf6a");
  });
  fillTile(ctx, T.table_top, "#8a6a42", [["#7d5f3a", 0.4]]);
  tile(ctx, T.table_top, (px) => {
    for (let i = 0; i < 16; i++) { px(i, 0, "#57401f"); px(i, 15, "#57401f"); px(0, i, "#57401f"); px(15, i, "#57401f"); px(4, 4, "#3a3a38"); px(11, 5, "#3a3a38"); px(5, 11, "#3a3a38"); }
    for (let i = 6; i < 10; i++) px(i, 8, "#97754a");
  });
  fillTile(ctx, T.table_side, "#7d5f3a", [["#6e5433", 0.35], ["#8a6a42", 0.5]]);
  cobble(T.furnace_side, "#6e6e6b", "#454543", "#7d7d7a");
  tile(ctx, T.furnace_front, (px, rnd) => {
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) px(x, y, rnd() < 0.3 ? "#60605e" : "#6e6e6b");
    for (let x = 4; x < 12; x++) for (let y = 6; y < 14; y++) px(x, y, "#26201c");
    for (let x = 4; x < 12; x++) { px(x, 5, "#4a4a48"); px(x, 14, "#4a4a48"); }
    px(3, 6, "#4a4a48"); px(3, 13, "#4a4a48"); px(12, 6, "#4a4a48"); px(12, 13, "#4a4a48");
    for (let i = 0; i < 10; i++) px(6 + Math.floor(rnd() * 4), 10 + Math.floor(rnd() * 3), rnd() < 0.5 ? "#ff7a2a" : "#e0a33c");
  });
  fillTile(ctx, T.chest_side, "#7a5a34", [["#6e5130", 0.4], ["#8a6a42", 0.55]]);
  tile(ctx, T.chest_side, (px) => { for (let i = 0; i < 16; i++) { px(i, 3, "#3a2c18"); px(i, 11, "#3a2c18"); } px(2, 0, "#3a2c18"); px(13, 0, "#3a2c18"); });
  fillTile(ctx, T.chest_front, "#7a5a34", [["#6e5130", 0.4], ["#8a6a42", 0.55]]);
  tile(ctx, T.chest_front, (px) => {
    for (let i = 0; i < 16; i++) { px(i, 3, "#3a2c18"); px(i, 11, "#3a2c18"); }
    for (let y = 5; y < 10; y++) for (let x = 6; x < 10; x++) px(x, y, "#d4a63f");
    px(7, 7, "#3a2c18"); px(8, 7, "#3a2c18"); px(7, 8, "#8a6c34"); px(8, 8, "#8a6c34");
  });
  fillTile(ctx, T.bed_foot, "#c9c2b0", [["#b5ae9c", 0.4]]);
  tile(ctx, T.bed_foot, (px) => { for (let x = 0; x < 16; x++) for (let y = 8; y < 16; y++) px(x, y, (x + y) % 5 < 2 ? "#8e3524" : "#7c2c1d"); });
  fillTile(ctx, T.bed_head, "#c9c2b0", [["#b5ae9c", 0.4]]);
  tile(ctx, T.bed_head, (px) => { for (let x = 0; x < 16; x++) for (let y = 4; y < 12; y++) px(x, y, "#8e3524"); for (let x = 0; x < 16; x++) { px(x, 3, "#6e5433"); px(x, 12, "#6e5433"); } });
  fillTile(ctx, T.snow_top, "#e8e8ee", [["#dcdce6", 0.35], ["#f2f2f6", 0.5]]);
  fillTile(ctx, T.snow_side, "#6b4f33", [["#5d442c", 0.3]]);
  tile(ctx, T.snow_side, (px, rnd) => { for (let x = 0; x < 16; x++) { const d = 4 + Math.floor(rnd() * 3); for (let y = 0; y < d; y++) px(x, y, rnd() < 0.4 ? "#dcdce6" : "#e8e8ee"); } });
  fillTile(ctx, T.gravel, "#7c746a", [["#6a6259", 0.3], ["#8d857a", 0.5], ["#585049", 0.6]]);
  fillTile(ctx, T.clay, "#8d949c", [["#7e858d", 0.35], ["#9aa1a9", 0.5]]);
  fillTile(ctx, T.brick, "#7e4a38", [["#6e3f30", 0.35], ["#8d5540", 0.5]]);
  tile(ctx, T.brick, (px) => {
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) px(x, y, "#9c9488");
    for (let row = 0; row < 4; row++) { const off = row % 2 === 0 ? 0 : 4; for (let y = row * 4; y < row * 4 + 4; y++) for (let x = off; x < 16; x += 8) px(x, y, "#9c9488"); }
  });
  fillTile(ctx, T.thatch, "#b59a55", [["#a3894a", 0.35], ["#c4aa62", 0.55], ["#8d7740", 0.65]]);
  tile(ctx, T.thatch, (px, rnd) => { for (let x = 0; x < 16; x += 2) for (let y = 0; y < 16; y++) if (rnd() < 0.4) px(x, y, "#8d7740"); });
  fillTile(ctx, T.fence, "#6e5433", [["#5d4629", 0.35], ["#7d5f3a", 0.5]]);
  tile(ctx, T.fence, (px) => { for (let x = 1; x < 16; x += 4) for (let y = 0; y < 16; y++) px(x, y, "#3a2c18"); for (let i = 0; i < 16; i++) { px(i, 3, "#4a3820"); px(i, 12, "#4a3820"); } });
  const door = (t: number, window: boolean) => {
    fillTile(ctx, t, "#6e5433", [["#5d4629", 0.4], ["#7d5f3a", 0.55]]);
    tile(ctx, t, (px) => {
      for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) px(x, y, "#4a3820");
      for (let i = 0; i < 16; i++) { px(i, 2, "#3a3a38"); px(i, 13, "#3a3a38"); }
      px(12, 8, "#d4a63f"); px(12, 9, "#8a6c34");
      if (window) for (let x = 5; x < 11; x++) for (let y = 4; y < 8; y++) px(x, y, (x + y) % 3 === 0 ? "#243038" : "#2e3d47");
    });
  };
  door(T.door_b, false); door(T.door_t, true);
  fillTile(ctx, T.door_open, "#5d4629", [["#4a3820", 0.4], ["#6e5433", 0.6]]);
  // crosses (alpha)
  const crossPlant = (t: number, fn: (px: (x: number, y: number, c: string) => void, rnd: () => number) => void) => tile(ctx, t, fn);
  crossPlant(T.tallgrass, (px, rnd) => {
    for (let x = 1; x < 15; x += 2) {
      const h = 6 + Math.floor(rnd() * 7);
      for (let y = 15; y > 15 - h; y--) px(x + (rnd() < 0.3 ? 1 : 0), y, rnd() < 0.4 ? "#47572f" : "#5d7040");
    }
  });
  crossPlant(T.flower_r, (px, rnd) => {
    for (let y = 8; y < 16; y++) px(7 + (y % 2), y, "#47572f");
    for (let x = 5; x < 11; x++) for (let y = 3; y < 9; y++) if (rnd() < 0.75) px(x, y, rnd() < 0.4 ? "#96301f" : "#b03a26");
    px(7, 5, "#2b2118"); px(8, 5, "#2b2118");
  });
  crossPlant(T.flower_y, (px, rnd) => {
    for (let y = 8; y < 16; y++) px(8 - (y % 2), y, "#47572f");
    for (let x = 5; x < 11; x++) for (let y = 2; y < 8; y++) if (rnd() < 0.75) px(x, y, rnd() < 0.4 ? "#d4a63f" : "#e3bd5c");
    px(7, 4, "#8a6c34"); px(8, 4, "#8a6c34");
  });
  crossPlant(T.mushroom, (px, rnd) => {
    for (let y = 8; y < 15; y++) { px(7, y, "#c9bd9c"); px(8, y, "#b0a488"); }
    for (let x = 4; x < 12; x++) for (let y = 4; y < 9; y++) {
      const d = Math.abs(x - 7.5) + Math.abs(y - 6);
      if (d < 5.5) px(x, y, rnd() < 0.3 ? "#a3785a" : "#8a6a4e");
    }
    px(6, 5, "#e3d7b8"); px(9, 6, "#e3d7b8");
  });
  crossPlant(T.glowshroom, (px, rnd) => {
    for (let y = 8; y < 15; y++) { px(7, y, "#9cd8b8"); px(8, y, "#7fb89a"); }
    for (let x = 4; x < 12; x++) for (let y = 3; y < 9; y++) {
      const d = Math.abs(x - 7.5) + Math.abs(y - 5.5);
      if (d < 5.5) px(x, y, rnd() < 0.35 ? "#a8f0cc" : "#5fc894");
    }
    px(7, 2, "#d8ffe8"); px(8, 2, "#a8f0cc");
  });
  crossPlant(T.reed, (px, rnd) => {
    for (let x = 2; x < 15; x += 3) { const h = 8 + Math.floor(rnd() * 6); for (let y = 15; y > 15 - h; y--) px(x, y, rnd() < 0.4 ? "#4a6a3a" : "#5a7a4a"); px(x, 15 - h, "#8a6a4e"); }
  });
  crossPlant(T.deadbush, (px, rnd) => {
    for (let i = 0; i < 26; i++) { const x = 2 + Math.floor(rnd() * 12), y = 5 + Math.floor(rnd() * 10); px(x, y, rnd() < 0.5 ? "#6e5a3a" : "#5a4830"); }
    for (let y = 8; y < 16; y++) px(7, y, "#5a4830");
  });
  cobble(T.emberstone, "#4a3530", "#2c1e1a", "#5a423a");
  tile(ctx, T.emberstone, (px, rnd) => { for (let i = 0; i < 14; i++) { const x = Math.floor(rnd() * 15), y = Math.floor(rnd() * 15); px(x, y, "#ff7a2a"); px(x + 1, y, rnd() < 0.5 ? "#e05f1a" : "#a34312"); } });
  fillTile(ctx, T.portal, "#0f1f12", [["#1a2f1a", 0.4], ["#0a150c", 0.55]]);
  tile(ctx, T.portal, (px, rnd) => {
    for (let i = 0; i < 30; i++) { const x = Math.floor(rnd() * 16), y = Math.floor(rnd() * 16); px(x, y, rnd() < 0.5 ? "#7fe07a" : "#3a8a4a"); }
    for (let y = 0; y < 16; y++) px(7 + Math.floor(Math.sin(y * 0.8) * 3), y, "#b8f5b0");
  });
  fillTile(ctx, T.barrel_side, "#7a5a34", [["#6e5130", 0.4]]);
  tile(ctx, T.barrel_side, (px) => { for (let x = 0; x < 16; x += 3) for (let y = 0; y < 16; y++) px(x, y, "#57401f"); for (let i = 0; i < 16; i++) { px(i, 3, "#3a3a38"); px(i, 12, "#3a3a38"); } });
  tile(ctx, T.barrel_top, (px, rnd) => {
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      px(x, y, d > 7 ? "#3a3a38" : d > 6 ? "#57401f" : rnd() < 0.3 ? "#6e5130" : "#7a5a34");
    }
  });
  fillTile(ctx, T.hay_side, "#b59a45", [["#a3893a", 0.35], ["#c4aa55", 0.55]]);
  tile(ctx, T.hay_side, (px, rnd) => { for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x++) if (rnd() < 0.5) px(x, y, "#8d7730"); });
  fillTile(ctx, T.hay_top, "#c4aa55", [["#b59a45", 0.4]]);
  tile(ctx, T.hay_top, (px, rnd) => { for (let i = 0; i < 40; i++) px(Math.floor(rnd() * 16), Math.floor(rnd() * 16), "#8d7730"); });
  fillTile(ctx, T.wool, "#c9c2b0", [["#b5ae9c", 0.35], ["#d8d2c0", 0.55]]);
  tile(ctx, T.wool, (px, rnd) => { for (let i = 0; i < 10; i++) { const x = Math.floor(rnd() * 14), y = Math.floor(rnd() * 14); px(x, y, "#a8a190"); px(x + 1, y + 1, "#d8d2c0"); } });
  fillTile(ctx, T.emberfluid, "#c2451a", [["#ff7a2a", 0.35], ["#8a2c0e", 0.55], ["#ffc46a", 0.62]]);
  tile(ctx, T.lantern, (px, rnd) => {
    for (let x = 3; x < 13; x++) for (let y = 2; y < 15; y++) px(x, y, "#2c2c2c");
    for (let x = 4; x < 12; x++) for (let y = 4; y < 13; y++) px(x, y, rnd() < 0.3 ? "#ffcf6a" : "#e0a33c");
    for (let x = 5; x < 11; x++) px(x, 1, "#3a3a38");
    px(7, 0, "#3a3a38"); px(8, 0, "#3a3a38");
    for (let i = 0; i < 8; i++) px(6 + Math.floor(rnd() * 4), 6 + Math.floor(rnd() * 4), "#fff3b0");
  });
  fillTile(ctx, T.board, "#8a6a42", [["#7d5f3a", 0.4]]);
  tile(ctx, T.board, (px) => {
    for (let x = 2; x < 14; x++) for (let y = 2; y < 12; y++) px(x, y, "#e3d3a8");
    for (let y = 4; y < 11; y += 2) for (let x = 4; x < 12; x++) px(x, y, "#6e5a3a");
    px(3, 3, "#96301f"); px(12, 3, "#96301f");
  });
  fillTile(ctx, T.books, "#6e5433", [["#5d4629", 0.3]]);
  tile(ctx, T.books, (px, rnd) => {
    const cols = ["#96301f", "#3a5a7a", "#7a6a2a", "#4a6a3a", "#6a3a5a"];
    for (let row = 0; row < 2; row++) { const y0 = 2 + row * 7; let x = 1;
      while (x < 14) { const w = 2 + Math.floor(rnd() * 2); const c = cols[Math.floor(rnd() * cols.length)];
        for (let xx = x; xx < x + w && xx < 14; xx++) for (let y = y0; y < y0 + 5; y++) px(xx, y, c); x += w + 1; } }
  });
  cobble(T.well, "#6e6e6b", "#4a4a48", "#8a8a86");
  tile(ctx, T.well, (px) => { for (let i = 0; i < 16; i++) { px(i, 0, "#57401f"); px(i, 15, "#3a3a38"); } });
  tile(ctx, T.grave, (px, rnd) => {
    for (let x = 3; x < 13; x++) for (let y = 2; y < 16; y++) {
      const top = y < 4 ? Math.abs(x - 7.5) < 4 : true;
      if (top) px(x, y, rnd() < 0.3 ? "#60605e" : "#6e6e6b");
    }
    px(7, 6, "#4a4a48"); px(8, 6, "#4a4a48"); px(7, 7, "#4a4a48"); px(8, 7, "#4a4a48"); px(7, 8, "#4a4a48"); px(8, 8, "#4a4a48"); px(6, 7, "#4a4a48"); px(9, 7, "#4a4a48");
  });
}
