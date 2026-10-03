// Emberfall world: chunk storage, seeded generation, biomes, caves, structures.
import { Noise2, Noise3, rand2, rand3, mulberry } from "./noise";
import { B, BLOCKS } from "./blocks";
import { ItemStack, LootKind } from "./items";

export const CH = 16, HH = 64, WATER_Y = 22;

export const BIOMES = [
  { id: 0, name: "The Boundless Sea" },
  { id: 1, name: "Shingle Beach" },
  { id: 2, name: "King's Meadow" },
  { id: 3, name: "Deepwood" },
  { id: 4, name: "Pinefell" },
  { id: 5, name: "Birchwood" },
  { id: 6, name: "The Elder Dark" },
  { id: 7, name: "Windtorn Hills" },
  { id: 8, name: "The Cragspines" },
  { id: 9, name: "Frostpeak" },
  { id: 10, name: "Mirefen Swamp" },
  { id: 11, name: "The Ashen Waste" },
  { id: 12, name: "Underdeep" },
  { id: 13, name: "Glowcap Grotto" },
  { id: 14, name: "The Hollows" },
];
export const BIO = { SEA: 0, BEACH: 1, MEADOW: 2, FOREST: 3, PINE: 4, BIRCH: 5, DARK: 6, HILLS: 7, MOUNTAIN: 8, SNOW: 9, SWAMP: 10, BADLANDS: 11, CAVE: 12, GROTTO: 13, HOLLOW: 14 };

export interface Chunk {
  cx: number; cz: number; dim: number;
  blocks: Uint8Array; hm: Uint16Array;
  lights: { x: number; y: number; z: number; l: number }[];
  generated: boolean; meshed: boolean; lastUse: number;
}
export interface RayHit { x: number; y: number; z: number; nx: number; ny: number; nz: number; id: number; }

export const ckey = (cx: number, cz: number, dim = 0) => `${dim}:${cx},${cz}`;
const idx = (x: number, y: number, z: number) => (x & 15) | ((z & 15) << 4) | (y << 8);

interface NoiseSet {
  cont: Noise2; mtn: Noise2; hills: Noise2; det: Noise2; river: Noise2;
  temp: Noise2; hum: Noise2; dark: Noise2; birch: Noise2; veg: Noise2;
  cave: Noise3; cave2: Noise3; ore: Noise3;
}
function makeNoise(seed: number): NoiseSet {
  return {
    cont: new Noise2(seed), mtn: new Noise2(seed ^ 0x1234), hills: new Noise2(seed ^ 0x2345),
    det: new Noise2(seed ^ 0x3456), river: new Noise2(seed ^ 0x4567), temp: new Noise2(seed ^ 0x5678),
    hum: new Noise2(seed ^ 0x6789), dark: new Noise2(seed ^ 0x789a), birch: new Noise2(seed ^ 0x89ab),
    veg: new Noise2(seed ^ 0x9abc), cave: new Noise3(seed ^ 0xabcd), cave2: new Noise3(seed ^ 0xbcde),
    ore: new Noise3(seed ^ 0xcdef),
  };
}

export class World {
  seed: number; dim: number;
  n: NoiseSet;
  chunks = new Map<string, Chunk>();
  edits = new Map<string, Record<number, number>>();
  containers = new Map<string, (ItemStack | null)[] | { in: ItemStack | null; fuel: ItemStack | null; out: ItemStack | null; prog: number; fuelLeft: number }>();
  lootKind = new Map<string, LootKind>();
  villages: { x: number; z: number; r: number; id: string }[] = [];
  barrows: { x: number; y: number; z: number; id: string }[] = [];
  ruins: { x: number; z: number; id: string }[] = [];
  portals: { x: number; y: number; z: number }[] = [];
  npcSpawns: { x: number; y: number; z: number; type: string; name?: string; trade?: string }[] = [];
  dirty = new Set<string>();
  private genQueue: { cx: number; cz: number; d: number }[] = [];
  fallers: { x: number; y: number; z: number; id: number; t: number }[] = [];
  private villageSeen = new Set<string>();
  onVillageSeen?: (x: number, z: number) => void;
  onBarrowSeen?: (x: number, z: number) => void;
  onRuinSeen?: (x: number, z: number) => void;

  constructor(seed: number, dim = 0) {
    this.seed = seed >>> 0; this.dim = dim;
    this.n = makeNoise(this.seed);
  }

  // ---------- terrain math (usable without chunks) ----------
  baseHeight(x: number, z: number): number {
    const n = this.n;
    const land = n.cont.fbm(x * 0.0016, z * 0.0016, 4) * 0.5 + 0.5;
    const m = n.mtn.ridge(x * 0.0035 + 91, z * 0.0035, 4);
    const h = n.hills.fbm(x * 0.011, z * 0.011, 3);
    const d = n.det.fbm(x * 0.05, z * 0.05, 2) * 1.6;
    const landF = smooth((land - 0.44) / 0.2);
    let hh = 17 + land * 13 + m * m * 30 * landF + h * 4.5 + d;
    if (land < 0.42) hh = 10 + land * 16;
    const rv = n.river.fbm(x * 0.0055 + 300, z * 0.0055, 2);
    if (Math.abs(rv) < 0.05 && land >= 0.42) hh = Math.min(hh, WATER_Y - 3 + Math.abs(rv) * 60);
    return clamp(Math.round(hh), 4, 58);
  }
  tempAt(x: number, z: number): number {
    const lat = (Math.sin(z * 0.00035) + 1) * 0.18;
    return clamp(this.n.temp.fbm(x * 0.0019 + 700, z * 0.0019, 3) * 0.5 + 0.5 + lat, 0, 1);
  }
  humAt(x: number, z: number): number {
    return clamp(this.n.hum.fbm(x * 0.0023 + 1300, z * 0.0023, 3) * 0.5 + 0.5, 0, 1);
  }
  biomeAt(x: number, z: number): number {
    if (this.dim === 1) {
      const g = this.n.dark.fbm(x * 0.02 + 77, z * 0.02, 2) * 0.5 + 0.5;
      return g > 0.62 ? BIO.GROTTO : BIO.HOLLOW;
    }
    const h = this.baseHeight(x, z), t = this.tempAt(x, z), hu = this.humAt(x, z);
    if (h >= 49) return t < 0.6 ? BIO.SNOW : BIO.MOUNTAIN;
    if (h >= 39) return BIO.MOUNTAIN;
    if (h <= WATER_Y + 1) return BIO.BEACH;
    if (hu > 0.66 && h <= 26) return BIO.SWAMP;
    if (t >= 0.66 && hu < 0.4) return BIO.BADLANDS;
    if (t <= 0.32) return BIO.PINE;
    const dk = this.n.dark.fbm(x * 0.008 + 55, z * 0.008, 2) * 0.5 + 0.5;
    if (dk > 0.6 && hu > 0.5) return BIO.DARK;
    if (hu >= 0.55) return BIO.FOREST;
    const bi = this.n.birch.fbm(x * 0.009 + 33, z * 0.009, 2) * 0.5 + 0.5;
    if (hu >= 0.42 && bi > 0.55) return BIO.BIRCH;
    if (h >= 30) return BIO.HILLS;
    return BIO.MEADOW;
  }
  biomeName(x: number, z: number): string {
    const b = this.biomeAt(x, z);
    return BIOMES[b]?.name || "?";
  }

  // ---------- chunk access ----------
  chunkAt(cx: number, cz: number): Chunk | null { return this.chunks.get(ckey(cx, cz, this.dim)) || null; }
  inBounds(y: number): boolean { return y >= 0 && y < HH; }

  getB(x: number, y: number, z: number): number {
    if (y < 0) return B.BEDROCK;
    if (y >= HH) return B.AIR;
    const c = this.chunkAt(x >> 4, z >> 4);
    if (!c) return B.AIR;
    return c.blocks[idx(x, y, z)];
  }
  setB(x: number, y: number, z: number, id: number, record = true): void {
    if (y < 1 || y >= HH) return;
    const cx = x >> 4, cz = z >> 4;
    const c = this.chunkAt(cx, cz);
    if (!c) return;
    const i = idx(x, y, z);
    const old = c.blocks[i];
    if (old === id) return;
    c.blocks[i] = id;
    if (record) {
      const k = ckey(cx, cz, this.dim);
      let e = this.edits.get(k);
      if (!e) { e = {}; this.edits.set(k, e); }
      e[i] = id;
    }
    // heightmap
    if (y >= c.hm[x & 15 | ((z & 15) << 4)] - 1 || id === B.AIR) {
      let hy = HH - 1;
      while (hy > 0 && !this.opaqueAtLocal(c, x & 15, hy, z & 15)) hy--;
      c.hm[(x & 15) | ((z & 15) << 4)] = hy;
    }
    // lights
    const oldL = BLOCKS[old]?.light || 0, newL = BLOCKS[id]?.light || 0;
    if (oldL || newL) {
      c.lights = c.lights.filter(l => !(l.x === x && l.y === y && l.z === z));
      if (newL) c.lights.push({ x, y, z, l: newL });
    }
    this.markDirty(cx, cz);
    // gravity
    const bd = BLOCKS[id];
    if (bd?.gravity) this.fallers.push({ x, y, z, id, t: 0.2 });
    const above = this.getB(x, y + 1, z);
    if (BLOCKS[above]?.gravity) this.fallers.push({ x, y: y + 1, z, id: above, t: 0.25 });
  }
  private opaqueAtLocal(c: Chunk, lx: number, y: number, lz: number): boolean {
    const b = c.blocks[lx | (lz << 4) | (y << 8)];
    return BLOCKS[b]?.opaque || false;
  }
  markDirty(cx: number, cz: number): void {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const k = ckey(cx + dx, cz + dz, this.dim);
      if (this.chunks.has(k)) {
        const ch = this.chunks.get(k)!;
        ch.meshed = false;
        this.dirty.add(k);
      }
    }
  }

  isSolid(x: number, y: number, z: number): boolean {
    return BLOCKS[this.getB(x, y, z)]?.solid || false;
  }
  isFluid(x: number, y: number, z: number): boolean {
    return BLOCKS[this.getB(x, y, z)]?.fluid || false;
  }
  heightAt(x: number, z: number): number {
    const c = this.chunkAt(x >> 4, z >> 4);
    if (c) return c.hm[(x & 15) | ((z & 15) << 4)];
    return this.baseHeight(x, z);
  }
  lightAt(x: number, y: number, z: number): { sky: number; torch: number } {
    const hm = this.heightAt(x, z);
    let sky = y >= hm ? 1 : Math.max(0, 1 - (hm - y) * 0.45);
    if (this.dim === 1) sky = y >= 58 ? 0.5 : 0;
    let torch = 0;
    const cx = x >> 4, cz = z >> 4;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const c = this.chunkAt(cx + dx, cz + dz);
      if (!c) continue;
      for (const L of c.lights) {
        const d = Math.hypot(L.x - x, L.y - y, L.z - z);
        if (d < 9) torch = Math.max(torch, (L.l / 14) * (1 - d / 9));
      }
    }
    return { sky, torch: Math.min(1, torch) };
  }

  ray(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, max: number): RayHit | null {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const stepX = d.x > 0 ? 1 : -1, stepY = d.y > 0 ? 1 : -1, stepZ = d.z > 0 ? 1 : -1;
    const tDX = Math.abs(1 / (d.x || 1e-9)), tDY = Math.abs(1 / (d.y || 1e-9)), tDZ = Math.abs(1 / (d.z || 1e-9));
    let tMX = (d.x > 0 ? (x + 1 - o.x) : (o.x - x)) * tDX;
    let tMY = (d.y > 0 ? (y + 1 - o.y) : (o.y - y)) * tDY;
    let tMZ = (d.z > 0 ? (z + 1 - o.z) : (o.z - z)) * tDZ;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 256 && t <= max; i++) {
      const id = this.getB(x, y, z);
      const bd = BLOCKS[id];
      if (id !== B.AIR && bd && !bd.fluid) return { x, y, z, nx, ny, nz, id };
      if (tMX < tMY && tMX < tMZ) { x += stepX; t = tMX; tMX += tDX; nx = -stepX; ny = 0; nz = 0; }
      else if (tMY < tMZ) { y += stepY; t = tMY; tMY += tDY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tMZ; tMZ += tDZ; nx = 0; ny = 0; nz = -stepZ; }
    }
    return null;
  }

  // ---------- generation queue / streaming ----------
  requestAround(px: number, pz: number, r: number): void {
    const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH);
    const want: { cx: number; cz: number; d: number }[] = [];
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (this.chunkAt(cx, cz)) continue;
      want.push({ cx, cz, d: dx * dx + dz * dz });
    }
    want.sort((a, b) => a.d - b.d);
    const existing = new Set(this.genQueue.map(q => q.cx + "," + q.cz));
    const pcxDir = pcx - (this.lastPcx ?? pcx), pczDir = pcz - (this.lastPcz ?? pcz);
    for (const w of want) {
      if (!existing.has(w.cx + "," + w.cz)) {
        // movement-direction priority boost
        const ahead = (w.cx - pcx) * Math.sign(pcxDir) + (w.cz - pcz) * Math.sign(pczDir);
        this.genQueue.push({ cx: w.cx, cz: w.cz, d: w.d - ahead * 0.5 });
      }
    }
    this.genQueue.sort((a, b) => a.d - b.d);
    if (this.genQueue.length > 400) this.genQueue.length = 400;
    this.lastPcx = pcx; this.lastPcz = pcz;
  }
  private lastPcx: number | null = null; private lastPcz: number | null = null;
  get queueLen(): number { return this.genQueue.length; }

  processGen(budgetMs: number): number {
    const t0 = performance.now();
    let made = 0;
    while (this.genQueue.length && performance.now() - t0 < budgetMs) {
      const q = this.genQueue.shift()!;
      if (this.chunkAt(q.cx, q.cz)) continue;
      this.generateChunk(q.cx, q.cz);
      made++;
    }
    return made;
  }

  unloadFar(px: number, pz: number, r: number): void {
    const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH);
    const kill: string[] = [];
    for (const [k, c] of this.chunks) {
      if (Math.abs(c.cx - pcx) > r + 2 || Math.abs(c.cz - pcz) > r + 2) kill.push(k);
    }
    for (const k of kill) this.chunks.delete(k);
    if (kill.length) this.onUnload?.(kill);
  }
  onUnload?: (keys: string[]) => void;

  ensureLoaded(cx: number, cz: number): Chunk {
    let c = this.chunkAt(cx, cz);
    if (!c) { this.generateChunk(cx, cz); c = this.chunkAt(cx, cz)!; }
    return c;
  }

  // ---------- chunk generation ----------
  generateChunk(cx: number, cz: number): Chunk {
    const c: Chunk = {
      cx, cz, dim: this.dim, blocks: new Uint8Array(CH * HH * CH), hm: new Uint16Array(CH * CH),
      lights: [], generated: true, meshed: false, lastUse: 0,
    };
    if (this.dim === 1) this.genHollows(c); else this.genSurface(c);
    // apply edits
    const e = this.edits.get(ckey(cx, cz, this.dim));
    if (e) for (const k in e) c.blocks[+k] = e[k];
    // recompute hm + lights from final blocks
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      let hy = 0;
      for (let y = HH - 1; y >= 0; y--) {
        const b = c.blocks[lx | (lz << 4) | (y << 8)];
        if (BLOCKS[b]?.opaque) { hy = y; break; }
      }
      c.hm[lx | (lz << 4)] = hy;
    }
    for (let y = 1; y < HH; y++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const b = c.blocks[lx | (lz << 4) | (y << 8)];
      const L = BLOCKS[b]?.light;
      if (L) c.lights.push({ x: cx * 16 + lx, y, z: cz * 16 + lz, l: L });
    }
    this.chunks.set(ckey(cx, cz, this.dim), c);
    this.markDirty(cx, cz);
    return c;
  }

  private setLocal(c: Chunk, x: number, y: number, z: number, id: number): void {
    if (y < 0 || y >= HH) return;
    const lx = x - c.cx * 16, lz = z - c.cz * 16;
    if (lx < 0 || lx > 15 || lz < 0 || lz > 15) return;
    c.blocks[lx | (lz << 4) | (y << 8)] = id;
  }
  private getLocal(c: Chunk, x: number, y: number, z: number): number {
    if (y < 0 || y >= HH) return B.AIR;
    const lx = x - c.cx * 16, lz = z - c.cz * 16;
    if (lx < 0 || lx > 15 || lz < 0 || lz > 15) return this.getB(x, y, z);
    return c.blocks[lx | (lz << 4) | (y << 8)];
  }

  private genSurface(c: Chunk): void {
    const seed = this.seed;
    const x0 = c.cx * 16, z0 = c.cz * 16;
    // structure influence: villages flatten terrain
    const flats: { x: number; z: number; r: number; h: number }[] = [];
    this.forEachRegionStruct(c, "village", (vx, vz, r, h) => flats.push({ x: vx, z: vz, r: r + 6, h }));
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const wx = x0 + lx, wz = z0 + lz;
      let h = this.baseHeight(wx, wz);
      for (const f of flats) {
        const d = Math.hypot(wx - f.x, wz - f.z);
        if (d < f.r) {
          const t = smooth(1 - d / f.r);
          h = Math.round(h * (1 - t) + f.h * t);
        }
      }
      const biome = this.biomeAt(wx, wz);
      const t = this.tempAt(wx, wz);
      // column
      for (let y = 0; y <= Math.max(h, WATER_Y); y++) {
        let id: number = B.AIR;
        if (y === 0) id = B.BEDROCK;
        else if (y <= 2 && rand3(seed ^ 0x77, wx, y, wz) < 0.6) id = B.BEDROCK;
        else if (y <= h) {
          if (y === h) id = groundTop(biome, h);
          else if (y >= h - 3) id = groundSub(biome);
          else id = B.STONE;
        } else if (y <= WATER_Y) id = B.WATER;
        // caves
        if (id === B.STONE || (id !== B.AIR && id !== B.WATER && id !== B.BEDROCK && y < h - 1)) {
          const cv = this.n.cave.fbm(wx * 0.055, y * 0.075, wz * 0.055, 2);
          const cv2 = this.n.cave2.fbm(wx * 0.022, y * 0.03, wz * 0.022, 2);
          if (y > 3 && y < h - 3 && (cv > 0.58 || (cv2 > 0.66 && y < 30))) id = B.AIR;
        }
        // ores
        if (id === B.STONE) {
          const o = rand3(seed ^ 0x88, wx, y, wz);
          if (y < 17 && o < 0.0035) id = B.EMBER_ORE;
          else if (y < 22 && o > 0.9965) id = B.GOLD_ORE;
          else if (y < 34 && o < 0.011) id = B.IRON_ORE;
          else if (y < 46 && o > 0.985) id = B.COAL_ORE;
          else if (o > 0.993 && o < 0.995 && y < 40) id = B.GRAVEL;
        }
        if (id !== B.AIR) c.blocks[lx | (lz << 4) | (y << 8)] = id;
      }
      c.hm[lx | (lz << 4)] = Math.max(h, WATER_Y);
    }
    // vegetation & trees (scan beyond borders)
    this.genVegetation(c);
    // structures
    this.forEachRegionStruct(c, "village", (vx, vz, r, h, rr) => this.buildVillage(c, vx, vz, h, rr));
    this.forEachRegionStruct(c, "ruin", (vx, vz, _r, h, rr) => this.buildRuin(c, vx, vz, h, rr));
    this.forEachRegionStruct(c, "tower", (vx, vz, _r, h) => this.buildTower(c, vx, vz, h));
    this.forEachRegionStruct(c, "barrow", (vx, vz, _r, h, rr) => this.buildBarrow(c, vx, vz, h, rr));
    this.forEachRegionStruct(c, "portal", (vx, vz, _r, h) => this.buildPortalRuin(c, vx, vz, h));
  }

  private genHollows(c: Chunk): void {
    const seed = this.seed, x0 = c.cx * 16, z0 = c.cz * 16;
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const wx = x0 + lx, wz = z0 + lz;
      const surf = 36 + Math.round(this.n.hills.fbm(wx * 0.02, wz * 0.02, 3) * 5);
      const grotto = this.n.dark.fbm(wx * 0.02 + 77, wz * 0.02, 2) * 0.5 + 0.5 > 0.62;
      for (let y = 0; y < HH; y++) {
        let id: number = B.AIR;
        if (y >= 60) id = B.BEDROCK;
        else if (y <= 1) id = B.BEDROCK;
        else if (y <= surf) {
          id = y === surf ? (grotto ? B.MOSSY : B.STONE) : B.STONE;
          if (y < surf - 1) {
            const cv = this.n.cave.fbm(wx * 0.045, y * 0.06, wz * 0.045, 2);
            const big = this.n.cave2.fbm(wx * 0.02, y * 0.028, wz * 0.02, 2);
            if (y > 3 && (cv > 0.42 || big > 0.52)) id = B.AIR;
          }
          if (id === B.STONE) {
            const o = rand3(seed ^ 0x99, wx, y, wz);
            if (o < 0.012) id = B.EMBER_ORE;
            else if (o > 0.988) id = B.EMBERSTONE;
            else if (o > 0.975 && o < 0.98) id = B.GOLD_ORE;
          }
          if (y <= 6 && id === B.AIR) id = B.EMBERFLUID;
        }
        if (id !== B.AIR) c.blocks[lx | (lz << 4) | (y << 8)] = id;
      }
      c.hm[lx | (lz << 4)] = surf;
      // surface scatter
      const top = surf + 1;
      if (top < HH) {
        const r = rand2(seed ^ 0xaa, wx, wz);
        if (grotto && r < 0.22) { c.blocks[lx | (lz << 4) | (top << 8)] = B.GLOWSHROOM; }
        else if (!grotto && r < 0.05) c.blocks[lx | (lz << 4) | (top << 8)] = B.MUSHROOM;
        else if (r > 0.985) { c.blocks[lx | (lz << 4) | (top << 8)] = B.DEADBUSH; }
      }
    }
  }

  private genVegetation(c: Chunk): void {
    const seed = this.seed, x0 = c.cx * 16, z0 = c.cz * 16;
    for (let wz = z0 - 3; wz < z0 + 19; wz++) for (let wx = x0 - 3; wx < x0 + 19; wx++) {
      const biome = this.biomeAt(wx, wz);
      const h = this.heightAtGen(wx, wz, c);
      if (h <= WATER_Y) {
        if (biome === BIO.SWAMP && rand2(seed ^ 0xb1, wx, wz) < 0.3) {
          for (let y = WATER_Y + 1; y <= h + 3; y++) this.setLocal(c, wx, y, wz, B.REED);
        }
        continue;
      }
      const r = rand2(seed ^ 0xb2, wx, wz);
      const top = this.getLocal(c, wx, h, wz);
      // trees
      const dens = biome === BIO.FOREST ? 0.06 : biome === BIO.DARK ? 0.1 : biome === BIO.PINE ? 0.07 :
        biome === BIO.BIRCH ? 0.055 : biome === BIO.SWAMP ? 0.02 : biome === BIO.MEADOW ? 0.004 :
        biome === BIO.HILLS ? 0.006 : biome === BIO.SNOW ? 0.03 : 0;
      if (dens && r < dens && top !== B.WATER) {
        this.plantTree(c, wx, h + 1, wz, biome, rand2(seed ^ 0xb3, wx, wz));
        continue;
      }
      if (top === B.WATER || top === B.BEDROCK) continue;
      const vegR = this.n.veg.fbm(wx * 0.09, wz * 0.09, 2) * 0.5 + 0.5;
      if (biome === BIO.MEADOW || biome === BIO.HILLS) {
        if (vegR > 0.45 && r < 0.34) this.setLocal(c, wx, h + 1, wz, B.TALLGRASS);
        else if (r > 0.985) this.setLocal(c, wx, h + 1, wz, r > 0.993 ? B.FLOWER_Y : B.FLOWER_R);
      } else if (biome === BIO.FOREST || biome === BIO.BIRCH) {
        if (vegR > 0.4 && r < 0.22) this.setLocal(c, wx, h + 1, wz, B.TALLGRASS);
        else if (r > 0.99) this.setLocal(c, wx, h + 1, wz, B.MUSHROOM);
        else if (r > 0.975 && r < 0.985) this.setLocal(c, wx, h + 1, wz, B.FLOWER_R);
      } else if (biome === BIO.DARK) {
        if (r < 0.16) this.setLocal(c, wx, h + 1, wz, B.MUSHROOM);
        else if (r < 0.24) this.setLocal(c, wx, h + 1, wz, B.TALLGRASS);
      } else if (biome === BIO.SWAMP) {
        if (r < 0.12) this.setLocal(c, wx, h + 1, wz, B.TALLGRASS);
        else if (r > 0.985) this.setLocal(c, wx, h + 1, wz, B.MUSHROOM);
      } else if (biome === BIO.BADLANDS) {
        if (r < 0.05) this.setLocal(c, wx, h + 1, wz, B.DEADBUSH);
      } else if (biome === BIO.SNOW) {
        if (r < 0.03) this.setLocal(c, wx, h + 1, wz, B.PINE_LEAVES === 0 ? B.AIR : B.SNOW);
      }
    }
  }
  private heightAtGen(wx: number, wz: number, c: Chunk): number {
    const lx = wx - c.cx * 16, lz = wz - c.cz * 16;
    if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) return c.hm[lx | (lz << 4)];
    return this.baseHeight(wx, wz);
  }

  private plantTree(c: Chunk, x: number, y: number, z: number, biome: number, rv: number): void {
    const variant = Math.floor(rv * 3);
    if (biome === BIO.PINE || biome === BIO.SNOW) {
      const h = 6 + Math.floor(rv * 4);
      for (let i = 0; i < h; i++) this.setLocal(c, x, y + i, z, B.PINE_LOG);
      for (let i = 2; i < h + 1; i++) {
        const rad = i > h - 3 ? 0 : Math.max(0, Math.floor((h - i) / 2) - (variant === 0 ? 0 : 1)) + (i < 4 ? 1 : 0);
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > rad + 1) continue;
          if (dx === 0 && dz === 0 && i < h) continue;
          if (this.getLocal(c, x + dx, y + i, z + dz) === B.AIR) this.setLocal(c, x + dx, y + i, z + dz, B.PINE_LEAVES);
        }
      }
      this.setLocal(c, x, y + h, z, B.PINE_LEAVES);
    } else if (biome === BIO.BIRCH) {
      const h = 5 + Math.floor(rv * 3);
      for (let i = 0; i < h; i++) this.setLocal(c, x, y + i, z, B.BIRCH_LOG);
      const rad = 2;
      for (let dy = h - 3; dy <= h; dy++) for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy === h) continue;
        if (dx === 0 && dz === 0 && dy < h) continue;
        if (this.getLocal(c, x + dx, y + dy, z + dz) === B.AIR) this.setLocal(c, x + dx, y + dy, z + dz, B.BIRCH_LEAVES);
      }
    } else if (biome === BIO.DARK) {
      const h = 7 + Math.floor(rv * 4);
      for (let i = 0; i < h; i++) this.setLocal(c, x, y + i, z, B.DARK_LOG);
      for (let dy = h - 3; dy <= h + 1; dy++) {
        const rad = dy > h - 1 ? 1 : 2;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (dx === 0 && dz === 0 && dy <= h) continue;
          if (this.getLocal(c, x + dx, y + dy, z + dz) === B.AIR) this.setLocal(c, x + dx, y + dy, z + dz, B.DARK_LEAVES);
        }
      }
    } else {
      // oak with branch variants
      const h = 4 + Math.floor(rv * 3);
      for (let i = 0; i < h; i++) this.setLocal(c, x, y + i, z, B.LOG);
      if (variant === 2 && h > 4) { // branches
        this.setLocal(c, x + 1, y + h - 2, z, B.LOG);
        this.setLocal(c, x - 1, y + h - 3, z, B.LOG);
      }
      const rad = variant === 0 ? 2 : 3;
      for (let dy = h - 2; dy <= h + 1; dy++) for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        const d = Math.abs(dx) + Math.abs(dz) + Math.abs(dy - h) * 0.6;
        if (d > rad + 1.2) continue;
        if (dx === 0 && dz === 0 && dy <= h) continue;
        if (this.getLocal(c, x + dx, y + dy, z + dz) === B.AIR) this.setLocal(c, x + dx, y + dy, z + dz, B.LEAVES);
      }
    }
  }

  // ---------- structures ----------
  private forEachRegionStruct(c: Chunk, kind: string, fn: (x: number, z: number, r: number, h: number, rr: () => number) => void): void {
    const conf = ({
      village: { size: 12, salt: 0x111, prob: 0.3 },
      ruin: { size: 7, salt: 0x222, prob: 0.3 },
      tower: { size: 9, salt: 0x333, prob: 0.22 },
      barrow: { size: 26, salt: 0x444, prob: 0.7 },
      portal: { size: 30, salt: 0x555, prob: 0.55 },
    } as Record<string, { size: number; salt: number; prob: number }>)[kind];
    const rcx = Math.floor(c.cx / conf.size), rcz = Math.floor(c.cz / conf.size);
    for (let drx = -1; drx <= 1; drx++) for (let drz = -1; drz <= 1; drz++) {
      const rx = rcx + drx, rz = rcz + drz;
      const r1 = rand2(this.seed ^ conf.salt, rx, rz);
      if (r1 > conf.prob) continue;
      const ox = rx * conf.size * 16 + 8 + Math.floor(rand2(this.seed ^ conf.salt ^ 1, rx, rz) * (conf.size * 16 - 16));
      const oz = rz * conf.size * 16 + 8 + Math.floor(rand2(this.seed ^ conf.salt ^ 2, rx, rz) * (conf.size * 16 - 16));
      // biome gate
      const biome = this.biomeAt(ox, oz);
      if (kind === "village" && !(biome === BIO.MEADOW || biome === BIO.HILLS || biome === BIO.BIRCH || biome === BIO.FOREST)) continue;
      if (kind === "ruin" && (biome === BIO.SEA || biome === BIO.BEACH)) continue;
      if (kind === "barrow" && !(biome === BIO.MOUNTAIN || biome === BIO.SNOW || biome === BIO.BADLANDS || biome === BIO.HILLS)) continue;
      if (kind === "portal" && !(biome === BIO.SWAMP || biome === BIO.DARK || biome === BIO.BADLANDS)) continue;
      if (kind === "tower" && biome !== BIO.MEADOW && biome !== BIO.HILLS && biome !== BIO.PINE) continue;
      const rad = kind === "village" ? 18 : kind === "barrow" ? 10 : 6;
      // intersects chunk?
      if (ox + rad < c.cx * 16 || ox - rad > c.cx * 16 + 15 || oz + rad < c.cz * 16 || oz - rad > c.cz * 16 + 15) {
        // still record village/barrow existence lists (cheap, deterministic) but skip build
        this.recordStruct(kind, ox, oz, rx, rz);
        continue;
      }
      const h = this.baseHeight(ox, oz);
      if (h <= WATER_Y) continue;
      const rr = mulberry((this.seed ^ conf.salt ^ 3) + rx * 73856093 + rz * 19349663);
      this.recordStruct(kind, ox, oz, rx, rz, h);
      fn(ox, oz, rad, h, rr);
    }
  }
  private recordStruct(kind: string, x: number, z: number, rx: number, rz: number, h = 0): void {
    const id = `${kind}_${rx}_${rz}`;
    if (kind === "village" && !this.villages.find(v => v.id === id)) {
      this.villages.push({ x, z, r: 18, id });
    } else if (kind === "barrow" && !this.barrows.find(b => b.id === id)) {
      this.barrows.push({ x, y: h, z, id });
      this.onBarrowSeen?.(x, z);
    } else if (kind === "ruin" && !this.ruins.find(r => r.id === id)) {
      this.ruins.push({ x, z, id });
      this.onRuinSeen?.(x, z);
    }
  }

  private buildVillage(c: Chunk, vx: number, vz: number, h: number, rr: () => number): void {
    const houses = 4 + Math.floor(rr() * 3);
    const placed: { x: number; z: number; w: number; d: number }[] = [];
    // well at center
    this.buildWell(c, vx, vz, h);
    this.setLocal(c, vx + 3, h + 1, vz, B.BOARD);
    for (let i = 0; i < houses; i++) {
      const ang = (i / houses) * Math.PI * 2 + rr() * 0.5;
      const dist = 7 + rr() * 7;
      const hx = Math.round(vx + Math.cos(ang) * dist), hz = Math.round(vz + Math.sin(ang) * dist);
      const hh = this.baseHeight(hx, hz);
      if (hh <= WATER_Y) continue;
      const w = 4 + Math.floor(rr() * 2), d = 4 + Math.floor(rr() * 2);
      if (placed.some(p => Math.abs(p.x - hx) < p.w + 2 && Math.abs(p.z - hz) < p.d + 2)) continue;
      placed.push({ x: hx, z: hz, w, d });
      this.buildHouse(c, hx, hz, hh, w, d, rr, i === 0);
    }
    // farm
    const fx = vx - 8, fz = vz + 4;
    const fh = this.baseHeight(fx, fz);
    if (fh > WATER_Y) for (let dx = 0; dx < 5; dx++) for (let dz = 0; dz < 4; dz++) {
      this.setLocal(c, fx + dx, fh, fz + dz, B.DIRT);
      if ((dx + dz) % 2 === 0) this.setLocal(c, fx + dx, fh + 1, fz + dz, rr() < 0.7 ? B.TALLGRASS : B.HAY === 0 ? B.AIR : B.HAY);
      else if (rr() < 0.3) this.setLocal(c, fx + dx, fh + 1, fz + dz, B.TALLGRASS);
    }
    if (!this.villageSeen.has(c.cx + "," + c.cz)) {
      this.villageSeen.add(c.cx + "," + c.cz);
      this.onVillageSeen?.(vx, vz);
    }
    // NPCs
    const already = this.npcSpawns.some(s => Math.abs(s.x - vx) < 30 && Math.abs(s.z - vz) < 30);
    if (!already) {
      this.npcSpawns.push({ x: vx + 2, y: h + 1, z: vz + 2, type: "elder", name: "Eldric the Grey", });
      this.npcSpawns.push({ x: vx - 3, y: h + 1, z: vz - 2, type: "smith", name: "Maud the Smith", trade: "smith" });
      this.npcSpawns.push({ x: vx + 4, y: h + 1, z: vz - 3, type: "villager", name: "Goodwife Alys" });
      this.npcSpawns.push({ x: vx - 4, y: h + 1, z: vz + 3, type: "villager", name: "Old Tom" });
    }
  }
  private buildHouse(c: Chunk, x: number, z: number, h: number, w: number, d: number, rr: () => number, isElder: boolean): void {
    const wallH = 3;
    for (let dx = -1; dx <= w; dx++) for (let dz = -1; dz <= d; dz++) this.setLocal(c, x + dx, h, z + dz, B.COBBLE);
    for (let y = 1; y <= wallH; y++) for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) {
      const edge = dx === 0 || dz === 0 || dx === w - 1 || dz === d - 1;
      if (!edge) { if (y === 1) this.setLocal(c, x + dx, h + y, z + dz, B.PLANKS); continue; }
      let id: number = (y === 1 && (dx + dz) % 2 === 0) ? B.COBBLE : B.PLANKS;
      // door on south face
      if (dz === 0 && dx === Math.floor(w / 2) && y <= 2) id = y === 1 ? B.DOOR_B : B.DOOR_T;
      // window
      if (y === 2 && ((dx === 0 && dz === Math.floor(d / 2)) || (dx === w - 1 && dz === Math.floor(d / 2)))) id = B.FENCE;
      this.setLocal(c, x + dx, h + y, z + dz, id);
    }
    // thatch roof (stepped)
    for (let step = 0; step <= Math.ceil(w / 2); step++) {
      for (let dz = -1; dz <= d; dz++) for (let dx = step - 1; dx <= w - step; dx++) {
        if (step === 0) this.setLocal(c, x + dx, h + wallH + 1, z + dz, B.PLANKS);
        else this.setLocal(c, x + dx, h + wallH + 1 + step, z + dz, B.THATCH);
      }
    }
    // interior
    const ix = x + 1, iz = z + 1;
    this.setLocal(c, ix, h + 1, iz, isElder ? B.BOOKS : B.BARREL);
    if (w > 4) this.setLocal(c, x + w - 2, h + 1, iz, B.CHEST);
    this.setLocal(c, x + w - 2, h + 1, z + d - 2, B.BED_FOOT);
    this.setLocal(c, x + w - 1, h + 1, z + d - 2, B.BED_HEAD);
    const contKey = `${this.dim}:${x + (w > 4 ? w - 2 : 1)},${h + 1},${iz}`;
    this.lootKind.set(contKey, "village");
    this.setLocal(c, ix, h + 2, iz + 1, B.TORCH);
    if (isElder) this.setLocal(c, x + 1, h + 1, z + d - 2, B.TABLE);
  }
  private buildWell(c: Chunk, x: number, z: number, h: number): void {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      this.setLocal(c, x + dx, h, z + dz, B.WELL);
      this.setLocal(c, x + dx, h - 1, z + dz, B.WATER);
    }
    this.setLocal(c, x, h, z, B.WATER);
    this.setLocal(c, x, h + 1, z, B.AIR);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      this.setLocal(c, x + dx, h + 1, z + dz, B.FENCE);
      this.setLocal(c, x + dx, h + 2, z + dz, B.FENCE);
    }
    for (let dx = -1; dx <= 1; dx++) this.setLocal(c, x + dx, h + 3, z, B.THATCH);
    this.setLocal(c, x, h + 2, z + 1, B.FENCE);
  }
  private buildRuin(c: Chunk, x: number, z: number, h: number, rr: () => number): void {
    const w = 6 + Math.floor(rr() * 3), d = 6 + Math.floor(rr() * 3);
    for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) {
      this.setLocal(c, x + dx, h, z + dz, B.MOSSY);
      const edge = dx === 0 || dz === 0 || dx === w - 1 || dz === d - 1;
      if (edge) {
        const wallH = 1 + Math.floor(rr() * 3);
        if (rr() < 0.75) for (let y = 1; y <= wallH; y++) this.setLocal(c, x + dx, h + y, z + dz, rr() < 0.4 ? B.MOSSY : B.COBBLE);
      } else {
        if (rr() < 0.15) this.setLocal(c, x + dx, h + 1, z + dz, B.GRAVE);
        if (rr() < 0.08) this.setLocal(c, x + dx, h + 1, z + dz, B.DEADBUSH);
      }
    }
    const cxr = x + Math.floor(w / 2), czr = z + Math.floor(d / 2);
    this.setLocal(c, cxr, h + 1, czr, B.CHEST);
    this.lootKind.set(`${this.dim}:${cxr},${h + 1},${czr}`, "ruin");
    if (rr() < 0.5) { this.setLocal(c, cxr + 1, h + 1, czr, B.TORCH); }
  }
  private buildTower(c: Chunk, x: number, z: number, h: number): void {
    for (let y = 0; y < 11; y++) for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 3; dz++) {
      const edge = dx === 0 || dz === 0 || dx === 2 || dz === 2;
      if (y === 0 || edge) this.setLocal(c, x + dx, h + y, z + dz, B.COBBLE);
    }
    for (let dx = -1; dx < 4; dx++) for (let dz = -1; dz < 4; dz++) this.setLocal(c, x + dx, h + 11, z + dz, B.PLANKS);
    this.setLocal(c, x + 1, h + 12, z + 1, B.LANTERN);
    this.setLocal(c, x + 1, h + 1, z, B.AIR);
    this.setLocal(c, x + 1, h + 2, z, B.AIR);
  }
  private buildBarrow(c: Chunk, x: number, z: number, h: number, rr: () => number): void {
    // entrance mound + descending passage to boss chamber
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const mound = Math.max(0, 3 - Math.abs(dx) - Math.abs(dz) + 1);
      for (let y = 1; y <= mound; y++) this.setLocal(c, x + dx, h + y, z + dz, B.DIRT);
    }
    const doorY = h + 1;
    this.setLocal(c, x - 1, doorY, z + 3, B.EMBERSTONE);
    this.setLocal(c, x - 1, doorY + 1, z + 3, B.EMBERSTONE);
    this.setLocal(c, x + 1, doorY, z + 3, B.EMBERSTONE);
    this.setLocal(c, x + 1, doorY + 1, z + 3, B.EMBERSTONE);
    this.setLocal(c, x - 1, doorY + 2, z + 3, B.EMBERSTONE);
    this.setLocal(c, x, doorY + 2, z + 3, B.EMBERSTONE);
    this.setLocal(c, x + 1, doorY + 2, z + 3, B.EMBERSTONE);
    this.setLocal(c, x, doorY, z + 3, B.AIR);
    this.setLocal(c, x, doorY + 1, z + 3, B.AIR);
    this.setLocal(c, x, doorY, z + 2, B.DOOR_B);
    this.setLocal(c, x, doorY + 1, z + 2, B.DOOR_T);
    // stepped passage descending into the hill
    for (let step = 0; step < 5; step++) {
      this.carveTunnel(c, x, doorY - step, z + 1 - step);
    }
    // boss chamber 9x9
    const cy = doorY - 5, czRoom = z - 9;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) for (let dy = 0; dy < 5; dy++) {
      const shell = dx === -4 || dz === -4 || dx === 4 || dz === 4 || dy === 0 || dy === 4;
      this.setLocal(c, x + dx, cy + dy, czRoom + dz, shell ? (rr() < 0.3 ? B.MOSSY : B.BRICK) : B.AIR);
    }
    // connect passage to chamber
    for (let dz = z - 4; dz >= czRoom + 4; dz--) this.carveTunnel(c, x, cy + 1, dz);
    const fy = cy + 1; // chamber floor walking level
    this.setLocal(c, x, fy, czRoom, B.GRAVE);
    this.setLocal(c, x - 2, fy, czRoom - 2, B.CHEST);
    this.lootKind.set(`${this.dim}:${x - 2},${fy},${czRoom - 2}`, "barrow");
    this.setLocal(c, x + 2, fy, czRoom - 2, B.TORCH);
    this.setLocal(c, x - 2, fy, czRoom + 2, B.TORCH);
    this.setLocal(c, x + 2, fy, czRoom + 2, B.TORCH);
    this.setLocal(c, x, fy, czRoom - 3, B.EMBERSTONE);
    // record boss spawn point
    const key = `barrow_${Math.floor(x / (26 * 16))}_${Math.floor(z / (26 * 16))}`;
    if (!this.bossPoints) this.bossPoints = new Map();
    this.bossPoints.set(key, { x: x + 0.5, y: fy + 0.5, z: czRoom + 0.5 });
  }
  bossPoints?: Map<string, { x: number; y: number; z: number }>;
  private carveTunnel(c: Chunk, x: number, y: number, z: number): void {
    for (let dx = 0; dx <= 1; dx++) {
      this.setLocal(c, x - 1 + dx, y - 1, z, B.COBBLE);
      this.setLocal(c, x - 1 + dx, y, z, B.AIR);
      this.setLocal(c, x - 1 + dx, y + 1, z, B.AIR);
    }
  }
  private buildPortalRuin(c: Chunk, x: number, z: number, h: number): void {
    for (let dx = -2; dx <= 2; dx++) for (let dz = -1; dz <= 1; dz++) this.setLocal(c, x + dx, h, z + dz, B.MOSSY);
    for (let y = 1; y <= 4; y++) {
      this.setLocal(c, x - 2, h + y, z, B.EMBERSTONE);
      this.setLocal(c, x + 2, h + y, z, B.EMBERSTONE);
    }
    for (let dx = -2; dx <= 2; dx++) this.setLocal(c, x + dx, h + 5, z, B.EMBERSTONE);
    for (let y = 1; y <= 4; y++) for (let dx = -1; dx <= 1; dx++) this.setLocal(c, x + dx, h + y, z, B.PORTAL);
    this.portals.push({ x, y: h + 2, z });
    this.setLocal(c, x - 3, h + 1, z, B.TORCH);
    this.setLocal(c, x + 3, h + 1, z, B.TORCH);
    this.setLocal(c, x, h + 1, z + 2, B.GRAVE);
  }

  // ---------- ticking ----------
  tick(dt: number): void {
    if (!this.fallers.length) return;
    for (let i = this.fallers.length - 1; i >= 0; i--) {
      const f = this.fallers[i];
      f.t -= dt;
      if (f.t > 0) continue;
      const below = this.getB(f.x, f.y - 1, f.z);
      if (BLOCKS[below]?.solid) { this.fallers.splice(i, 1); continue; }
      this.setB(f.x, f.y, f.z, B.AIR, false);
      f.y -= 1;
      f.t = 0.09;
      if (f.y <= 1 || BLOCKS[this.getB(f.x, f.y - 1, f.z)]?.solid) {
        this.setB(f.x, f.y, f.z, f.id, false);
        this.fallers.splice(i, 1);
      } else {
        this.setB(f.x, f.y, f.z, f.id, false);
        this.setB(f.x, f.y + 1, f.z, B.AIR, false);
      }
    }
  }

  // ---------- serialization ----------
  serializeEdits(): Record<string, Record<number, number>> {
    const out: Record<string, Record<number, number>> = {};
    for (const [k, v] of this.edits) out[k] = v;
    return out;
  }
  loadEdits(data: Record<string, Record<number, number>>): void {
    this.edits = new Map(Object.entries(data || {}));
  }
  serializeContainers(): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of this.containers) out[k] = v;
    return out;
  }
  loadContainers(data: Record<string, any>): void {
    for (const k in (data || {})) this.containers.set(k, data[k]);
  }
  containerKey(x: number, y: number, z: number): string { return `${this.dim}:${x},${y},${z}`; }
  chestAt(x: number, y: number, z: number): (ItemStack | null)[] {
    const k = this.containerKey(x, y, z);
    let arr = this.containers.get(k) as (ItemStack | null)[] | undefined;
    if (!arr || !Array.isArray(arr)) {
      arr = new Array(18).fill(null);
      const kind = this.lootKind.get(k);
      if (kind) {
        const loot = rollLootFor(kind, seedFromKey(this.seed, k));
        for (let i = 0; i < loot.length && i < 18; i++) arr[i] = loot[i];
      }
      this.containers.set(k, arr);
    }
    return arr;
  }
  furnaceAt(x: number, y: number, z: number): { in: ItemStack | null; fuel: ItemStack | null; out: ItemStack | null; prog: number; fuelLeft: number } {
    const k = this.containerKey(x, y, z);
    let f = this.containers.get(k) as any;
    if (!f || Array.isArray(f)) {
      f = { in: null, fuel: null, out: null, prog: 0, fuelLeft: 0 };
      this.containers.set(k, f);
    }
    return f;
  }
}

function rollLootFor(kind: LootKind, seed: number) {
  // lazy import avoidance
  return rollLootImpl(kind, seed);
}
import { rollLoot as rollLootImpl } from "./items";
function seedFromKey(seed: number, k: string): number {
  let h = seed;
  for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619);
  return h >>> 0;
}

function smooth(t: number): number { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function clamp(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v; }
function groundTop(biome: number, h: number): number {
  if (h <= WATER_Y + 1) return B.SAND;
  switch (biome) {
    case BIO.SNOW: return B.SNOW_GRASS;
    case BIO.PINE: return B.GRASS;
    case BIO.BADLANDS: return B.SAND;
    case BIO.SWAMP: return B.DIRT;
    case BIO.MOUNTAIN: return h > 46 ? B.SNOW : B.STONE;
    default: return B.GRASS;
  }
}
function groundSub(biome: number): number {
  if (biome === BIO.BADLANDS || biome === BIO.BEACH) return B.SAND;
  if (biome === BIO.MOUNTAIN || biome === BIO.SNOW) return B.STONE;
  return B.DIRT;
}

