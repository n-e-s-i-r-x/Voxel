// Emberfall — game orchestrator: loop, input, combat, quests, saving, dimensions, events.
import { Renderer, Box, forwardVec } from "./engine";
import { World, CH, HH, WATER_Y, ckey, BIO, RayHit } from "./world";
import { B, BLOCKS } from "./blocks";
import { EntityManager, Mob } from "./entities";
import { Player, Input } from "./player";
import { AudioSys } from "./audio";
import { ItemStack, ITEMS, I, RECIPES, Recipe, SMELTS, FUEL, TOOL_DUR, MERCHANT_TRADES, SMITH_TRADES, maxDur } from "./items";
import { hashStr, mulberry } from "./noise";
import { useSyncExternalStore } from "react";

const DAY_LEN = 840; // seconds per full day
const LS_SETTINGS = "emberfall.settings.v1";
const LS_WORLDS = "emberfall.worlds.v1";
const LS_BOOTED = "emberfall.booted.v1";

export interface Settings {
  platform: "pc" | "mobile";
  renderDist: number; simDist: number;
  fov: number; sens: number;
  volMaster: number; volMusic: number; volSfx: number;
  preset: string;
  fog: number; particles: number; fancyWater: boolean; viewBob: boolean;
  showCoords: boolean; dynamicRes: boolean;
  binds: Record<string, string>;
  touchScale: number; touchOpacity: number; touchLefty: boolean;
}
const DEFAULT_BINDS: Record<string, string> = {
  forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD", jump: "Space",
  sprint: "ShiftLeft", sneak: "ControlLeft", interact: "KeyE", inv: "KeyI",
  drop: "KeyQ", craft: "KeyC", skills: "KeyK", quests: "KeyJ", map: "KeyM",
  debug: "F3", dodge: "KeyL",
};
export const DEFAULT_SETTINGS: Settings = {
  platform: "pc", renderDist: 6, simDist: 5, fov: 75, sens: 1,
  volMaster: 0.8, volMusic: 0.55, volSfx: 0.9, preset: "Balanced",
  fog: 1, particles: 1, fancyWater: true, viewBob: true,
  showCoords: true, dynamicRes: true, binds: { ...DEFAULT_BINDS },
  touchScale: 1, touchOpacity: 0.85, touchLefty: false,
};
export const PRESETS: Record<string, Partial<Settings>> = {
  Potato: { renderDist: 3, simDist: 3, particles: 0.3, fog: 1.4, fancyWater: false, dynamicRes: true },
  Performance: { renderDist: 4, simDist: 4, particles: 0.6, fog: 1.2, fancyWater: false, dynamicRes: true },
  Balanced: { renderDist: 6, simDist: 5, particles: 1, fog: 1, fancyWater: true, dynamicRes: true },
  Quality: { renderDist: 8, simDist: 6, particles: 1, fog: 0.85, fancyWater: true, dynamicRes: false },
  High: { renderDist: 10, simDist: 7, particles: 1, fog: 0.75, fancyWater: true, dynamicRes: false },
  Ultra: { renderDist: 13, simDist: 8, particles: 1, fog: 0.6, fancyWater: true, dynamicRes: false },
};

// ---------------- quests & advancements ----------------
export interface QuestDef { id: string; title: string; desc: string; kind: "main" | "side"; obj: { kind: "gather" | "kill" | "craft" | "visit"; id: number | string; n: number; label: string }[]; reward: { xp: number; coins: number }; }
export const QUESTS: QuestDef[] = [
  { id: "q_flame", title: "First Flame", desc: "The wilds are cold. Gather 6 logs and build a workbench.", kind: "main", obj: [{ kind: "gather", id: B.LOG, n: 6, label: "Gather logs" }, { kind: "craft", id: B.TABLE, n: 1, label: "Craft a workbench" }], reward: { xp: 40, coins: 5 } },
  { id: "q_stone", title: "Beneath the Turf", desc: "Stone tools outlast wood. Mine 10 cobblestone and craft a stone pick.", kind: "main", obj: [{ kind: "gather", id: B.COBBLE, n: 10, label: "Gather cobblestone" }, { kind: "craft", id: I.S_PICK, n: 1, label: "Craft a stone pick" }], reward: { xp: 60, coins: 8 } },
  { id: "q_village", title: "Smoke on the Horizon", desc: "Find a village. Folk there may have work for a wanderer.", kind: "main", obj: [{ kind: "visit", id: "village", n: 1, label: "Find a village" }], reward: { xp: 50, coins: 10 } },
  { id: "q_wolves", title: "Wolves at the Gate", desc: "Eldric: 'Grey wolves took two sheep this week. Thin the pack — 3 of them.'", kind: "main", obj: [{ kind: "kill", id: "wolf", n: 3, label: "Slay wolves" }], reward: { xp: 90, coins: 15 } },
  { id: "q_king", title: "The Old King Under the Hill", desc: "Eldric: 'A barrow stirs in the high places. The king beneath must be laid to rest.'", kind: "main", obj: [{ kind: "kill", id: "barrowking", n: 1, label: "Slay the Barrow King" }], reward: { xp: 300, coins: 60 } },
  { id: "q_hollow", title: "The Hollow Deep", desc: "Eldric: 'Beyond the green gate lies the Hollows. Bring back 5 ember shards.'", kind: "main", obj: [{ kind: "visit", id: "hollows", n: 1, label: "Enter the Hollows" }, { kind: "gather", id: I.EMBER, n: 5, label: "Gather ember shards" }], reward: { xp: 400, coins: 80 } },
  { id: "s_boar", title: "Tusks in the Brush", desc: "Hunt 2 wild boars.", kind: "side", obj: [{ kind: "kill", id: "boar", n: 2, label: "Hunt boars" }], reward: { xp: 40, coins: 12 } },
  { id: "s_iron", title: "Cold Iron", desc: "The smith wants 4 iron ore.", kind: "side", obj: [{ kind: "gather", id: B.IRON_ORE, n: 4, label: "Gather iron ore" }], reward: { xp: 50, coins: 14 } },
  { id: "s_ruin", title: "What Remains", desc: "Scout an old ruin.", kind: "side", obj: [{ kind: "visit", id: "ruin", n: 1, label: "Explore a ruin" }], reward: { xp: 45, coins: 10 } },
  { id: "s_shroom", title: "Pottage Night", desc: "Gather 8 mushrooms for the pot.", kind: "side", obj: [{ kind: "gather", id: B.MUSHROOM, n: 8, label: "Pick mushrooms" }], reward: { xp: 30, coins: 8 } },
  { id: "s_relic", title: "The Saint's Bone", desc: "Recover a Saint's Relic from the old places.", kind: "side", obj: [{ kind: "gather", id: I.RELIC, n: 1, label: "Find a relic" }], reward: { xp: 80, coins: 25 } },
];
const MAIN_ORDER = ["q_flame", "q_stone", "q_village", "q_wolves", "q_king", "q_hollow"];

interface AdvDef { id: string; name: string; desc: string; }
const ADVS: AdvDef[] = [
  { id: "first_log", name: "Timber", desc: "Gather your first log" },
  { id: "stone_age", name: "Stone Age", desc: "Craft a stone tool" },
  { id: "iron_will", name: "Iron Will", desc: "Smelt an iron ingot" },
  { id: "ember_touched", name: "Ember Touched", desc: "Hold a shard of the Hollows" },
  { id: "first_blood", name: "First Blood", desc: "Slay a creature" },
  { id: "dawn", name: "Until Dawn", desc: "Survive your first night" },
  { id: "village_found", name: "Hearth Smoke", desc: "Find a village" },
  { id: "ruin_found", name: "What Remains", desc: "Find a ruin" },
  { id: "hollow_enter", name: "The Green Gate", desc: "Enter the Hollows" },
  { id: "king_slain", name: "Regicide", desc: "Slay the Barrow King" },
  { id: "lvl5", name: "Seasoned", desc: "Reach level 5" },
  { id: "lvl10", name: "Veteran", desc: "Reach level 10" },
  { id: "rich", name: "Coinpurse", desc: "Hold 100 coins" },
  { id: "craft20", name: "Handyman", desc: "Craft 20 items" },
  { id: "walk2k", name: "Wayfarer", desc: "Walk 2000 blocks" },
  { id: "parry10", name: "Riposte", desc: "Perfect-parry 10 times" },
];

export interface Toast { id: number; text: string; kind: string; t: number; }

let toastId = 1;

export class Game {
  canvas: HTMLCanvasElement | null = null;
  renderer: Renderer | null = null;
  worlds = new Map<number, World>();
  world: World | null = null;
  player = new Player();
  ents = new EntityManager();
  audio = new AudioSys();
  settings: Settings = { ...DEFAULT_SETTINGS };
  version = 0;
  private listeners = new Set<() => void>();
  screen: "menu" | "create" | "loading" | "play" | "dead" = "menu";
  panel: string | null = null;
  panelArg: any = null;
  toasts: Toast[] = [];
  loadingProg = 0; loadingMsg = "";
  debug = false;
  paused = false;
  worldName = ""; difficulty = 1;
  time = 0.3; day = 1;
  weather: { type: string; t: number; next: number } = { type: "clear", t: 0, next: 90 };
  lightning = 0;
  menuAngle = 0;
  hasWorld = false;
  stats = { kills: 0, crafts: 0, mined: 0, dist: 0, parries: 0, cooked: 0 };
  quests: { active: Record<string, { prog: number[] }>; done: string[] } = { active: {}, done: [] };
  advs = new Set<string>();
  dialog: { name: string; lines: string[]; questId?: string; canAccept?: boolean; canTurn?: boolean } | null = null;
  tradeList: { give: ItemStack; cost: number; label: string }[] | null = null;
  tradeName = "";
  hurtT = 0; swingT = 0; mineT = 0; eatT = 0; recoil = 0;
  blocking = false; blockStart = 0;
  private attackCd = 0; private mineProg = 0; private mineTarget: RayHit | null = null; private mineTick = 0;
  private heavyCharge = 0;
  keys = new Set<string>();
  mouse = { l: false, r: false };
  touch = { joyX: 0, joyY: 0, lookDX: 0, lookDY: 0, btns: {} as Record<string, boolean> };
  noiseAt: { x: number; y: number; z: number } | null = null;
  private noiseT = 0;
  private saveT = 0; private fpsEma = 60; private resScale = 1;
  private lastT = 0; private raf = 0;
  private weatherParts: { x: number; y: number; z: number; v: number }[] = [];
  events: any[] = [];
  private raidDoneDay = -1;
  private merchantT = 0; private merchantMob: Mob | null = null;
  huntersMoon = false;
  nearTable = false;
  chestRef: { arr: (ItemStack | null)[]; x: number; y: number; z: number } | null = null;
  furnaceRef: { x: number; y: number; z: number } | null = null;
  fps = 60; drawnChunks = 0;
  sleepFade = 0;
  coldT = 0;
  hudT = 0;
  started = false;

  constructor() {
    this.loadSettings();
  }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  notify(): void { this.version++; for (const fn of this.listeners) fn(); }

  // ---------- settings ----------
  loadSettings(): void {
    try {
      const raw = localStorage.getItem(LS_SETTINGS);
      if (raw) this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw), binds: { ...DEFAULT_BINDS, ...(JSON.parse(raw).binds || {}) } };
      const touch = "ontouchstart" in window && !this.settingsExplicit;
      if (touch && !raw) this.settings.platform = "mobile";
    } catch (e) { /* ignore */ }
  }
  private get settingsExplicit(): boolean { return !!localStorage.getItem(LS_BOOTED); }
  saveSettings(): void { localStorage.setItem(LS_SETTINGS, JSON.stringify(this.settings)); this.audio.setVolumes(this.settings.volMaster, this.settings.volMusic, this.settings.volSfx); }
  get booted(): boolean { return !!localStorage.getItem(LS_BOOTED); }
  setBooted(): void { localStorage.setItem(LS_BOOTED, "1"); this.saveSettings(); }
  resetBoot(): void { localStorage.removeItem(LS_BOOTED); this.notify(); }
  applyPreset(name: string): void {
    const p = PRESETS[name]; if (!p) return;
    Object.assign(this.settings, p);
    this.settings.preset = name;
    this.saveSettings(); this.notify();
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.renderer.fov = this.settings.fov;
    this.setupInput();
    this.enterMenu();
    this.lastT = performance.now();
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.06, (t - this.lastT) / 1000);
      this.lastT = t;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
    window.addEventListener("beforeunload", () => { if (this.hasWorld && this.screen === "play") this.saveWorld(); });
  }

  // ---------- worlds ----------
  worldList(): { name: string; seed: number; time: number; day: number; level: number }[] {
    try { return JSON.parse(localStorage.getItem(LS_WORLDS) || "[]"); } catch { return []; }
  }
  private writeWorldList(l: any[]): void { localStorage.setItem(LS_WORLDS, JSON.stringify(l)); }

  newWorld(name: string, seedStr: string, difficulty: number): void {
    const seed = seedStr.trim() ? hashStr(seedStr.trim()) : (Math.random() * 4294967295) >>> 0;
    this.worldName = name.trim() || "Unnamed Vale";
    this.difficulty = difficulty;
    this.startWorld(this.worldName, seed, null);
  }
  loadWorld(name: string): void {
    try {
      const raw = localStorage.getItem("emberfall.world." + name);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.worldName = name;
      this.difficulty = data.difficulty ?? 1;
      this.startWorld(name, data.seed, data);
    } catch (e) { this.toast("That world is corrupted beyond repair.", "danger"); }
  }
  deleteWorld(name: string): void {
    localStorage.removeItem("emberfall.world." + name);
    this.writeWorldList(this.worldList().filter(w => w.name !== name));
    this.notify();
  }

  private startWorld(name: string, seed: number, data: any | null): void {
    this.screen = "loading"; this.loadingProg = 0; this.notify();
    this.audio.init();
    setTimeout(() => {
      try {
        this.worlds.clear();
        this.ents = new EntityManager();
        this.player = new Player();
        const w0 = new World(seed, 0);
        this.worlds.set(0, w0);
        this.world = w0;
        if (data) {
          w0.loadEdits(data.edits?.[0] || {});
          const w1 = new World(seed, 1);
          w1.loadEdits(data.edits?.[1] || {});
          this.worlds.set(1, w1);
          w0.loadContainers(data.containers || {});
          w1.loadContainers(data.containers1 || {});
          this.ents.restorePersistent(data.npcs || []);
          this.ents.killedBarrows = new Set(data.killedBarrows || []);
          this.time = data.time ?? 0.3; this.day = data.day ?? 1;
          this.weather = data.weather || this.weather;
          this.stats = { ...this.stats, ...(data.stats || {}) };
          this.quests = data.quests || this.quests;
          this.advs = new Set(data.advs || []);
          (this as any).dimPos = data.dimPos || {};
          const p = data.player;
          if (p) {
            Object.assign(this.player, {
              x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch,
              hp: p.hp, hunger: p.hunger, stamina: p.stamina, xp: p.xp, level: p.level, pts: p.pts,
              skills: p.skills, coins: p.coins, inv: p.inv, sel: p.sel, spawn: p.spawn,
            });
            this.player.armor = p.armor || this.player.armor;
          }
          this.player.maxhpBase = 20;
        } else {
          this.time = 0.32; this.day = 1;
          this.stats = { kills: 0, crafts: 0, mined: 0, dist: 0, parries: 0, cooked: 0 };
          this.quests = { active: {}, done: [] };
          this.advs = new Set();
          // starter gift
          this.player.addItem(B.TORCH, 3);
          this.player.addItem(I.BREAD, 2);
          this.quests.active["q_flame"] = { prog: [0, 0] };
          this.toast("Quest started: First Flame", "quest");
        }
        // generate spawn area progressively
        const r = Math.min(5, this.settings.renderDist);
        const pcx = Math.floor(this.player.x / CH), pcz = Math.floor(this.player.z / CH);
        const coords: [number, number][] = [];
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) coords.push([pcx + dx, pcz + dz]);
        coords.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
        let i = 0;
        const step = () => {
          const t0 = performance.now();
          while (i < coords.length && performance.now() - t0 < 24) {
            const [cx, cz] = coords[i++];
            this.world!.ensureLoaded(cx, cz);
          }
          // mesh a few chunks per step so the world is dressed when the veil lifts
          if (this.renderer) {
            let mn = 0;
            for (const key of [...this.world!.dirty]) {
              if (mn++ >= 3 || performance.now() - t0 > 30) break;
              const [, coords2] = key.split(":");
              const [cx2, cz2] = coords2.split(",").map(Number);
              const ch = this.world!.chunkAt(cx2, cz2);
              if (ch) this.renderer.meshChunk(this.world!, ch);
              else this.world!.dirty.delete(key);
            }
          }
          this.loadingProg = i / coords.length;
          this.loadingMsg = this.world!.dim === 1 ? "Descending into the Hollows…" : "Raising hills and valleys…";
          this.notify();
          if (i < coords.length) setTimeout(step, 30);
          else this.finishLoad();
        };
        step();
      } catch (e) {
        console.error(e);
        this.toast("The world refused to be born. Try another seed.", "danger");
        this.screen = "menu"; this.notify();
      }
    }, 60);
  }
  private finishLoad(): void {
    const w = this.world!;
    // safe spawn — seek dry land if we woke in the sea
    const p = this.player;
    if (!this.hasWorldSavedPos()) {
      let sx = 8, sz = 8;
      let h = w.heightAt(8, 8);
      if (h <= WATER_Y + 1) {
        outer: for (let r = 2; r <= 64; r += 2) {
          for (let dx = -r; dx <= r; dx += 2) for (let dz = -r; dz <= r; dz += 2) {
            if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
            const hh = w.heightAt(8 + dx, 8 + dz);
            if (hh > WATER_Y + 1) { sx = 8 + dx; sz = 8 + dz; h = hh; break outer; }
          }
        }
      }
      p.x = sx + 0.5; p.z = sz + 0.5;
      p.y = h + 2;
      p.spawn = { x: p.x, y: p.y, z: p.z, dim: 0, bed: false };
    }
    // world hooks
    w.onVillageSeen = (x, z) => {
      this.visitHook("village");
      this.toast("You smell hearth-smoke. A village lies nearby.", "info");
    };
    w.onBarrowSeen = () => { };
    w.onRuinSeen = () => { };
    w.onUnload = (keys) => { if (this.renderer) for (const k of keys) this.renderer.dropChunk(k); };
    for (const [dim, ww] of this.worlds) ww.onUnload = w.onUnload;
    this.hasWorld = true;
    this.screen = "play";
    this.panel = null;
    this.saveWorldList();
    this.notify();
    this.toast(`${this.worldName} — Day ${this.day}`, "info");
    this.audio.musicTick(999, 0, false);
    // returned to a save whose bed lies in another realm
    if (this.player.spawn.dim && this.player.spawn.dim !== this.world.dim) {
      const dimPos: Record<number, any> = (this as any).dimPos || ((this as any).dimPos = {});
      dimPos[this.player.spawn.dim] = { x: this.player.x, y: this.player.y, z: this.player.z };
      this.switchDim(this.player.spawn.dim);
    }
  }
  private hasWorldSavedPos(): boolean { return this.player.spawn.bed || this.player.y !== 40 || this.player.x !== 8; }
  private saveWorldList(): void {
    const l = this.worldList().filter(w => w.name !== this.worldName);
    l.unshift({ name: this.worldName, seed: this.world!.seed, time: this.time, day: this.day, level: this.player.level });
    this.writeWorldList(l.slice(0, 12));
  }

  saveWorld(silent = false): void {
    if (!this.hasWorld || !this.world) return;
    const p = this.player;
    const w0 = this.worlds.get(0), w1 = this.worlds.get(1);
    const data = {
      v: 1, seed: this.world.seed, difficulty: this.difficulty,
      time: this.time, day: this.day, weather: this.weather, stats: this.stats,
      quests: this.quests, advs: [...this.advs], dimPos: (this as any).dimPos || {},
      edits: { 0: w0?.serializeEdits() || {}, 1: w1?.serializeEdits() || {} },
      containers: w0?.serializeContainers() || {},
      containers1: w1?.serializeContainers() || {},
      npcs: this.ents.serializePersistent(),
      killedBarrows: [...this.ents.killedBarrows],
      player: {
        x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, hp: p.hp, hunger: p.hunger,
        stamina: p.stamina, xp: p.xp, level: p.level, pts: p.pts, skills: p.skills,
        coins: p.coins, inv: p.inv, sel: p.sel, armor: p.armor, spawn: p.spawn,
      },
    };
    try {
      localStorage.setItem("emberfall.world." + this.worldName, JSON.stringify(data));
      this.saveWorldList();
      if (!silent) this.toast("World inscribed to the ledger.", "info");
    } catch (e) { this.toast("The ledger is full — could not save!", "danger"); }
  }

  quitToMenu(): void {
    this.saveWorld(true);
    this.hasWorld = false;
    this.world = null; this.worlds.clear();
    this.renderer?.dropAll();
    this.ents = new EntityManager();
    this.screen = "menu"; this.panel = null;
    this.enterMenu();
    this.notify();
  }
  private enterMenu(): void {
    if (!this.world) this.menuSeedWorld();
  }
  private menuSeedWorld(): void {
    // scenic backdrop world for the title screen — streamed in by the menu loop
    this.worlds.clear();
    this.renderer?.dropAll();
    const w = new World(1337 + Math.floor(Math.random() * 9000), 0);
    this.worlds.set(0, w);
    this.world = w;
    w.onUnload = (keys) => { if (this.renderer) for (const k of keys) this.renderer.dropChunk(k); };
    this.hasWorld = false;
    this.time = 0.42;
  }

  // ---------- dimensions ----------
  switchDim(to: number): void {
    if (!this.world || this.world.dim === to || this.screen === "loading") return;
    const from = this.world;
    const dimPos: Record<number, { x: number; y: number; z: number }> = (this as any).dimPos || ((this as any).dimPos = {});
    dimPos[from.dim] = { x: this.player.x, y: this.player.y, z: this.player.z };
    let target = this.worlds.get(to);
    if (!target) { target = new World(from.seed, to); this.worlds.set(to, target); }
    const dest = dimPos[to];
    const sx = dest ? dest.x : 8.5, sz = dest ? dest.z : 8.5;
    const sh = target.heightAt(Math.floor(sx), Math.floor(sz));
    const sy = dest ? dest.y + 0.5 : sh + 2;
    this.screen = "loading";
    this.loadingMsg = to === 1 ? "Descending into the Hollows…" : "Climbing back to daylight…";
    this.loadingProg = 0;
    this.audio.portal();
    this.notify();
    setTimeout(() => {
      this.world = target;
      this.renderer?.dropAll();
      target.onUnload = (keys) => { if (this.renderer) for (const k of keys) this.renderer.dropChunk(k); };
      const r = 4;
      const pcx = Math.floor(sx / CH), pcz = Math.floor(sz / CH);
      const coords: [number, number][] = [];
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) coords.push([pcx + dx, pcz + dz]);
      coords.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
      let i = 0;
      const step = () => {
        const t0 = performance.now();
        while (i < coords.length && performance.now() - t0 < 22) target.ensureLoaded(coords[i][0], coords[i][1]), i++;
        if (this.renderer) {
          let mn = 0;
          for (const key of [...target.dirty]) {
            if (mn++ >= 3 || performance.now() - t0 > 28) break;
            const [, coords2] = key.split(":");
            const [cx2, cz2] = coords2.split(",").map(Number);
            const ch = target.chunkAt(cx2, cz2);
            if (ch) this.renderer.meshChunk(target, ch);
            else target.dirty.delete(key);
          }
        }
        this.loadingProg = i / coords.length;
        this.notify();
        if (i < coords.length) setTimeout(step, 30);
        else {
          // return gate in the Hollows (first visit)
          if (to === 1 && !dest) {
            const h = target.heightAt(8, 8);
            for (let dy = 0; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) target.setB(8 + dx, h + 1 + dy, 13, B.EMBERSTONE, true);
            target.setB(8, h + 1, 13, B.AIR, true);
            target.setB(8, h + 2, 13, B.AIR, true);
            target.setB(8, h + 1, 13, B.PORTAL, true);
            target.setB(8, h + 2, 13, B.PORTAL, true);
          }
          this.player.x = sx; this.player.z = sz; this.player.y = sy + 0.2;
          this.player.vx = 0; this.player.vy = 0; this.player.vz = 0;
          (this as any).dimPos = dimPos;
          dimPos[to] = { x: sx, y: sy, z: sz };
          this.screen = "play";
          if (to === 1) {
            this.toast("The Hollows. No sun has ever touched this place.", "danger");
            this.visitHook("hollows");
            this.adv("hollow_enter");
          } else {
            this.toast("You return to the world of the living.", "info");
          }
          this.notify();
        }
      };
      step();
    }, 60);
  }

  // ---------- input ----------
  private setupInput(): void {
    const cv = this.canvas!;
    window.addEventListener("keydown", (e) => {
      this.audio.init();
      if (this.rebinding) { this.finishRebind(e.code); e.preventDefault(); return; }
      if (e.code === "F3") { e.preventDefault(); this.debug = !this.debug; this.notify(); return; }
      if (e.code === "Escape") { this.onEscape(); return; }
      this.keys.add(e.code);
      if (this.screen !== "play" || this.panel) return;
      if (e.code === this.settings.binds.inv) this.openPanel("inv");
      else if (e.code === this.settings.binds.craft) this.openCraft();
      else if (e.code === this.settings.binds.skills) this.openPanel("skills");
      else if (e.code === this.settings.binds.quests) this.openPanel("quests");
      else if (e.code === this.settings.binds.map) this.openPanel("map");
      else if (e.code === this.settings.binds.interact) this.tryInteract();
      else if (e.code === this.settings.binds.drop) this.dropHeld();
      else if (e.code === this.settings.binds.dodge) this.tryDodge();
      else if (/^Digit[1-9]$/.test(e.code)) { this.player.sel = +e.code.slice(5) - 1; this.notify(); }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => { this.keys.clear(); this.mouse.l = false; this.mouse.r = false; });
    cv.addEventListener("mousedown", (e) => {
      this.audio.init();
      if (this.screen !== "play") return;
      if (document.pointerLockElement !== cv) { if (this.settings.platform === "pc" && !this.panel) cv.requestPointerLock?.(); return; }
      if (this.panel) return;
      if (e.button === 0) { this.mouse.l = true; this.pressL(); }
      if (e.button === 2) { this.mouse.r = true; this.pressR(); }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) { if (this.mouse.l && this.heavyCharge > 0.35) this.finishHeavy(); this.mouse.l = false; this.heavyCharge = 0; this.mineProg = 0; this.mineT = 0; }
      if (e.button === 2) { this.mouse.r = false; this.blocking = false; }
    });
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement === cv && this.screen === "play" && !this.panel && !this.paused) {
        const s = 0.0022 * this.settings.sens;
        this.player.yaw += e.movementX * s;
        this.player.pitch = Math.max(-1.55, Math.min(1.55, this.player.pitch - e.movementY * s));
      }
    });
    cv.addEventListener("wheel", (e) => {
      if (this.screen !== "play" || this.panel) return;
      e.preventDefault();
      const d = e.deltaY > 0 ? 1 : -1;
      this.player.sel = (this.player.sel + d + 9) % 9;
      this.notify();
    }, { passive: false });
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement !== cv && this.screen === "play" && !this.panel && this.settings.platform === "pc") {
        this.openPanel("pause");
      }
    });
    window.addEventListener("resize", () => this.renderer?.resize(window.innerWidth, window.innerHeight));
  }
  private onEscape(): void {
    if (this.screen !== "play") return;
    if (this.panel === "pause") { this.closePanel(); return; }
    if (this.panel) { this.closePanel(); return; }
    this.openPanel("pause");
  }
  openPanel(p: string, arg?: any): void {
    this.panel = p; this.panelArg = arg ?? null;
    this.paused = p === "pause" || p === "settings" || p === "controls";
    if (document.pointerLockElement && (p !== "pause" || true)) document.exitPointerLock?.();
    this.audio.uiOpen();
    if (p === "pause") this.paused = true;
    this.notify();
  }
  closePanel(): void { this.panel = null; this.panelArg = null; this.chestRef = null; this.furnaceRef = null; this.dialog = null; this.tradeList = null; this.paused = false; this.notify(); }

  rebinding: string | null = null;
  startRebind(action: string): void { this.rebinding = action; this.notify(); }
  private finishRebind(code: string): void {
    if (this.rebinding && code !== "Escape") {
      this.settings.binds[this.rebinding] = code;
      this.saveSettings();
    }
    this.rebinding = null;
    this.notify();
  }

  // touch input API
  setJoy(x: number, y: number): void { this.touch.joyX = x; this.touch.joyY = y; }
  addLook(dx: number, dy: number): void { this.touch.lookDX += dx; this.touch.lookDY += dy; }
  setBtn(b: string, down: boolean): void {
    this.audio.init();
    const was = this.touch.btns[b];
    this.touch.btns[b] = down;
    if (down && !was) {
      if (b === "attack") { this.mouse.l = true; this.pressL(); }
      if (b === "use") this.pressR();
      if (b === "interact") this.tryInteract();
      if (b === "block") { this.mouse.r = true; this.pressR(); }
    }
    if (!down && was) {
      if (b === "attack") { if (this.heavyCharge > 0.35) this.finishHeavy(); this.mouse.l = false; this.heavyCharge = 0; this.mineProg = 0; }
      if (b === "block" || b === "use") { this.mouse.r = false; this.blocking = false; }
    }
  }
  private buildInput(): Input {
    const b = this.settings.binds, k = this.keys, t = this.touch;
    return {
      f: k.has(b.forward) || t.joyY < -0.25,
      b: k.has(b.back) || t.joyY > 0.55,
      l: k.has(b.left) || t.joyX < -0.3,
      r: k.has(b.right) || t.joyX > 0.3,
      jump: k.has(b.jump) || !!t.btns.jump,
      sprint: k.has(b.sprint) || !!t.btns.sprint,
      sneak: k.has(b.sneak) || !!t.btns.sneak,
    };
  }
  private tryDodge(): void {
    const inp = this.buildInput();
    let dx = 0, dz = 0;
    const cy = Math.cos(this.player.yaw), sy = Math.sin(this.player.yaw);
    if (inp.f) { dx += sy; dz += -cy; }
    if (inp.b) { dx -= sy; dz -= -cy; }
    if (inp.r) { dx += cy; dz += sy; }
    if (inp.l) { dx -= cy; dz -= sy; }
    if (dx === 0 && dz === 0) { dx = -cy * 0 - sy; dz = sy * 0 + cy; } // backstep
    if (this.player.dodge(dx, dz)) this.audio.swing();
  }

  // ---------- interaction / combat ----------
  private eye(): { x: number; y: number; z: number } { return { x: this.player.x, y: this.player.y + 1.62, z: this.player.z }; }
  private aim(max = 4.6): RayHit | null {
    const e = this.eye();
    const d = forwardVec(this.player.yaw, this.player.pitch);
    return this.world?.ray(e, { x: d[0], y: d[1], z: d[2] }, max) || null;
  }
  private aimMob(max = 3.4): Mob | null {
    const e = this.eye();
    const d = forwardVec(this.player.yaw, this.player.pitch);
    let best: Mob | null = null, bestT = max + 1;
    for (const m of this.ents.mobs) {
      if (m.dead) continue;
      const cx = m.x - e.x, cy = m.y + m.def.h * 0.5 - e.y, cz = m.z - e.z;
      const t = cx * d[0] + cy * d[1] + cz * d[2];
      if (t < 0.3 || t > max + m.def.r + 1) continue;
      const px = e.x + d[0] * t - m.x, py = e.y + d[1] * t - (m.y + m.def.h * 0.5), pz = e.z + d[2] * t - m.z;
      const dist = Math.hypot(px, py, pz);
      if (dist < m.def.r + 0.55 && t < bestT) { best = m; bestT = t; }
    }
    return best;
  }

  private pressL(): void {
    if (this.screen !== "play" || this.panel || this.attackCd > 0) return;
    const mob = this.aimMob();
    if (mob) { this.swing(false); return; }
    // mining handled in frame loop while held
    this.mineTarget = this.aim();
    this.mineProg = 0;
    this.heavyCharge = 0.001;
  }
  private pressR(): void {
    if (this.screen !== "play" || this.panel) return;
    // interact priority
    const hit = this.aim(3.6);
    if (hit) {
      const bd = BLOCKS[hit.id];
      if (bd?.interact) { this.interactBlock(hit); return; }
    }
    const mob = this.aimMob(3.0);
    if (mob && mob.persist && !mob.def.hostile) { this.interactNPC(mob); return; }
    if (mob && mob.type === "merchant") { this.interactNPC(mob); return; }
    // shield?
    if (this.player.armor.shield) {
      this.blocking = true;
      this.blockStart = performance.now() / 1000;
      return;
    }
    // place / eat / use
    const held = this.player.held();
    if (!held) return;
    const def = ITEMS.get(held.id);
    if (def?.blockId !== undefined) { this.placeBlock(hit); return; }
    if (def?.kind === "food") { this.eat(held); return; }
    if (def?.use === "bandage") {
      this.player.bleed = 0;
      this.player.hp = Math.min(this.player.maxhp, this.player.hp + 4);
      this.player.consumeHeld();
      this.audio.drink();
      this.toast("You bind your wounds.", "info");
      this.notify();
      return;
    }
  }
  private swing(heavy: boolean): void {
    const p = this.player;
    if (this.attackCd > 0 || p.stamina < (heavy ? 18 : 6)) return;
    this.attackCd = 1 / p.attackSpeed * (heavy ? 1.6 : 1);
    p.stamina -= heavy ? 18 : 6;
    this.swingT = 0.0001;
    this.recoil = heavy ? 1 : 0.6;
    this.audio.swing();
    const e = this.eye();
    const d = forwardVec(p.yaw, p.pitch);
    const range = heavy ? 2.8 : 2.3;
    let hitAny = false;
    for (const m of [...this.ents.mobs]) {
      if (m.dead) continue;
      const cx = m.x - e.x, cy = m.y + m.def.h * 0.5 - e.y, cz = m.z - e.z;
      const dist = Math.hypot(cx, cy, cz);
      if (dist > range + m.def.r) continue;
      const dot = (cx * d[0] + cy * d[1] + cz * d[2]) / (dist || 1);
      if (dot < 0.55) continue;
      hitAny = true;
      const crit = Math.random() < p.critChance;
      let dmg = p.meleeDmg * (heavy ? 1.9 : 1) * (0.9 + Math.random() * 0.25);
      if (crit) dmg *= 1.7;
      const l = Math.hypot(cx, cz) || 1;
      this.ents.damage(this, m, Math.round(dmg * 10) / 10, cx / l, cz / l, true);
      if (crit) { this.toast("Critical!", "crit"); }
    }
    if (hitAny) p.damageHeld(1);
    else {
      // hit block? small chance to chip
      const hit = this.aim();
      if (hit && this.world) {
        this.ents.burst(hit.x + 0.5 + hit.nx * 0.1, hit.y + 0.5 + hit.ny * 0.1, hit.z + 0.5 + hit.nz * 0.1, [0.5, 0.5, 0.5], 3, 2, -8, 0.3);
      }
    }
  }
  private finishHeavy(): void {
    if (this.attackCd <= 0 && this.screen === "play" && !this.panel) this.swing(true);
  }

  private mineUpdate(dt: number): void {
    const p = this.player;
    if (!this.mouse.l || !this.world || this.panel) { this.mineT = 0; this.mineProg = 0; return; }
    this.heavyCharge += dt;
    const hit = this.aim();
    if (!hit || BLOCKS[hit.id]?.unbreak) { this.mineProg = 0; this.mineT = 0; return; }
    const bd = BLOCKS[hit.id];
    const key = hit.x + "," + hit.y + "," + hit.z;
    if ((this as any)._mineKey !== key) { this.mineProg = 0; (this as any)._mineKey = key; }
    // tool match
    let speed = 1;
    const heldDef = p.heldDef();
    const rightTool = bd.tool === 0 || (heldDef?.toolClass === bd.tool);
    const tierOk = p.toolTier >= bd.tier;
    if (heldDef?.toolClass && bd.tool !== 0) speed = rightTool ? 2.6 + p.toolTier * 1.1 : 0.8;
    else if (bd.tool === 0) speed = 2.5;
    else speed = 0.7;
    speed *= p.mineSpeed;
    if (!tierOk) speed *= 0.55;
    this.mineProg += dt * speed / Math.max(0.15, bd.hard);
    this.mineT = (this.mineT + dt * 2.2) % 1;
    this.mineTick -= dt;
    if (this.mineTick <= 0) {
      this.mineTick = 0.24;
      this.audio.dig();
      const c = bd.color;
      this.ents.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255], 4, 2.2, -7, 0.45);
      this.noiseAt = { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 };
      this.noiseT = 0.5;
    }
    if (this.mineProg >= 1) {
      this.breakBlock(hit, rightTool && tierOk);
      this.mineProg = 0;
      (this as any)._mineKey = null;
    }
  }
  private breakBlock(hit: RayHit, canDrop: boolean): void {
    const w = this.world!;
    const bd = BLOCKS[hit.id];
    this.audio.breakBlock(bd.tool === 1 ? "stone" : bd.sound === "wood" ? "wood" : "grass");
    const c = bd.color;
    this.ents.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255], 12, 3, -9, 0.6);
    // drops
    if (canDrop) {
      const double_ = Math.random() < this.player.skills.mining * 0.04;
      if (hit.id === B.LEAVES || hit.id === B.BIRCH_LEAVES || hit.id === B.PINE_LEAVES || hit.id === B.DARK_LEAVES) {
        if (Math.random() < 0.07) this.ents.drop(I.APPLE, 1, hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        else if (hit.id === B.BIRCH_LEAVES && Math.random() < 0.1) this.ents.drop(I.BERRIES, 1, hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      } else if (hit.id === B.TALLGRASS) {
        const biome = w.biomeAt(hit.x, hit.z);
        if (Math.random() < (biome === BIO.MEADOW || biome === BIO.HILLS ? 0.1 : 0.06)) this.ents.drop(I.WHEAT, 1, hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        else if (Math.random() < 0.08) this.ents.drop(I.BERRIES, 1, hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      } else {
        const drop = bd.drop === undefined ? { id: hit.id, n: 1 } : bd.drop === null ? null : (typeof bd.drop === "number" ? { id: bd.drop, n: 1 } : bd.drop);
        if (drop) this.ents.drop(drop.id, drop.n + (double_ ? drop.n : 0), hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      }
    }
    // doors: break pair
    if (hit.id === B.DOOR_B || hit.id === B.DOOR_B_OPEN) w.setB(hit.x, hit.y + 1, hit.z, B.AIR);
    if (hit.id === B.DOOR_T || hit.id === B.DOOR_T_OPEN) w.setB(hit.x, hit.y - 1, hit.z, B.AIR);
    if (hit.id === B.BED_FOOT) w.setB(hit.x + 1, hit.y, hit.z, B.AIR);
    if (hit.id === B.BED_HEAD) w.setB(hit.x - 1, hit.y, hit.z, B.AIR);
    w.setB(hit.x, hit.y, hit.z, B.AIR);
    this.player.damageHeld(bd.tool !== 0 ? 1 : 0.3);
    this.stats.mined++;
    this.hooks.onMine?.(hit.id);
    if (hit.id === B.COAL_ORE) this.gainXP(3);
    if (hit.id === B.IRON_ORE) this.gainXP(5);
    if (hit.id === B.GOLD_ORE) this.gainXP(8);
    if (hit.id === B.EMBER_ORE) this.gainXP(12);
    this.notify();
  }
  private placeBlock(hit: RayHit | null): void {
    const w = this.world!;
    const p = this.player;
    const held = p.held();
    if (!held) return;
    let px: number, py: number, pz: number;
    if (hit && hit.nx + hit.ny + hit.nz !== 0) { px = hit.x + hit.nx; py = hit.y + hit.ny; pz = hit.z + hit.nz; }
    else {
      const d = forwardVec(p.yaw, p.pitch);
      px = Math.floor(p.x + d[0] * 2); py = Math.floor(p.y + 1 + d[1] * 2); pz = Math.floor(p.z + d[2] * 2);
    }
    if (py < 1 || py >= HH - 1) return;
    const cur = w.getB(px, py, pz);
    if (cur !== B.AIR && !BLOCKS[cur]?.fluid && !(BLOCKS[cur]?.cross)) return;
    // don't place inside player
    const id = ITEMS.get(held.id)!.blockId!;
    if (BLOCKS[id]?.solid) {
      const pMinX = p.x - 0.31, pMaxX = p.x + 0.31, pMinZ = p.z - 0.31, pMaxZ = p.z + 0.31;
      if (px + 1 > pMinX && px < pMaxX && pz + 1 > pMinZ && pz < pMaxZ && py + 1 > p.y && py < p.y + 1.8) return;
    }
    // torch needs support
    if (id === B.TORCH && !w.isSolid(px, py - 1, pz)) return;
    // doors & beds come in pairs
    if (id === B.DOOR_B) {
      if (w.getB(px, py + 1, pz) !== B.AIR) return;
      w.setB(px, py, pz, B.DOOR_B);
      w.setB(px, py + 1, pz, B.DOOR_T);
    } else if (id === B.BED_FOOT) {
      const d = forwardVec(p.yaw, 0);
      const hx = Math.abs(d[0]) > Math.abs(d[2]) ? Math.sign(d[0]) : 0;
      const hz = hx === 0 ? Math.sign(d[2]) : 0;
      if (w.getB(px + hx, py, pz + hz) !== B.AIR) return;
      w.setB(px, py, pz, B.BED_FOOT);
      w.setB(px + hx, py, pz + hz, B.BED_HEAD);
    } else {
      w.setB(px, py, pz, id);
    }
    this.audio.place();
    this.ents.burst(px + 0.5, py + 0.5, pz + 0.5, [0.6, 0.5, 0.35], 5, 2, -6, 0.3);
    held.n--;
    if (held.n <= 0) p.inv[p.sel] = null;
    this.notify();
  }
  private eat(held: ItemStack): void {
    const def = ITEMS.get(held.id)!;
    if (this.player.hunger > 19.2) { this.toast("You are not hungry.", "info"); return; }
    this.eatT = 0.0001;
    this.audio.eat();
    this.player.hunger = Math.min(20, this.player.hunger + (def.food || 2));
    if (held.id === I.STEW) this.player.hp = Math.min(this.player.maxhp, this.player.hp + 3);
    this.player.consumeHeld();
    this.stats.cooked++;
    this.notify();
  }
  private dropHeld(): void {
    const h = this.player.held();
    if (!h) return;
    const p = this.player;
    const d = forwardVec(p.yaw, p.pitch);
    const it = { id: h.id, n: 1, x: p.x + d[0], y: p.y + 1.4, z: p.z + d[2], vx: d[0] * 4, vy: 2.5, vz: d[2] * 4, t: 0, dur: h.dur, bonus: h.bonus };
    this.ents.items.push(it);
    h.n--;
    if (h.n <= 0) p.inv[p.sel] = null;
    this.notify();
  }

  interactBlock(hit: RayHit): void {
    const w = this.world!;
    const bd = BLOCKS[hit.id]!;
    switch (bd.interact) {
      case "chest": case "barrel": {
        const arr = w.chestAt(hit.x, hit.y, hit.z);
        this.chestRef = { arr, x: hit.x, y: hit.y, z: hit.z };
        this.audio.chestOpen();
        this.openPanel(bd.interact === "barrel" ? "barrel" : "chest");
        break;
      }
      case "furnace": {
        this.furnaceRef = { x: hit.x, y: hit.y, z: hit.z };
        this.audio.chestOpen();
        this.openPanel("furnace");
        break;
      }
      case "table": this.openCraft(true); break;
      case "bed": this.trySleep(hit); break;
      case "door": this.toggleDoor(hit.x, hit.y, hit.z, hit.id); break;
      case "board": this.openQuestBoard(); break;
      case "portal": this.switchDim(w.dim === 0 ? 1 : 0); break;
    }
  }
  private toggleDoor(x: number, y: number, z: number, id: number): void {
    const w = this.world!;
    this.audio.doorCreak();
    if (id === B.DOOR_B) { w.setB(x, y, z, B.DOOR_B_OPEN); w.setB(x, y + 1, z, B.DOOR_T_OPEN); }
    else if (id === B.DOOR_T) { w.setB(x, y, z, B.DOOR_T_OPEN); w.setB(x, y - 1, z, B.DOOR_B_OPEN); }
    else if (id === B.DOOR_B_OPEN) { w.setB(x, y, z, B.DOOR_B); w.setB(x, y + 1, z, B.DOOR_T); }
    else if (id === B.DOOR_T_OPEN) { w.setB(x, y, z, B.DOOR_T); w.setB(x, y - 1, z, B.DOOR_B); }
  }
  private trySleep(hit: RayHit): void {
    const daylight = this.daylight;
    if (daylight > 0.22 && this.weather.type === "clear") {
      this.toast("You can only sleep when night or storm covers the land.", "info");
      return;
    }
    const danger = this.ents.mobs.some(m => m.def.hostile && !m.dead && Math.hypot(m.x - this.player.x, m.z - this.player.z) < 14);
    if (danger) { this.toast("You cannot rest — something prowls nearby.", "danger"); return; }
    const p = this.player;
    let bx = hit.x, bz = hit.z;
    if (hit.id === B.BED_HEAD) bx = hit.x - 1;
    p.spawn = { x: bx + 0.9, y: hit.y + 0.4, z: bz + 0.5, dim: this.world!.dim, bed: true };
    this.time = 0.3;
    p.hp = Math.min(p.maxhp, p.hp + Math.round(p.maxhp * 0.5));
    p.stamina = p.maxStamina;
    this.sleepFade = 1.6;
    this.audio.sleep();
    this.toast("You sleep. Dawn comes grey and cold.", "info");
    this.notify();
  }

  private tryInteract(): void {
    const mob = this.aimMob(3.2);
    if (mob && (mob.persist || mob.type === "merchant")) { this.interactNPC(mob); return; }
    const hit = this.aim(3.6);
    if (hit && BLOCKS[hit.id]?.interact) this.interactBlock(hit);
  }
  interactNPC(m: Mob): void {
    this.audio.uiOpen();
    if (m.trade === "smith") {
      this.tradeName = m.name || "Smith";
      this.tradeList = SMITH_TRADES;
      this.openPanel("trade");
      return;
    }
    if (m.type === "merchant") {
      this.tradeName = m.name || "Merchant";
      this.tradeList = MERCHANT_TRADES;
      this.openPanel("trade");
      return;
    }
    if (m.type === "elder") { this.elderDialog(); return; }
    const lines = [
      "Bread's dear this winter, traveler.",
      "Wolves howled twice last night. Twice!",
      "The old barrows? Folk don't speak of them.",
      "Maud forges fair steel, if you've coin.",
      "Rain's coming. My knee says so.",
      "They say a green gate stands in the fens.",
    ];
    this.dialog = { name: m.name || "Villager", lines: [lines[Math.floor(Math.random() * lines.length)]] };
    this.openPanel("dialog");
  }
  buyTrade(idx: number): void {
    if (!this.tradeList) return;
    const t = this.tradeList[idx];
    if (this.player.coins < t.cost) { this.toast("Not enough coins.", "danger"); return; }
    this.player.coins -= t.cost;
    this.player.addItem(t.give.id, t.give.n);
    this.audio.coin();
    this.notify();
  }

  // ---------- quests ----------
  mainProgress(): number {
    for (let i = 0; i < MAIN_ORDER.length; i++) {
      if (!this.quests.done.includes(MAIN_ORDER[i])) return i;
    }
    return MAIN_ORDER.length;
  }
  private elderDialog(): void {
    const idx = this.mainProgress();
    const done = this.quests.done;
    // turn-in check
    for (const qid of [...Object.keys(this.quests.active)]) {
      const def = QUESTS.find(q => q.id === qid)!;
      const prog = this.quests.active[qid].prog;
      if (def.obj.every((o, i) => prog[i] >= o.n)) {
        this.dialog = { name: "Eldric the Grey", lines: [`'${def.title}' — done, then? The vale owes you.`, `+${def.reward.xp} experience, +${def.reward.coins} coins.`], questId: qid, canTurn: true };
        this.openPanel("dialog");
        return;
      }
    }
    if (idx >= 3) {
      // elders gives wolves/king/hollow sequentially; before that, lore
      if (idx >= MAIN_ORDER.length) {
        this.dialog = { name: "Eldric the Grey", lines: ["'The old king sleeps, the green gate is walked, and you yet breathe. Remarkable.'", "'Go far, wayfarer. The world has no edges, only deeper dark.'"] };
        this.openPanel("dialog");
        return;
      }
      const qid = MAIN_ORDER[idx];
      const q = QUESTS.find(x => x.id === qid)!;
      this.dialog = { name: "Eldric the Grey", lines: [q.desc, `Reward: ${q.reward.xp} xp, ${q.reward.coins} coins.`], questId: qid, canAccept: !this.quests.active[qid] };
      this.openPanel("dialog");
      return;
    }
    const hints = [
      "'Punch no trees like a fool — craft an axe at a workbench. Four planks make one.'",
      "'Stone under the turf. A stone pick opens the world's harder bones.'",
      "'Follow the smoke, wayfarer. Villages keep the dark at bay.'",
    ];
    this.dialog = { name: "Eldric the Grey", lines: [hints[Math.min(idx, 2)]] };
    this.openPanel("dialog");
  }
  acceptQuest(qid: string): void {
    const q = QUESTS.find(x => x.id === qid)!;
    if (!this.quests.active[qid] && !this.quests.done.includes(qid)) {
      this.quests.active[qid] = { prog: q.obj.map(() => 0) };
      this.toast(`Quest taken: ${q.title}`, "quest");
      this.audio.adv();
    }
    this.dialog = null;
    this.notify();
  }
  turnInQuest(qid: string): void {
    const q = QUESTS.find(x => x.id === qid)!;
    delete this.quests.active[qid];
    this.quests.done.push(qid);
    this.gainXP(q.reward.xp);
    this.player.coins += q.reward.coins;
    this.audio.coin();
    this.toast(`Quest complete: ${q.title}`, "quest");
    this.dialog = null;
    this.notify();
  }
  private openQuestBoard(): void {
    this.audio.chestOpen();
    const sides = QUESTS.filter(q => q.kind === "side" && !this.quests.done.includes(q.id) && !this.quests.active[q.id]);
    if (sides.length) {
      const q = sides[Math.floor(Math.random() * sides.length)];
      this.dialog = { name: "Quest Board", lines: [`A notice, nailed crooked: "${q.title}"`, q.desc, `Reward: ${q.reward.xp} xp, ${q.reward.coins} coins.`], questId: q.id, canAccept: true };
    } else {
      this.dialog = { name: "Quest Board", lines: ["Nothing new is nailed here. The board creaks in the wind."] };
    }
    this.openPanel("dialog");
  }
  private questProgress(kind: string, id: number | string, n = 1): void {
    for (const qid of Object.keys(this.quests.active)) {
      const def = QUESTS.find(q => q.id === qid)!;
      def.obj.forEach((o, i) => {
        if (o.kind === kind && o.id === id) {
          const prog = this.quests.active[qid].prog;
          if (prog[i] < o.n) {
            prog[i] = Math.min(o.n, prog[i] + n);
            if (prog[i] >= o.n) this.toast(`${def.title}: ${o.label} — done`, "quest");
            this.notify();
          }
        }
      });
    }
  }
  private visitHook(place: string): void {
    if (place === "village") this.adv("village_found");
    if (place === "ruin") this.adv("ruin_found");
    this.questProgress("visit", place, 1);
  }

  // ---------- xp / skills / advancements ----------
  xpNeed(level: number): number { return 30 + level * 26; }
  gainXP(n: number): void {
    const p = this.player;
    p.xp += n;
    while (p.xp >= this.xpNeed(p.level)) {
      p.xp -= this.xpNeed(p.level);
      p.level++; p.pts += 2;
      this.audio.levelup();
      this.toast(`Level ${p.level} — 2 skill points earned`, "level");
      if (p.level >= 5) this.adv("lvl5");
      if (p.level >= 10) this.adv("lvl10");
    }
    this.notify();
  }
  spendSkill(id: string): void {
    const p = this.player;
    if (p.pts <= 0 || p.skills[id] >= 10) return;
    p.skills[id]++;
    p.pts--;
    if (id === "end") p.hp = Math.min(p.maxhp, p.hp + 5);
    this.audio.adv();
    this.notify();
  }
  adv(id: string): void {
    if (this.advs.has(id)) return;
    const def = ADVS.find(a => a.id === id);
    if (!def) return;
    this.advs.add(id);
    this.audio.adv();
    this.toast(`Advancement — ${def.name}: ${def.desc}`, "adv");
    this.notify();
  }

  hooks = {
    onKill: (m: Mob) => {
      this.stats.kills++;
      this.adv("first_blood");
      this.questProgress("kill", m.type, 1);
      if (m.type === "bandit" && Math.random() < 0.3) this.ents.drop(I.COIN, 2 + Math.floor(Math.random() * 4), m.x, m.y + 0.5, m.z);
    },
    onHitMob: (_m: Mob) => { },
    onBossKill: (m: Mob) => {
      this.adv("king_slain");
      this.questProgress("kill", "barrowking", 1);
      this.toast("The Barrow King crumbles to old dust.", "adv");
      this.gainXP(200);
      void m;
    },
    onMine: (id: number) => {
      if (id === B.LOG || id === B.PINE_LOG || id === B.BIRCH_LOG || id === B.DARK_LOG) {
        this.questProgress("gather", B.LOG, 1);
        this.adv("first_log");
      }
    },
  };
  pickupItem(it: { id: number; n: number; dur?: number; bonus?: number }): boolean {
    const p = this.player;
    const leftover = p.addItem(it.id, it.n, it.dur, it.bonus);
    if (leftover >= it.n) return false;
    const got = it.n - leftover;
    this.audio.pickup();
    if (it.id === I.COIN) { this.audio.coin(); if (p.coins >= 100) this.adv("rich"); }
    if (it.id === I.EMBER) this.adv("ember_touched");
    if (it.id === I.IRON) this.adv("iron_will");
    // quest gather
    this.questProgress("gather", it.id, got);
    const def = ITEMS.get(it.id);
    if (def?.blockId !== undefined && def.blockId !== it.id) this.questProgress("gather", def.blockId, got);
    this.notify();
    return true;
  }

  // ---------- crafting ----------
  openCraft(forceTable = false): void {
    if (forceTable) this.nearTable = true;
    else {
      // check near a workbench
      const p = this.player;
      let near = false;
      for (let dx = -2; dx <= 2 && !near; dx++) for (let dy = -2; dy <= 2 && !near; dy++) for (let dz = -2; dz <= 2 && !near; dz++) {
        if (this.world?.getB(Math.floor(p.x) + dx, Math.floor(p.y) + dy, Math.floor(p.z) + dz) === B.TABLE) near = true;
      }
      this.nearTable = near;
    }
    this.openPanel("craft");
  }
  canCraft(r: Recipe): boolean {
    if (r.station === "table" && !this.nearTable) return false;
    return r.ing.every(([id, n]) => this.player.countItem(id) >= n);
  }
  craft(r: Recipe): void {
    if (!this.canCraft(r)) return;
    for (const [id, n] of r.ing) this.player.takeItem(id, n);
    const dur = TOOL_DUR[r.out.id];
    this.player.addItem(r.out.id, r.out.n, dur);
    this.stats.crafts++;
    this.audio.craft();
    this.gainXP(4);
    this.questProgress("craft", r.out.id, 1);
    if ([I.S_SWORD, I.S_PICK, I.S_AXE, I.S_SHOVEL].includes(r.out.id)) this.adv("stone_age");
    if (this.stats.crafts >= 20) this.adv("craft20");
    this.notify();
  }
  furnaceSmelt(): void {
    if (!this.furnaceRef || !this.world) return;
    const f = this.world.furnaceAt(this.furnaceRef.x, this.furnaceRef.y, this.furnaceRef.z);
    const recipe = SMELTS.find(s => f.in && s.inId === f.in.id);
    if (!recipe || !f.in) return;
    if (f.fuelLeft <= 0) {
      if (!f.fuel) return;
      const fv = FUEL[f.fuel.id] || 0;
      if (!fv) return;
      f.fuelLeft += fv;
      f.fuel.n--;
      if (f.fuel.n <= 0) f.fuel = null;
      this.audio.smelt();
    }
    f.prog += 1 / 3;
    f.fuelLeft -= 1;
    if (f.prog >= 1) {
      f.prog = 0;
      f.in.n--;
      if (f.in.n <= 0) f.in = null;
      const existing = f.out;
      if (existing && existing.id === recipe.out.id) existing.n += recipe.out.n;
      else if (!existing) f.out = { id: recipe.out.id, n: recipe.out.n };
      this.gainXP(6);
      if (recipe.out.id === I.IRON) this.adv("iron_will");
      this.audio.craft();
    }
    this.notify();
  }
  furnaceTake(slot: "in" | "fuel" | "out"): void {
    if (!this.furnaceRef || !this.world) return;
    const f = this.world.furnaceAt(this.furnaceRef.x, this.furnaceRef.y, this.furnaceRef.z);
    const it = f[slot];
    if (!it) return;
    const left = this.player.addItem(it.id, it.n, it.dur, it.bonus);
    it.n = left;
    if (left <= 0) f[slot] = null;
    if (slot === "out" && it.id === I.MEAT) this.stats.cooked++;
    this.audio.pickup();
    this.notify();
  }
  furnacePut(slot: "in" | "fuel"): void {
    if (!this.furnaceRef || !this.world) return;
    const f = this.world.furnaceAt(this.furnaceRef.x, this.furnaceRef.y, this.furnaceRef.z);
    const held = this.player.held();
    if (!held) return;
    const valid = slot === "fuel" ? (FUEL[held.id] || 0) > 0 : SMELTS.some(s => s.inId === held.id);
    if (!valid) return;
    const cur = f[slot];
    if (cur && cur.id !== held.id) return;
    const move = Math.min(held.n, 32 - (cur?.n || 0));
    if (move <= 0) return;
    if (cur) cur.n += move;
    else f[slot] = { id: held.id, n: move, dur: held.dur };
    held.n -= move;
    if (held.n <= 0) this.player.inv[this.player.sel] = null;
    this.audio.pickup();
    this.notify();
  }
  // chest/inventory click-move
  invClick(i: number): void {
    this.invSwap("inv", i);
  }
  private cursor: ItemStack | null = null;
  getCursor(): ItemStack | null { return this.cursor; }
  private invSwap(side: "inv" | "chest", i: number): void {
    const p = this.player;
    const arr = side === "inv" ? p.inv : this.chestRef?.arr;
    if (!arr) return;
    const s = arr[i];
    if (this.cursor) {
      if (!s) { arr[i] = this.cursor; this.cursor = null; }
      else if (s.id === this.cursor.id && s.n < (ITEMS.get(s.id)?.stack || 64)) {
        const take = Math.min(this.cursor.n, (ITEMS.get(s.id)?.stack || 64) - s.n);
        s.n += take; this.cursor.n -= take;
        if (this.cursor.n <= 0) this.cursor = null;
      } else { arr[i] = this.cursor; this.cursor = s; }
    } else if (s) { this.cursor = s; arr[i] = null; }
    this.notify();
  }
  chestClick(i: number): void { this.invSwap("chest", i); }
  armorClick(slot: "head" | "chest" | "legs" | "shield"): void {
    const p = this.player;
    const cur = p.armor[slot];
    if (this.cursor) {
      const def = ITEMS.get(this.cursor.id);
      const ok = slot === "shield" ? def?.kind === "shield" : def?.kind === "armor" && (def as any).desc?.includes(slot) || (slot === "head" && this.cursor.id === I.CROWN);
      if (!ok) return;
      p.armor[slot] = this.cursor;
      this.cursor = cur || null;
    } else if (cur) { this.cursor = cur; p.armor[slot] = null; }
    this.notify();
  }
  hotbarClick(i: number): void {
    const p = this.player;
    if (this.cursor) {
      const t = p.inv[i];
      p.inv[i] = this.cursor;
      this.cursor = t || null;
      this.player.sel = i;
    } else p.sel = i;
    this.notify();
  }
  dropCursor(): void {
    if (this.cursor) {
      this.ents.drop(this.cursor.id, this.cursor.n, this.player.x, this.player.y + 1.2, this.player.z, { dur: this.cursor.dur });
      this.cursor = null;
      this.notify();
    }
  }
  sortInv(): void {
    const p = this.player;
    const items = p.inv.filter(Boolean) as ItemStack[];
    items.sort((a, b) => a.id - b.id);
    // merge
    const merged: ItemStack[] = [];
    for (const it of items) {
      const last = merged[merged.length - 1];
      const stack = ITEMS.get(it.id)?.stack || 64;
      if (last && last.id === it.id && last.n < stack && it.dur === undefined && last.dur === undefined) {
        const take = Math.min(it.n, stack - last.n);
        last.n += take;
        if (take < it.n) merged.push({ ...it, n: it.n - take });
      } else merged.push(it);
    }
    p.inv = [...merged, ...new Array(36 - merged.length).fill(null)];
    this.audio.uiClick();
    this.notify();
  }

  // ---------- damage ----------
  playerHurt(rawDmg: number, src: Mob | null, kind = "hit"): void {
    const p = this.player;
    if (this.screen !== "play" || this.sleepFade > 0) return;
    if (p.dodgeT > 0 && kind === "hit") return;
    let dmg = rawDmg * (kind === "hit" ? [0.7, 1, 1.35, 1.7][this.difficulty] : 1);
    if (kind === "hit") {
      dmg = Math.max(1, dmg - p.armorVal * 0.35);
      // block / parry
      if (this.blocking && p.armor.shield) {
        const since = performance.now() / 1000 - this.blockStart;
        if (since < p.parryWindow) {
          // perfect parry
          this.audio.parry(true);
          this.stats.parries++;
          if (this.stats.parries >= 10) this.adv("parry10");
          this.ents.burst(p.x + Math.sin(p.yaw) * 0.6, p.y + 1.3, p.z - Math.cos(p.yaw) * 0.6, [1, 0.85, 0.4], 16, 4, -4, 0.5);
          this.toast("Perfect parry!", "crit");
          this.recoil = 0.5;
          if (src) {
            src.state = "idle"; src.stateT = -2.2; src.attackT = 3.2; src.aggroed = true;
            src.lastSeen = { x: p.x, y: p.y, z: p.z };
            this.ents.damage(this, src, Math.round(dmg * 0.6), 0, 0, false);
          }
          p.damageShield(0.5);
          return;
        }
        const def = ITEMS.get(p.armor.shield.id);
        dmg *= 1 - (def?.blockPct || 0.5);
        this.audio.parry(false);
        p.damageShield(1);
        this.ents.burst(p.x + Math.sin(p.yaw) * 0.6, p.y + 1.3, p.z - Math.cos(p.yaw) * 0.6, [0.8, 0.8, 0.85], 6, 3, -5, 0.4);
      }
      // status from attackers
      if (src?.type === "wolf" && Math.random() < 0.25) { p.bleed = Math.max(p.bleed, 4 * (1 - p.skills.survival * 0.12)); this.toast("You are bleeding!", "danger"); }
      if (src?.type === "wight") { p.chill = Math.max(p.chill, 5); this.toast("A grave-chill seeps into you.", "danger"); }
    }
    p.hp -= dmg;
    this.hurtT = 0.45;
    this.recoil = Math.max(this.recoil, 0.4);
    if (kind === "hit") {
      this.audio.hurt();
      const d = forwardVec(p.yaw, 0);
      if (src) p.vx += (p.x - src.x) * 2; else p.vx -= d[0];
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.screen = "dead";
      this.saveWorld(true);
      this.notify();
    } else this.notify();
  }
  respawn(): void {
    const p = this.player;
    const s = p.spawn;
    if (s.dim !== this.world?.dim) {
      const dimPos: Record<number, any> = (this as any).dimPos || ((this as any).dimPos = {});
      dimPos[s.dim] = { x: s.x, y: s.y + 0.5, z: s.z };
      this.switchDim(s.dim);
      p.hp = p.maxhp; p.hunger = Math.max(10, p.hunger); p.stamina = p.maxStamina; p.bleed = 0; p.chill = 0; p.air = 10;
      p.coins = Math.floor(p.coins * 0.8);
      this.screen = "play";
      this.toast("You wake at your bed, far from where you fell.", "info");
      this.notify();
      return;
    }
    const w = this.world!;
    p.x = s.x; p.y = s.y + 1; p.z = s.z;
    const h = w.heightAt(Math.floor(p.x), Math.floor(p.z));
    if (p.y < h) p.y = h + 1;
    p.hp = p.maxhp; p.hunger = Math.max(10, p.hunger); p.stamina = p.maxStamina; p.bleed = 0; p.chill = 0; p.air = 10;
    p.coins = Math.floor(p.coins * 0.8);
    this.screen = "play";
    this.toast("You wake. The old gods are not done with you.", "info");
    this.notify();
  }

  // ---------- environment ----------
  get daylight(): number {
    const ang = (this.time - 0.25) * Math.PI * 2;
    const e = Math.sin(ang);
    return Math.max(0, Math.min(1, (e + 0.07) / 0.32));
  }
  get nightAmt(): number { return Math.max(0, Math.min(1, (-(Math.sin((this.time - 0.25) * Math.PI * 2)) + 0.1) / 0.4)); }
  updateTemp(p: Player, dt: number): void {
    const w = this.world!;
    const biome = w.biomeAt(Math.floor(p.x), Math.floor(p.z));
    let t = 0.55;
    if (biome === BIO.SNOW) t = 0.05; else if (biome === BIO.PINE) t = 0.2;
    else if (biome === BIO.BADLANDS) t = 0.9; else if (biome === BIO.MOUNTAIN) t = 0.25;
    else if (biome === BIO.HOLLOW || biome === BIO.GROTTO) t = 0.3;
    t -= this.nightAmt * 0.25;
    t -= p.wet * 0.3;
    if (this.weather.type === "rain" || this.weather.type === "storm") t -= 0.12;
    const cave = p.y < w.heightAt(Math.floor(p.x), Math.floor(p.z)) - 4;
    if (cave) t = 0.4;
    // near torch warmth
    const light = w.lightAt(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z));
    if (light.torch > 0.3) t += 0.25;
    p.temp += (t - p.temp) * Math.min(1, dt * 0.3);
    if (p.temp < 0.18) {
      p.chill = Math.max(p.chill, 0.2);
      this.coldT += dt;
      if (this.coldT > 6) { this.coldT = 0; this.playerHurt(1, null, "cold"); this.toast("You are freezing.", "danger"); }
    } else this.coldT = 0;
    void dt;
  }
  get hungerMul(): number { return [0.6, 1, 1.25, 1.5][this.difficulty]; }
  hostileCap(): number { return [3, 10, 14, 18][this.difficulty]; }

  private weatherUpdate(dt: number): void {
    const w = this.world!;
    const wt = this.weather;
    wt.next -= dt;
    if (wt.next <= 0) {
      const biome = w.biomeAt(Math.floor(this.player.x), Math.floor(this.player.z));
      const r = Math.random();
      if (biome === BIO.SNOW || biome === BIO.PINE) wt.type = r < 0.4 ? "snow" : "clear";
      else if (biome === BIO.BADLANDS) wt.type = "clear";
      else wt.type = r < 0.22 ? "rain" : r < 0.3 ? "storm" : "clear";
      wt.next = 90 + Math.random() * 150;
      if (wt.type === "storm") this.toast("A storm rolls over the land.", "info");
    }
    if (wt.type === "storm" && Math.random() < dt * 0.06) {
      this.lightning = 0.5;
      this.audio.thunder();
    }
    this.lightning = Math.max(0, this.lightning - dt * 1.4);
    // particles
    const target = (wt.type === "rain" || wt.type === "storm") ? 220 * this.settings.particles : wt.type === "snow" ? 160 * this.settings.particles : 0;
    while (this.weatherParts.length < target) {
      this.weatherParts.push({
        x: this.player.x + (Math.random() - 0.5) * 30,
        y: this.player.y + 4 + Math.random() * 14,
        z: this.player.z + (Math.random() - 0.5) * 30,
        v: wt.type === "snow" ? 1.6 : 12,
      });
    }
    if (this.weatherParts.length > target) this.weatherParts.length = target;
    const drift = wt.type === "storm" ? 3 : 0.4;
    for (const pt of this.weatherParts) {
      pt.y -= pt.v * dt;
      pt.x += drift * dt + (wt.type === "snow" ? Math.sin(pt.y * 0.8) * dt : 0);
      if (pt.y < this.player.y - 3 || Math.abs(pt.x - this.player.x) > 20) {
        pt.x = this.player.x + (Math.random() - 0.5) * 30;
        pt.z = this.player.z + (Math.random() - 0.5) * 30;
        pt.y = this.player.y + 10 + Math.random() * 8;
      }
    }
  }

  private eventsUpdate(dt: number): void {
    const w = this.world!;
    // boss proximity
    if (w.bossPoints) {
      for (const [, pt] of w.bossPoints) {
        const d = Math.hypot(pt.x - this.player.x, pt.z - this.player.z);
        if (d < 6 && Math.abs(pt.y - this.player.y) < 3) {
          this.ents.triggerBoss(this, pt.x, pt.y, pt.z);
        }
      }
    }
    // ruin proximity
    for (const r of w.ruins) {
      if (Math.hypot(r.x - this.player.x, r.z - this.player.z) < 7) this.visitHook("ruin");
    }
    // village raid
    if (this.nightAmt > 0.6 && this.day !== this.raidDoneDay && w.villages.length) {
      const v = w.villages.find(v => Math.hypot(v.x - this.player.x, v.z - this.player.z) < 55);
      if (v && Math.random() < dt * 0.008) {
        this.raidDoneDay = this.day;
        this.toast("Bandit raid! Torchlight and shouting in the village!", "danger");
        for (let i = 0; i < 3 + this.difficulty; i++) {
          const m = this.ents.spawnMob("bandit", v.x + (Math.random() - 0.5) * 16, w.heightAt(Math.floor(v.x), Math.floor(v.z)) + 1, v.z + (Math.random() - 0.5) * 16);
          m.aggroed = true; m.lastSeen = { x: this.player.x, y: this.player.y, z: this.player.z };
        }
        this.audio.growl();
      }
    }
    // traveling merchant
    this.merchantT -= dt;
    if (this.merchantT <= 0) {
      this.merchantT = 240 + Math.random() * 240;
      if (this.daylight > 0.4 && w.dim === 0 && Math.random() < 0.5) {
        const bx = this.player.x + (Math.random() - 0.5) * 14, bz = this.player.z + (Math.random() - 0.5) * 14;
        const h = w.heightAt(Math.floor(bx), Math.floor(bz));
        if (h > WATER_Y) {
          this.merchantMob = this.ents.spawnMob("merchant", bx, h + 1, bz, { name: "Reynard the Peddler", trade: "merchant" });
          this.toast("A wandering merchant sets down his pack nearby.", "info");
        }
      }
    }
    if (this.merchantMob && (this.merchantMob.dead || Math.hypot(this.merchantMob.x - this.player.x, this.merchantMob.z - this.player.z) > 80)) {
      const idx = this.ents.mobs.indexOf(this.merchantMob);
      if (idx >= 0) this.ents.mobs.splice(idx, 1);
      this.merchantMob = null;
    }
    // village NPCs materialize when their home chunks exist
    if (w.dim === 0) {
      for (const s of w.npcSpawns) {
        if (Math.hypot(s.x - this.player.x, s.z - this.player.z) > 48) continue;
        if (!w.chunkAt(Math.floor(s.x) >> 4, Math.floor(s.z) >> 4)) continue;
        const exists = this.ents.mobs.some(m => m.persist && Math.hypot(m.x - s.x, m.z - s.z) < 3);
        if (exists) continue;
        const m = this.ents.spawnMob(s.type, s.x + 0.5, w.heightAt(Math.floor(s.x), Math.floor(s.z)) + 1, s.z + 0.5, { persist: true, name: s.name, trade: s.trade });
        m.home = { x: s.x, y: m.y, z: s.z };
      }
    }
    // hunter's moon
    if (this.time > 0.75 && this.time < 0.76 && Math.random() < 0.3 && !this.huntersMoon) {
      this.huntersMoon = true;
      this.toast("The Hunter's Moon rises. The wilds grow bold.", "danger");
    }
    if (this.daylight > 0.3) this.huntersMoon = false;
  }

  toast(text: string, kind = "info"): void {
    this.toasts.push({ id: toastId++, text, kind, t: 6 });
    if (this.toasts.length > 5) this.toasts.shift();
    this.notify();
  }

  // ---------- frame ----------
  private frame(dt: number): void {
    this.fpsEma = this.fpsEma * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    this.fps = Math.round(this.fpsEma);
    const playing = this.screen === "play" && !this.paused && this.world;
    if (playing) {
      // time
      const prevTime = this.time;
      this.time += dt / DAY_LEN;
      if (this.time >= 1) { this.time -= 1; this.day++; this.toast(`Day ${this.day}`, "info"); }
      if (prevTime < 0.28 && this.time >= 0.28 && this.day > 1) this.adv("dawn");
      this.sleepFade = Math.max(0, this.sleepFade - dt);
      const inp = this.buildInput();
      // touch look
      if (this.touch.lookDX || this.touch.lookDY) {
        const s = 0.0032 * this.settings.sens;
        this.player.yaw += this.touch.lookDX * s;
        this.player.pitch = Math.max(-1.55, Math.min(1.55, this.player.pitch - this.touch.lookDY * s));
        this.touch.lookDX = 0; this.touch.lookDY = 0;
      }
      const prevX = this.player.x, prevZ = this.player.z;
      this.player.update(this, dt, inp);
      this.stats.dist += Math.hypot(this.player.x - prevX, this.player.z - prevZ);
      if (this.stats.dist > 2000) this.adv("walk2k");
      this.attackCd = Math.max(0, this.attackCd - dt);
      if (this.swingT > 0) { this.swingT += dt * 3.4; if (this.swingT >= 1) this.swingT = 0; }
      if (this.eatT > 0) { this.eatT += dt * 1.2; if (this.eatT >= 1) this.eatT = 0; }
      this.recoil = Math.max(0, this.recoil - dt * 3);
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.noiseT -= dt;
      if (this.noiseT <= 0) this.noiseAt = null;
      // near table check (cheap, every 0.5s)
      if (Math.random() < dt * 2) this.checkNearTable();
      this.mineUpdate(dt);
      this.world!.tick(dt);
      this.ents.update(this, dt);
      this.ents.spawnTick(this, dt);
      this.weatherUpdate(dt);
      this.eventsUpdate(dt);
      this.furnaceTickAll(dt);
      // streaming
      const r = this.settings.renderDist;
      this.world!.requestAround(this.player.x, this.player.z, r);
      this.world!.processGen(3.5);
      this.world!.unloadFar(this.player.x, this.player.z, r);
      // meshing budget
      let budget = 4.5, meshed = 0;
      if (this.world!.dirty.size && this.renderer) {
        const t0 = performance.now();
        for (const key of [...this.world!.dirty]) {
          if (performance.now() - t0 > budget) break;
          const [, coords] = key.split(":");
          const [cx, cz] = coords.split(",").map(Number);
          const c = this.world!.chunkAt(cx, cz);
          if (c) { this.renderer.meshChunk(this.world!, c); meshed++; }
          else this.world!.dirty.delete(key);
        }
      }
      void meshed;
      // autosave
      this.saveT += dt;
      if (this.saveT > 30) { this.saveT = 0; this.saveWorld(true); }
      // adaptive res
      if (this.settings.dynamicRes && this.renderer) {
        if (this.fpsEma < 42 && this.resScale > 0.6) this.resScale = Math.max(0.6, this.resScale - 0.05);
        else if (this.fpsEma > 57 && this.resScale < 1) this.resScale = Math.min(1, this.resScale + 0.02);
        if (Math.abs(this.renderer.resScale - this.resScale) > 0.01) {
          this.renderer.resScale = this.resScale;
          this.renderer.resize(window.innerWidth, window.innerHeight);
        }
      }
      this.audio.update(dt, {
        wind: this.weather.type === "storm" ? 1 : this.weather.type === "rain" ? 0.5 : 0.3 + this.nightAmt * 0.2,
        rain: this.weather.type === "rain" ? 0.7 : this.weather.type === "storm" ? 1 : 0,
        cave: this.player.y < this.world!.heightAt(Math.floor(this.player.x), Math.floor(this.player.z)) - 3,
        night: this.nightAmt > 0.5,
        forest: [BIO.FOREST, BIO.DARK, BIO.BIRCH, BIO.PINE].includes(this.world!.biomeAt(Math.floor(this.player.x), Math.floor(this.player.z))),
        village: this.world!.villages.some(v => Math.hypot(v.x - this.player.x, v.z - this.player.z) < 24),
        underwater: this.player.eyeUnder,
      }, this.ents.mobs.some(m => m.aggroed && m.def.hostile && !m.dead && Math.hypot(m.x - this.player.x, m.z - this.player.z) < 20) ? 1 : 0);
      this.audio.musicTick(dt, this.ents.mobs.some(m => m.aggroed && !m.dead && Math.hypot(m.x - this.player.x, m.z - this.player.z) < 24) ? 1 : 0, this.nightAmt > 0.5);
      this.hudT += dt;
      if (this.hudT > 0.14) { this.hudT = 0; this.notify(); }
      // toast expiry
      let toastChanged = false;
      for (const t of this.toasts) { t.t -= dt; if (t.t <= 0) toastChanged = true; }
      if (toastChanged) { this.toasts = this.toasts.filter(t => t.t > 0); }
    } else if (this.screen === "menu" && this.world) {
      this.menuAngle += dt * 0.05;
      const t0 = performance.now();
      this.world.requestAround(Math.cos(this.menuAngle) * 8, Math.sin(this.menuAngle) * 8, 5);
      this.world.processGen(4);
      if (this.world.dirty.size && this.renderer) {
        for (const key of [...this.world.dirty]) {
          if (performance.now() - t0 > 4) break;
          const [, coords] = key.split(":");
          const [cx, cz] = coords.split(",").map(Number);
          const c = this.world.chunkAt(cx, cz);
          if (c) this.renderer.meshChunk(this.world, c);
          else this.world.dirty.delete(key);
        }
      }
      this.audio.musicTick(dt, 0, true);
      this.audio.update(dt, { wind: 0.4, rain: 0, cave: false, night: true, forest: true, village: false, underwater: false }, 0);
      this.time += dt / DAY_LEN * 0.2;
      if (this.time > 1) this.time -= 1;
    }
    this.renderFrame();
  }
  private checkNearTable(): void {
    const p = this.player;
    let near = false;
    outer: for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
      if (this.world?.getB(Math.floor(p.x) + dx, Math.floor(p.y) + dy, Math.floor(p.z) + dz) === B.TABLE) { near = true; break outer; }
    }
    this.nearTable = near;
  }
  private furnaceTickAll(dt: number): void {
    const w = this.world!;
    for (const [k, v] of w.containers) {
      if (Array.isArray(v)) continue;
      const f = v as any;
      if (!f.in || f.fuelLeft <= 0 && !f.fuel) continue;
      const [dimS, coords] = k.split(":");
      if (+dimS !== w.dim) continue;
      const [x, y, z] = coords.split(",").map(Number);
      if (Math.hypot(x - this.player.x, z - this.player.z) > 20) continue;
      const recipe = SMELTS.find(s => f.in && s.inId === f.in.id);
      if (!recipe) continue;
      if (f.fuelLeft <= 0) {
        if (!f.fuel) continue;
        const fv = FUEL[f.fuel.id] || 0;
        if (!fv) continue;
        f.fuelLeft += fv;
        f.fuel.n--;
        if (f.fuel.n <= 0) f.fuel = null;
      }
      f.fuelLeft -= dt * 0.5;
      f.prog += dt * 0.4;
      if (f.prog >= 1) {
        f.prog = 0;
        f.in.n--;
        if (f.in.n <= 0) f.in = null;
        if (f.out && f.out.id === recipe.out.id) f.out.n += recipe.out.n;
        else if (!f.out) f.out = { id: recipe.out.id, n: recipe.out.n };
        this.gainXP(5);
        if (recipe.out.id === I.IRON) this.adv("iron_will");
      }
    }
  }

  private renderFrame(): void {
    const R = this.renderer;
    if (!R || !this.world) return;
    if (R.canvas.width !== Math.floor(window.innerWidth * R.dpr * R.resScale) || R.canvas.height !== Math.floor(window.innerHeight * R.dpr * R.resScale)) {
      R.resize(window.innerWidth, window.innerHeight);
    }
    const w = this.world;
    const day = this.daylight;
    const night = this.nightAmt;
    const storm = this.weather.type === "storm";
    const rain = this.weather.type === "rain";
    let fogMul = this.settings.fog * (storm ? 0.55 : rain ? 0.75 : 1);
    if (this.huntersMoon) fogMul *= 0.85;
    const fogE = this.settings.renderDist * CH * 0.92 * fogMul;
    const fogS = fogE * 0.55;
    const dim1 = w.dim === 1;
    // colors
    const lerp3 = (a: number[], b: number[], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    let skyTop: [number, number, number], skyBot: [number, number, number];
    const duskAmt = Math.max(0, 1 - Math.abs(Math.sin((this.time - 0.25) * Math.PI * 2)) * 4) * (day < 0.85 ? 1 : 0);
    if (dim1) {
      skyTop = [0.02, 0.05, 0.03]; skyBot = [0.05, 0.1, 0.06];
    } else {
      skyTop = lerp3([0.03, 0.04, 0.09], [0.36, 0.5, 0.62], day);
      skyBot = lerp3([0.06, 0.07, 0.12], [0.62, 0.66, 0.62], day);
      if (duskAmt > 0) skyBot = lerp3(skyBot, [0.75, 0.42, 0.2], duskAmt * 0.7);
      if (this.huntersMoon) { skyTop = lerp3(skyTop, [0.25, 0.05, 0.04], 0.6); skyBot = lerp3(skyBot, [0.35, 0.1, 0.06], 0.5); }
      if (storm || rain) { skyTop = lerp3(skyTop, [0.16, 0.17, 0.19], 0.7); skyBot = lerp3(skyBot, [0.3, 0.31, 0.33], 0.7); }
    }
    let fog: [number, number, number] = lerp3(skyBot, skyTop, 0.25);
    const under = this.player.eyeUnder && this.screen === "play";
    if (under) fog = [0.08, 0.18, 0.24];
    if (dim1) fog = [0.03, 0.07, 0.045];
    if (this.lightning > 0.3) fog = lerp3(fog, [0.9, 0.92, 1], (this.lightning - 0.3) * 1.2);
    // sun
    const ang = (this.time - 0.25) * Math.PI * 2;
    const sunDir = [Math.cos(ang) * 0.9, Math.sin(ang), 0.35];
    let sunNdc: [number, number] = [9, 9];
    let sunAmt = 0;
    if (!dim1) {
      const e = this.eye();
      const fwd = forwardVec(this.camYaw(), this.camPitch());
      const dot = sunDir[0] * fwd[0] + sunDir[1] * fwd[1] + sunDir[2] * fwd[2];
      if (dot > 0.02) {
        // rough projection
        const right = [Math.cos(this.camYaw()), 0, Math.sin(this.camYaw())];
        const upv = [
          right[1] * fwd[2] - right[2] * fwd[1],
          right[2] * fwd[0] - right[0] * fwd[2],
          right[0] * fwd[1] - right[1] * fwd[0],
        ];
        const aspect = window.innerWidth / Math.max(1, window.innerHeight);
        const xr = (sunDir[0] * right[0] + sunDir[2] * right[2]) / dot;
        const yr = (sunDir[0] * upv[0] + sunDir[1] * upv[1] + sunDir[2] * upv[2]) / dot;
        const f = 1 / Math.tan((R.fov * Math.PI) / 360);
        sunNdc = [xr * f / aspect, yr * f];
        sunAmt = Math.max(0, Math.min(1, (Math.sin(ang) + 0.15) * 3));
      }
      void e;
    }
    const cam = this.camera();
    R.beginFrame(cam, {
      daylight: dim1 ? 0.06 : Math.max(0.02, day * (storm ? 0.6 : rain ? 0.75 : 1) + this.lightning * 0.6),
      fog, fogS: under ? 2 : fogS, fogE: under ? 14 : dim1 ? Math.min(fogE, 40) : fogE,
      time: performance.now() / 1000,
      skyTop, skyBot, sunNdc, sunAmt,
      night: dim1 ? 0 : night * (storm || rain ? 0.5 : 1),
      underwater: under,
      tint: dim1 ? [0.1, 0.35, 0.2] : [0.16, 0.35, 0.47],
    });
    this.drawnChunks = R.drawTerrain(w, cam);
    R.drawWater();
    if (this.screen === "play") {
      // entities
      const boxes: Box[] = [];
      const t = performance.now() / 1000;
      for (const m of this.ents.mobs) {
        const d = Math.hypot(m.x - cam.x, m.z - cam.z);
        if (d > this.settings.renderDist * CH + 8) continue;
        const light = w.lightAt(Math.floor(m.x), Math.floor(m.y + 1), Math.floor(m.z));
        const shade = Math.min(1.15, Math.max(0.12, light.sky * (dim1 ? 0.3 : day) + light.torch + this.lightning * 0.5));
        for (const b of this.ents.mobBoxes(m, t)) {
          if (b.e < 1) { b.r *= shade; b.g *= shade; b.b *= shade; }
          boxes.push(b);
        }
      }
      for (const it of this.ents.items) {
        const d = Math.hypot(it.x - cam.x, it.z - cam.z);
        if (d > 40) continue;
        const light = w.lightAt(Math.floor(it.x), Math.floor(it.y), Math.floor(it.z));
        const shade = Math.min(1.15, Math.max(0.15, light.sky * day + light.torch));
        for (const b of this.ents.itemBoxes(it, t)) {
          if (b.e < 0.5) { b.r *= shade; b.g *= shade; b.b *= shade; }
          boxes.push(b);
        }
      }
      R.drawBoxes(boxes);
      // particles
      const plist: any[] = [];
      const pScale = this.settings.particles;
      let pn = 0;
      for (const pt of this.ents.particles) {
        if (pn > 320 * pScale) break;
        plist.push({ x: pt.x, y: pt.y, z: pt.z, r: pt.r, g: pt.g, b: pt.b, a: pt.a, s: pt.s * 16 });
        pn++;
      }
      for (let i = 0; i < this.weatherParts.length; i += (storm || rain ? 1 : 2)) {
        const pt = this.weatherParts[i];
        if (plist.length > 620) break;
        if (this.weather.type === "snow") plist.push({ x: pt.x, y: pt.y, z: pt.z, r: 0.9, g: 0.92, b: 0.96, a: 0.8, s: 5 });
        else plist.push({ x: pt.x, y: pt.y, z: pt.z, r: 0.55, g: 0.65, b: 0.75, a: 0.45, s: 3 });
      }
      if (plist.length) R.drawParticles(plist);
      // highlight
      if (!this.panel) {
        const hit = this.aim();
        if (hit) R.drawHighlight(hit.x, hit.y, hit.z);
      }
      // viewmodel
      if (this.settings.platform === "pc" || true) {
        const vm = this.player.viewmodelBoxes(this);
        if (vm.length) R.drawBoxes(R.relBoxes(vm, cam), undefined, { fog: false });
      }
    }
  }
  private camYaw(): number { return this.screen === "play" ? this.player.yaw : this.menuAngle - Math.PI / 2; }
  private camPitch(): number { return this.screen === "play" ? this.player.pitch : -0.18 + Math.sin(this.menuAngle * 0.7) * 0.05; }
  private camera(): { x: number; y: number; z: number; yaw: number; pitch: number } {
    if (this.screen === "play") {
      const p = this.player;
      const bob = this.settings.viewBob && p.moving ? Math.sin(p.walkPhase) * 0.05 : 0;
      return { x: p.x, y: p.y + 1.62 + bob, z: p.z, yaw: p.yaw, pitch: p.pitch };
    }
    // menu orbit
    const w = this.world!;
    const cx = Math.cos(this.menuAngle) * 14 + 8, cz = Math.sin(this.menuAngle) * 14 + 8;
    const h = w.heightAt(Math.floor(8), Math.floor(8));
    return { x: cx, y: h + 9 + Math.sin(this.menuAngle * 0.6) * 2, z: cz, yaw: this.camYaw(), pitch: this.camPitch() };
  }
}

export const G = new Game();
export function useGame(): { v: number; g: Game } {
  const v = useSyncExternalStore(G.subscribe, () => G.version);
  return { v, g: G };
}
