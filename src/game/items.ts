// Emberfall items: registry, pixel-sprite icons, recipes, smelting, loot tables.
import { B, BLOCKS, getAtlas, tileRect, TILE_PX } from "./blocks";

export interface ItemStack { id: number; n: number; dur?: number; bonus?: number; }
export interface ItemDef {
  id: number; name: string; kind: string; stack: number; desc?: string;
  dmg?: number; spd?: number; tier?: number; armor?: number; blockPct?: number;
  food?: number; sat?: number; fuel?: number; use?: string;
  blockId?: number; toolClass?: number; // 1 pick 2 axe 3 shovel 4 sword 5 bow
}

export const I = {
  STICK: 256, COAL: 257, IRON: 258, GOLD: 259, EMBER: 260, HIDE: 261, BONE: 262,
  MEAT_RAW: 263, MEAT: 264, APPLE: 265, BERRIES: 266, BREAD: 267, WHEAT: 268,
  MUSH: 269, STEW: 270, COIN: 271, KEY: 272, RELIC: 273, CROWN: 274, BANDAGE: 275, WOOL_ITEM: 276,
  W_SWORD: 280, W_PICK: 281, W_AXE: 282, W_SHOVEL: 283,
  S_SWORD: 284, S_PICK: 285, S_AXE: 286, S_SHOVEL: 287,
  I_SWORD: 288, I_PICK: 289, I_AXE: 290, I_SHOVEL: 291,
  SHIELD_W: 295, SHIELD_I: 296,
  L_CAP: 300, L_TUNIC: 301, L_LEGS: 302, I_HELM: 303, I_PLATE: 304, I_LEGS: 305,
};

export const ITEMS = new Map<number, ItemDef>();
const iconCache = new Map<number, string>();

function defItem(d: ItemDef) { ITEMS.set(d.id, d); }

// --- block items (id == block id) ---
for (const bd of BLOCKS) {
  if (!bd || bd.id === B.AIR) continue;
  defItem({ id: bd.id, name: bd.name, kind: "block", stack: bd.id === B.TORCH ? 32 : 64, blockId: bd.id });
}

// --- materials & consumables ---
defItem({ id: I.STICK, name: "Stick", kind: "mat", stack: 64, fuel: 1 });
defItem({ id: I.COAL, name: "Coal", kind: "mat", stack: 64, fuel: 4 });
defItem({ id: I.IRON, name: "Iron Ingot", kind: "mat", stack: 64 });
defItem({ id: I.GOLD, name: "Gold Ingot", kind: "mat", stack: 64 });
defItem({ id: I.EMBER, name: "Ember Shard", kind: "mat", stack: 64, desc: "Still warm. Pulses with hollow light." });
defItem({ id: I.HIDE, name: "Hide", kind: "mat", stack: 64 });
defItem({ id: I.BONE, name: "Bone", kind: "mat", stack: 64 });
defItem({ id: I.MEAT_RAW, name: "Raw Meat", kind: "food", stack: 32, food: 3, sat: 2 });
defItem({ id: I.MEAT, name: "Roast Meat", kind: "food", stack: 32, food: 8, sat: 8 });
defItem({ id: I.APPLE, name: "Apple", kind: "food", stack: 32, food: 4, sat: 3 });
defItem({ id: I.BERRIES, name: "Rowan Berries", kind: "food", stack: 64, food: 2, sat: 1 });
defItem({ id: I.BREAD, name: "Black Bread", kind: "food", stack: 32, food: 6, sat: 5 });
defItem({ id: I.WHEAT, name: "Wheat", kind: "mat", stack: 64 });
defItem({ id: I.MUSH, name: "Mushroom", kind: "food", stack: 64, food: 2, sat: 1 });
defItem({ id: I.STEW, name: "Hunter's Stew", kind: "food", stack: 16, food: 12, sat: 12 });
defItem({ id: I.COIN, name: "Old Coin", kind: "mat", stack: 999, desc: "Stamped with a forgotten king's face." });
defItem({ id: I.KEY, name: "Rusty Key", kind: "key", stack: 8 });
defItem({ id: I.RELIC, name: "Saint's Relic", kind: "quest", stack: 8, desc: "The elder wants this returned." });
defItem({ id: I.BANDAGE, name: "Linen Bandage", kind: "use", stack: 16, use: "bandage" });
defItem({ id: I.WOOL_ITEM, name: "Wool", kind: "mat", stack: 64 });

// --- tools & weapons ---
const tool = (id: number, name: string, cls: number, tier: number, dmg: number, spd: number, dur: number) =>
  defItem({ id, name, kind: cls === 4 ? "weapon" : "tool", stack: 1, tier, dmg, spd, toolClass: cls, desc: `Durability ${dur}` });
tool(I.W_SWORD, "Wooden Sword", 4, 1, 4, 1.4, 60);
tool(I.W_PICK, "Wooden Pick", 1, 1, 2, 1.0, 60);
tool(I.W_AXE, "Wooden Axe", 2, 1, 3, 0.9, 60);
tool(I.W_SHOVEL, "Wooden Shovel", 3, 1, 2, 1.1, 60);
tool(I.S_SWORD, "Stone Sword", 4, 2, 6, 1.3, 130);
tool(I.S_PICK, "Stone Pick", 1, 2, 3, 1.1, 130);
tool(I.S_AXE, "Stone Axe", 2, 2, 5, 0.85, 130);
tool(I.S_SHOVEL, "Stone Shovel", 3, 2, 3, 1.2, 130);
tool(I.I_SWORD, "Iron Sword", 4, 3, 9, 1.5, 300);
tool(I.I_PICK, "Iron Pick", 1, 3, 4, 1.3, 300);
tool(I.I_AXE, "Iron Axe", 2, 3, 7, 1.0, 300);
tool(I.I_SHOVEL, "Iron Shovel", 3, 3, 4, 1.3, 300);
defItem({ id: I.SHIELD_W, name: "Wooden Shield", kind: "shield", stack: 1, blockPct: 0.6, tier: 1, desc: "Hold to block. Tap to parry." });
defItem({ id: I.SHIELD_I, name: "Iron Shield", kind: "shield", stack: 1, blockPct: 0.8, tier: 2, desc: "Hold to block. Tap to parry." });
// --- armor ---
const armor = (id: number, name: string, slot: string, ar: number) => defItem({ id, name, kind: "armor", stack: 1, armor: ar, desc: slot });
armor(I.L_CAP, "Leather Cap", "head", 1);
armor(I.L_TUNIC, "Leather Tunic", "chest", 2);
armor(I.L_LEGS, "Leather Breeches", "legs", 1);
armor(I.I_HELM, "Iron Helm", "head", 3);
armor(I.I_PLATE, "Iron Cuirass", "chest", 5);
armor(I.I_LEGS, "Iron Greaves", "legs", 3);
defItem({ id: I.CROWN, name: "Crown of the Barrow King", kind: "armor", stack: 1, armor: 6, desc: "head — cold to the touch, whispering of old hills." });

export const TOOL_DUR: Record<number, number> = {};
for (const id of [I.W_SWORD, I.W_PICK, I.W_AXE, I.W_SHOVEL]) TOOL_DUR[id] = 60;
for (const id of [I.S_SWORD, I.S_PICK, I.S_AXE, I.S_SHOVEL]) TOOL_DUR[id] = 130;
for (const id of [I.I_SWORD, I.I_PICK, I.I_AXE, I.I_SHOVEL]) TOOL_DUR[id] = 300;
TOOL_DUR[I.SHIELD_W] = 120; TOOL_DUR[I.SHIELD_I] = 400;

// ---------------- Recipes ----------------
export interface Recipe { out: { id: number; n: number }; ing: [number, number][]; station: "hand" | "table"; }
export const RECIPES: Recipe[] = [
  { out: { id: B.PLANKS, n: 4 }, ing: [[B.LOG, 1]], station: "hand" },
  { out: { id: B.PLANKS, n: 4 }, ing: [[B.PINE_LOG, 1]], station: "hand" },
  { out: { id: B.PLANKS, n: 4 }, ing: [[B.BIRCH_LOG, 1]], station: "hand" },
  { out: { id: B.PLANKS, n: 4 }, ing: [[B.DARK_LOG, 1]], station: "hand" },
  { out: { id: I.STICK, n: 4 }, ing: [[B.PLANKS, 2]], station: "hand" },
  { out: { id: B.TORCH, n: 4 }, ing: [[I.STICK, 1], [I.COAL, 1]], station: "hand" },
  { out: { id: B.TABLE, n: 1 }, ing: [[B.PLANKS, 4]], station: "hand" },
  { out: { id: I.WHEAT, n: 3 }, ing: [[B.HAY, 1]], station: "hand" },
  { out: { id: B.WOOL, n: 1 }, ing: [[I.WOOL_ITEM, 4]], station: "hand" },
  { out: { id: I.BANDAGE, n: 2 }, ing: [[I.WOOL_ITEM, 2]], station: "hand" },
  { out: { id: B.FURNACE, n: 1 }, ing: [[B.COBBLE, 8]], station: "table" },
  { out: { id: B.CHEST, n: 1 }, ing: [[B.PLANKS, 8]], station: "table" },
  { out: { id: B.BARREL, n: 1 }, ing: [[B.PLANKS, 6]], station: "table" },
  { out: { id: B.BED_FOOT, n: 1 }, ing: [[B.PLANKS, 3], [I.WOOL_ITEM, 3]], station: "table" },
  { out: { id: B.DOOR_B, n: 1 }, ing: [[B.PLANKS, 6]], station: "table" },
  { out: { id: B.FENCE, n: 2 }, ing: [[B.PLANKS, 3], [I.STICK, 2]], station: "table" },
  { out: { id: B.LANTERN, n: 1 }, ing: [[I.IRON, 1], [B.TORCH, 1]], station: "table" },
  { out: { id: I.BREAD, n: 1 }, ing: [[I.WHEAT, 3]], station: "table" },
  { out: { id: I.STEW, n: 1 }, ing: [[I.MUSH, 2], [I.BERRIES, 2]], station: "table" },
  { out: { id: I.W_SWORD, n: 1 }, ing: [[B.PLANKS, 2], [I.STICK, 1]], station: "table" },
  { out: { id: I.W_PICK, n: 1 }, ing: [[B.PLANKS, 3], [I.STICK, 2]], station: "table" },
  { out: { id: I.W_AXE, n: 1 }, ing: [[B.PLANKS, 3], [I.STICK, 2]], station: "table" },
  { out: { id: I.W_SHOVEL, n: 1 }, ing: [[B.PLANKS, 1], [I.STICK, 2]], station: "table" },
  { out: { id: I.S_SWORD, n: 1 }, ing: [[B.COBBLE, 2], [I.STICK, 1]], station: "table" },
  { out: { id: I.S_PICK, n: 1 }, ing: [[B.COBBLE, 3], [I.STICK, 2]], station: "table" },
  { out: { id: I.S_AXE, n: 1 }, ing: [[B.COBBLE, 3], [I.STICK, 2]], station: "table" },
  { out: { id: I.S_SHOVEL, n: 1 }, ing: [[B.COBBLE, 1], [I.STICK, 2]], station: "table" },
  { out: { id: I.I_SWORD, n: 1 }, ing: [[I.IRON, 2], [I.STICK, 1]], station: "table" },
  { out: { id: I.I_PICK, n: 1 }, ing: [[I.IRON, 3], [I.STICK, 2]], station: "table" },
  { out: { id: I.I_AXE, n: 1 }, ing: [[I.IRON, 3], [I.STICK, 2]], station: "table" },
  { out: { id: I.I_SHOVEL, n: 1 }, ing: [[I.IRON, 1], [I.STICK, 2]], station: "table" },
  { out: { id: I.SHIELD_W, n: 1 }, ing: [[B.PLANKS, 5], [I.STICK, 1]], station: "table" },
  { out: { id: I.SHIELD_I, n: 1 }, ing: [[I.IRON, 2], [B.PLANKS, 3]], station: "table" },
  { out: { id: I.L_CAP, n: 1 }, ing: [[I.HIDE, 3]], station: "table" },
  { out: { id: I.L_TUNIC, n: 1 }, ing: [[I.HIDE, 5]], station: "table" },
  { out: { id: I.L_LEGS, n: 1 }, ing: [[I.HIDE, 4]], station: "table" },
  { out: { id: I.I_HELM, n: 1 }, ing: [[I.IRON, 4]], station: "table" },
  { out: { id: I.I_PLATE, n: 1 }, ing: [[I.IRON, 7]], station: "table" },
  { out: { id: I.I_LEGS, n: 1 }, ing: [[I.IRON, 6]], station: "table" },
];
export interface Smelt { inId: number; out: { id: number; n: number }; fuel: number; }
export const SMELTS: Smelt[] = [
  { inId: B.IRON_ORE, out: { id: I.IRON, n: 1 }, fuel: 2 },
  { inId: B.GOLD_ORE, out: { id: I.GOLD, n: 1 }, fuel: 2 },
  { inId: I.MEAT_RAW, out: { id: I.MEAT, n: 1 }, fuel: 1 },
  { inId: B.CLAY, out: { id: B.BRICK, n: 1 }, fuel: 2 },
  { inId: B.COBBLE, out: { id: B.STONE, n: 1 }, fuel: 1 },
];
export const FUEL: Record<number, number> = { [I.COAL]: 4, [B.LOG]: 2, [B.PINE_LOG]: 2, [B.BIRCH_LOG]: 2, [B.DARK_LOG]: 2, [B.PLANKS]: 1, [I.STICK]: 1, [B.HAY]: 3, [B.THATCH]: 1 };

// ---------------- Icons ----------------
const SPRITES: Record<number, { pal: Record<string, string>; rows: string[] }> = {
  [I.STICK]: { pal: { a: "#8a6a42", b: "#6e5433" }, rows: ["......aa", ".....aa.", "....ab..", "...ab...", "..ab....", ".ab.....", "ab......", "b......."] },
  [I.COAL]: { pal: { a: "#2c2c2c", b: "#1a1a1a", c: "#454545" }, rows: ["........", "..aaa...", ".abcca..", ".abba...", "..bbaa..", "...ba...", "........", "........"] },
  [I.IRON]: { pal: { a: "#d8cdb8", b: "#a89a82", c: "#8d8069" }, rows: ["........", "........", "..aaaa..", ".abbbbc.", ".accccb.", "..bbbb..", "........", "........"] },
  [I.GOLD]: { pal: { a: "#f5dc82", b: "#d4a63f", c: "#a87f2a" }, rows: ["........", "........", "..aaaa..", ".abbbbc.", ".accccb.", "..bbbb..", "........", "........"] },
  [I.EMBER]: { pal: { a: "#ffc46a", b: "#ff7a2a", c: "#a34312" }, rows: ["...a....", "...ba...", "..bba...", "..abbc..", ".babbc..", ".bbc....", "..cc....", "........"] },
  [I.HIDE]: { pal: { a: "#a87850", b: "#8d6242", c: "#6e4a30" }, rows: [".aa..aa.", "abbaabba", ".abbbba.", ".abbbba.", "..bbbb..", "..bccb..", "...cc...", "........"] },
  [I.BONE]: { pal: { a: "#e3dcc4", b: "#c4bca2" }, rows: [".aa.....", "abba....", ".abba...", "..abba..", "...abba.", "....abba", ".....abb", "......aa"] },
  [I.MEAT_RAW]: { pal: { a: "#c46a5a", b: "#96443a", c: "#e3dcc4" }, rows: ["..aaa...", ".aabba..", ".abba...", "..bb....", "...cc...", "...cc...", "....cc..", "....cc.."] },
  [I.MEAT]: { pal: { a: "#a86a3a", b: "#7c4a26", c: "#e3dcc4" }, rows: ["..aaa...", ".aabba..", ".abba...", "..bb....", "...cc...", "...cc...", "....cc..", "....cc.."] },
  [I.APPLE]: { pal: { a: "#b03a26", b: "#96301f", c: "#5d7040", d: "#e3bd5c" }, rows: ["...c....", "..cc....", ".aaad...", "aaaba...", "aabba...", "aabba...", ".abba...", "..bb...."] },
  [I.BERRIES]: { pal: { a: "#c4552a", b: "#96401f", c: "#5d7040" }, rows: ["..c.....", ".cc.....", ".aba.b..", "aabbaab.", ".abbaa..", "..aba...", "........", "........"] },
  [I.BREAD]: { pal: { a: "#c49a55", b: "#a87f42", c: "#7c5c30" }, rows: ["........", "..aaaa..", ".abbbba.", "abbbbbca", "abbbbbba", ".cccccc.", "........", "........"] },
  [I.WHEAT]: { pal: { a: "#d4b45c", b: "#b59a45", c: "#8d7730" }, rows: ["..a.a...", "..abba..", ".abbba..", "..abba..", "..cbc...", "..cbc...", "..c.c...", ".c...c.."] },
  [I.MUSH]: { pal: { a: "#8a6a4e", b: "#6e523a", c: "#e3d7b8" }, rows: ["..aaaa..", ".aabbaa.", "aabbbbaa", "...cc...", "...cc...", "..cccc..", "........", "........"] },
  [I.STEW]: { pal: { a: "#8a5a2a", b: "#6e4520", c: "#c9c2b0", d: "#a87850" }, rows: [".d..d...", ".adada..", "..aaa...", "ccccccc.", "cbbbbbc.", ".bbbbb..", "..bbb...", "........"] },
  [I.COIN]: { pal: { a: "#f5dc82", b: "#d4a63f", c: "#a87f2a" }, rows: ["..aaa...", ".abba...", ".abca...", ".abca...", ".abba...", "..aaa...", "........", "........"] },
  [I.KEY]: { pal: { a: "#a89a82", b: "#7c7260" }, rows: ["..aaa...", ".a...a..", ".a...a..", "..aaa...", "..aa....", "..aa....", "..aaa...", "..aa...."] },
  [I.RELIC]: { pal: { a: "#d8d2c0", b: "#a8a190", c: "#7fe0b0", d: "#d4a63f" }, rows: [".dddddd.", "daaaaad.", "daacaad.", "daacaad.", "daaaaad.", "dbbbbbd.", ".dddddd.", "........"] },
  [I.BANDAGE]: { pal: { a: "#e3dcc4", b: "#c4bca2", c: "#96301f" }, rows: ["........", "..aaaa..", ".abbbba.", ".abcbca.", ".abbbba.", "..aaaa..", "........", "........"] },
  [I.WOOL_ITEM]: { pal: { a: "#e3dcc8", b: "#c9c2b0", c: "#a8a190" }, rows: [".aabba..", "aabbbba.", "abbbbba.", "abccbba.", "abccbba.", ".abbbba.", "..abba..", "........"] },
};
// tools & weapons drawn programmatically
function drawToolSprite(cnv: HTMLCanvasElement, kind: string, headCol: string, headHi: string) {
  const ctx = cnv.getContext("2d")!;
  const px = (x: number, y: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x * 4, y * 4, 4, 4); };
  const handle = "#8a6a42", handleD = "#6e5433";
  for (let i = 0; i < 6; i++) { px(1 + i, 7 - i, i % 2 ? handleD : handle); }
  if (kind === "sword") {
    for (let i = 0; i < 5; i++) { px(4 + i, 3 - i, i % 2 ? headHi : headCol); px(5 + i, 4 - i, headCol); }
    px(6, 0, headHi); px(3, 5, "#d4a63f"); px(5, 3, "#d4a63f");
  } else if (kind === "pick") {
    for (let i = 0; i < 5; i++) px(2 + i, 2 - Math.floor(Math.abs(i - 2) * 0.7), headCol);
    px(2, 2, headHi); px(3, 1, headHi); px(6, 2, headCol); px(5, 1, headCol); px(4, 1, headHi);
  } else if (kind === "axe") {
    for (let y = 0; y < 4; y++) for (let x = 4; x < 7; x++) if (x + y < 9 && x - y > 0) px(x, y, x === 4 || y === 0 ? headHi : headCol);
  } else if (kind === "shovel") {
    for (let y = 0; y < 3; y++) for (let x = 5; x < 8; x++) px(x, y, y === 0 ? headHi : headCol);
  } else if (kind === "shield") {
    for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) {
      const edge = x === 1 || x === 6 || y === 1 || (y > 4 && Math.abs(x - 3.5) > 6 - y);
      if (y <= 5 - Math.abs(x - 3.5) + 1) px(x, y, edge ? headCol : headHi);
    }
    px(3, 3, "#d4a63f"); px(4, 3, "#d4a63f"); px(3, 4, "#d4a63f"); px(4, 4, "#d4a63f");
  }
}
const TOOL_SPRITE: Record<number, [string, string, string]> = {
  [I.W_SWORD]: ["sword", "#a8895c", "#c4a878"], [I.W_PICK]: ["pick", "#a8895c", "#c4a878"], [I.W_AXE]: ["axe", "#a8895c", "#c4a878"], [I.W_SHOVEL]: ["shovel", "#a8895c", "#c4a878"],
  [I.S_SWORD]: ["sword", "#8d8d8a", "#b0b0ac"], [I.S_PICK]: ["pick", "#8d8d8a", "#b0b0ac"], [I.S_AXE]: ["axe", "#8d8d8a", "#b0b0ac"], [I.S_SHOVEL]: ["shovel", "#8d8d8a", "#b0b0ac"],
  [I.I_SWORD]: ["sword", "#c9cdb8", "#e8ecd8"], [I.I_PICK]: ["pick", "#c9cdb8", "#e8ecd8"], [I.I_AXE]: ["axe", "#c9cdb8", "#e8ecd8"], [I.I_SHOVEL]: ["shovel", "#c9cdb8", "#e8ecd8"],
  [I.SHIELD_W]: ["shield", "#6e5433", "#8a6a42"], [I.SHIELD_I]: ["shield", "#8d939c", "#b8bec8"],
};
const ARMOR_SPRITE: Record<number, { pal: Record<string, string>; rows: string[] }> = {
  [I.L_CAP]: { pal: { a: "#a87850", b: "#8d6242" }, rows: ["..aaaa..", ".abbbba.", "abbbbbba", "abbbbbba", "........", "........", "........", "........"] },
  [I.L_TUNIC]: { pal: { a: "#a87850", b: "#8d6242", c: "#6e4a30" }, rows: [".a....a.", "aba..aba", "abbaabba", ".abbbba.", ".abccba.", ".abbbba.", "..abba..", "........"] },
  [I.L_LEGS]: { pal: { a: "#a87850", b: "#8d6242" }, rows: [".abbbba.", ".ab..ba.", ".ab..ba.", ".ab..ba.", ".ab..ba.", "........", "........", "........"] },
  [I.I_HELM]: { pal: { a: "#c9cdb8", b: "#8d939c", c: "#96301f" }, rows: ["..aaaa..", ".abbbba.", "abbbbbba", "ab.cc.ba", "abbbbbba", "........", "........", "........"] },
  [I.I_PLATE]: { pal: { a: "#c9cdb8", b: "#8d939c", c: "#d4a63f" }, rows: [".a....a.", "aba..aba", "abbaabba", ".abccba.", ".abbbba.", ".abbbba.", "..abba..", "........"] },
  [I.I_LEGS]: { pal: { a: "#c9cdb8", b: "#8d939c" }, rows: [".abbbba.", ".ab..ba.", ".ab..ba.", ".ab..ba.", ".ab..ba.", "........", "........", "........"] },
  [I.CROWN]: { pal: { a: "#f5dc82", b: "#d4a63f", c: "#96301f", d: "#7fe0b0" }, rows: [".a..a.a.", ".abaaba.", ".abbbba.", ".abcbda.", ".abbbba.", "........", "........", "........"] },
};

export function iconFor(id: number): string {
  const cached = iconCache.get(id);
  if (cached) return cached;
  const cnv = document.createElement("canvas");
  cnv.width = 32; cnv.height = 32;
  const ctx = cnv.getContext("2d")!;
  const item = ITEMS.get(id);
  if (item?.blockId !== undefined && id < 256) {
    const atlas = getAtlas();
    const bd = BLOCKS[id];
    const t = bd.tex.length > 1 ? bd.tex[1] : bd.tex[0];
    const [sx, sy] = tileRect(t);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlas, sx, sy, TILE_PX, TILE_PX, 0, 0, 32, 32);
  } else if (TOOL_SPRITE[id]) {
    drawToolSprite(cnv, ...TOOL_SPRITE[id]);
  } else if (ARMOR_SPRITE[id]) {
    paintSprite(ctx, ARMOR_SPRITE[id]);
  } else if (SPRITES[id]) {
    paintSprite(ctx, SPRITES[id]);
  } else {
    ctx.fillStyle = "#888"; ctx.fillRect(4, 4, 24, 24);
  }
  const url = cnv.toDataURL();
  iconCache.set(id, url);
  return url;
}
function paintSprite(ctx: CanvasRenderingContext2D, s: { pal: Record<string, string>; rows: string[] }) {
  s.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      ctx.fillStyle = s.pal[ch] || "#f0f";
      ctx.fillRect(x * 4, y * 4, 4, 4);
    }
  });
}

export function stackName(s: ItemStack | null): string {
  if (!s) return "";
  const d = ITEMS.get(s.id);
  return d ? d.name : "?";
}
export function stackIcon(s: ItemStack | null): string {
  if (!s) return "";
  return iconFor(s.id);
}
export function maxDur(id: number): number { return TOOL_DUR[id] || 0; }

// ---------------- Loot ----------------
import { mulberry } from "./noise";
export type LootKind = "village" | "ruin" | "barrow" | "merchant" | "blacksmith";
export function rollLoot(kind: LootKind, seed: number): ItemStack[] {
  const r = mulberry(seed);
  const out: ItemStack[] = [];
  const push = (id: number, n: number) => out.push({ id, n });
  const chance = (p: number) => r() < p;
  if (kind === "village") {
    push(I.BREAD, 1 + Math.floor(r() * 3));
    if (chance(0.7)) push(I.APPLE, 1 + Math.floor(r() * 3));
    if (chance(0.5)) push(B.TORCH, 2 + Math.floor(r() * 4));
    if (chance(0.4)) push(I.COIN, 2 + Math.floor(r() * 6));
    if (chance(0.25)) push(I.WHEAT, 2 + Math.floor(r() * 3));
    if (chance(0.15)) push(I.L_CAP, 1);
  } else if (kind === "ruin") {
    push(I.COIN, 4 + Math.floor(r() * 10));
    if (chance(0.6)) push(B.TORCH, 2 + Math.floor(r() * 3));
    if (chance(0.5)) push(I.IRON, 1 + Math.floor(r() * 2));
    if (chance(0.35)) push(I.KEY, 1);
    if (chance(0.3)) push(I.GOLD, 1);
    if (chance(0.25)) push(I.RELIC, 1);
    if (chance(0.3)) push([I.S_SWORD, I.S_PICK, I.S_AXE][Math.floor(r() * 3)], 1);
    if (chance(0.2)) push(I.I_HELM, 1);
    if (chance(0.25)) push(I.BANDAGE, 1 + Math.floor(r() * 2));
  } else if (kind === "barrow") {
    push(I.COIN, 15 + Math.floor(r() * 20));
    push(I.EMBER, 2 + Math.floor(r() * 3));
    if (chance(0.6)) push(I.I_PLATE, 1);
    if (chance(0.5)) push([I.I_SWORD, I.I_PICK][Math.floor(r() * 2)], 1);
    if (chance(0.5)) push(I.GOLD, 2 + Math.floor(r() * 2));
    if (chance(0.4)) push(I.RELIC, 1);
  } else if (kind === "merchant") {
    push(I.BREAD, 4); push(I.APPLE, 4); push(B.TORCH, 8); push(I.BANDAGE, 3);
  }
  return out;
}

export const MERCHANT_TRADES: { give: ItemStack; cost: number; label: string }[] = [
  { give: { id: I.BREAD, n: 2 }, cost: 2, label: "Black Bread ×2" },
  { give: { id: I.APPLE, n: 3 }, cost: 2, label: "Apples ×3" },
  { give: { id: I.MEAT, n: 1 }, cost: 3, label: "Roast Meat" },
  { give: { id: B.TORCH, n: 6 }, cost: 2, label: "Torches ×6" },
  { give: { id: I.BANDAGE, n: 2 }, cost: 3, label: "Bandages ×2" },
  { give: { id: I.IRON, n: 1 }, cost: 6, label: "Iron Ingot" },
  { give: { id: I.KEY, n: 1 }, cost: 12, label: "Rusty Key" },
];
export const SMITH_TRADES: { give: ItemStack; cost: number; label: string }[] = [
  { give: { id: I.S_SWORD, n: 1 }, cost: 14, label: "Stone Sword" },
  { give: { id: I.S_PICK, n: 1 }, cost: 14, label: "Stone Pick" },
  { give: { id: I.I_SWORD, n: 1 }, cost: 32, label: "Iron Sword" },
  { give: { id: I.I_PICK, n: 1 }, cost: 32, label: "Iron Pick" },
  { give: { id: I.I_HELM, n: 1 }, cost: 28, label: "Iron Helm" },
  { give: { id: I.I_PLATE, n: 1 }, cost: 46, label: "Iron Cuirass" },
  { give: { id: I.SHIELD_I, n: 1 }, cost: 30, label: "Iron Shield" },
];
