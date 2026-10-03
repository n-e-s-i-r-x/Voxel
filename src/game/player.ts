// Emberfall player: physics, survival stats, inventory, equipment, viewmodel.
import { B, BLOCKS } from "./blocks";
import { ItemStack, ITEMS, I, maxDur } from "./items";
import { Box } from "./engine";

export interface Input { f: boolean; b: boolean; l: boolean; r: boolean; jump: boolean; sprint: boolean; sneak: boolean; }

export const SKILLS = [
  { id: "str", name: "Strength", desc: "+0.6 melee damage per level" },
  { id: "end", name: "Endurance", desc: "+5 max health, +6 stamina per level" },
  { id: "agi", name: "Agility", desc: "+2% speed, cheaper sprint, better dodges" },
  { id: "mining", name: "Mining", desc: "+9% mining speed, +4% double ore drop" },
  { id: "survival", name: "Survival", desc: "-7% hunger drain, resist cold & bleed" },
  { id: "combat", name: "Combat", desc: "+55ms parry window, +3% crit chance" },
];

export class Player {
  x = 8; y = 40; z = 8;
  vx = 0; vy = 0; vz = 0;
  yaw = 0; pitch = 0;
  onGround = false; inWater = false; eyeUnder = false;
  wasAir = false; fallStart = 0;
  hp = 20; maxhpBase = 20;
  hunger = 20; stamina = 100; air = 10;
  xp = 0; level = 1; pts = 0;
  skills: Record<string, number> = { str: 0, end: 0, agi: 0, mining: 0, survival: 0, combat: 0 };
  inv: (ItemStack | null)[] = new Array(36).fill(null);
  armor: { head: ItemStack | null; chest: ItemStack | null; legs: ItemStack | null; shield: ItemStack | null } = { head: null, chest: null, legs: null, shield: null };
  sel = 0;
  coins = 0;
  spawn = { x: 8, y: 40, z: 8, dim: 0, bed: false };
  bleed = 0; chill = 0; temp = 0.5; wet = 0;
  stepT = 0; walkPhase = 0; moving = false; sprinting = false; sneaking = false;
  dodgeT = 0; dodgeCd = 0; dodgeDir = { x: 0, z: 0 };
  regenT = 0; hungerT = 0; starveT = 0; coldT = 0; drownT = 0;
  eatCombo = 0;

  get maxhp(): number { return this.maxhpBase + this.skills.end * 5; }
  get maxStamina(): number { return 100 + this.skills.end * 6; }
  get armorVal(): number {
    let a = 0;
    for (const s of [this.armor.head, this.armor.chest, this.armor.legs]) if (s) a += (ITEMS.get(s.id)?.armor || 0) + (s.bonus || 0);
    return a;
  }
  held(): ItemStack | null { return this.inv[this.sel]; }
  heldDef() { const h = this.held(); return h ? ITEMS.get(h.id) : null; }
  get meleeDmg(): number {
    const h = this.heldDef();
    const base = h?.dmg ?? 1;
    return base + this.skills.str * 0.6;
  }
  get attackSpeed(): number { return this.heldDef()?.spd ?? 1.2; }
  get toolTier(): number { return this.heldDef()?.tier ?? 0; }
  get toolClass(): number { return this.heldDef()?.toolClass ?? 0; }
  get critChance(): number { return 0.05 + this.skills.combat * 0.03; }
  get parryWindow(): number { return 0.14 + this.skills.combat * 0.055; }
  get mineSpeed(): number { return (1 + this.skills.mining * 0.09); }
  get moveSpeed(): number {
    let s = 4.3 * (1 + this.skills.agi * 0.02);
    if (this.sneaking) s *= 0.45;
    if (this.sprinting && this.stamina > 1) s *= 1.55;
    if (this.chill > 0) s *= 0.7;
    if (this.inWater) s *= 0.55;
    return s;
  }

  // ---------- inventory ----------
  addItem(id: number, n: number, dur?: number, bonus?: number): number {
    const def = ITEMS.get(id);
    if (!def) return n;
    if (id === I.COIN) { this.coins += n; return 0; }
    const stack = def.stack;
    // merge
    if (dur === undefined) {
      for (const s of this.inv) {
        if (n <= 0) break;
        if (s && s.id === id && s.n < stack && s.dur === undefined) {
          const take = Math.min(n, stack - s.n);
          s.n += take; n -= take;
        }
      }
    }
    for (let i = 0; i < this.inv.length && n > 0; i++) {
      if (!this.inv[i]) {
        const take = Math.min(n, stack);
        this.inv[i] = { id, n: take, dur, bonus };
        n -= take;
      }
    }
    return n;
  }
  takeItem(id: number, n: number): boolean {
    if (id === I.COIN) { if (this.coins >= n) { this.coins -= n; return true; } return false; }
    if (this.countItem(id) < n) return false;
    for (let i = this.inv.length - 1; i >= 0 && n > 0; i--) {
      const s = this.inv[i];
      if (s && s.id === id) {
        const take = Math.min(n, s.n);
        s.n -= take; n -= take;
        if (s.n <= 0) this.inv[i] = null;
      }
    }
    return true;
  }
  countItem(id: number): number {
    if (id === I.COIN) return this.coins;
    let n = 0;
    for (const s of this.inv) if (s && s.id === id) n += s.n;
    return n;
  }
  consumeHeld(): void {
    const h = this.held();
    if (!h) return;
    h.n--;
    if (h.n <= 0) this.inv[this.sel] = null;
  }
  damageHeld(amount = 1): void {
    const h = this.held();
    if (!h) return;
    const md = maxDur(h.id);
    if (!md) return;
    h.dur = (h.dur ?? md) - amount;
    if (h.dur <= 0) this.inv[this.sel] = null;
  }
  damageShield(amount = 1): void {
    const s = this.armor.shield;
    if (!s) return;
    const md = maxDur(s.id);
    s.dur = (s.dur ?? md) - amount;
    if (s.dur <= 0) this.armor.shield = null;
  }

  // ---------- physics ----------
  update(g: any, dt: number, inp: Input): void {
    const w = g.world;
    if (!w) return;
    // --- movement ---
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    let mx = 0, mz = 0;
    if (inp.f) { mx += sy; mz += -cy; }
    if (inp.b) { mx -= sy; mz -= -cy; }
    if (inp.r) { mx += cy; mz += sy; }
    if (inp.l) { mx -= cy; mz -= sy; }
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }
    this.sneaking = inp.sneak;
    this.sprinting = inp.sprint && ml > 0 && !inp.sneak && this.stamina > 1 && this.hunger > 4;
    const spd = this.moveSpeed;
    const acc = this.onGround ? 14 : 5;
    this.vx += (mx * spd - this.vx) * Math.min(1, acc * dt);
    this.vz += (mz * spd - this.vz) * Math.min(1, acc * dt);
    // dodge
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      this.vx = this.dodgeDir.x * 11; this.vz = this.dodgeDir.z * 11;
    }
    // gravity / water
    const feetInWater = w.isFluid(Math.floor(this.x), Math.floor(this.y + 0.3), Math.floor(this.z));
    const headInWater = w.isFluid(Math.floor(this.x), Math.floor(this.y + 1.5), Math.floor(this.z));
    this.inWater = feetInWater || headInWater;
    this.eyeUnder = w.isFluid(Math.floor(this.x), Math.floor(this.y + 1.62), Math.floor(this.z));
    if (this.inWater) {
      this.vy -= 6 * dt;
      if (inp.jump) this.vy = Math.min(this.vy + 26 * dt, 3.2);
      this.vy = Math.max(this.vy, -3.4);
    } else {
      this.vy -= 26 * dt;
      if (inp.jump && this.onGround) {
        this.vy = 8.6;
        g.audio?.step?.("grass", true);
      }
    }
    this.vy = Math.max(this.vy, -42);
    // integrate + collide
    this.moveAxis(g, this.vx * dt, 0, this.vz * dt);
    const prevY = this.y;
    this.y += this.vy * dt;
    this.onGround = false;
    const r = 0.3, hgt = 1.8;
    if (this.vy <= 0) {
      const fy = Math.floor(this.y - 0.001);
      if (this.feetSolid(g, fy)) {
        this.y = fy + 1;
        // fall damage
        if (this.wasAir) {
          const fell = this.fallStart - this.y;
          if (fell > 3.5 && !this.inWater) {
            const dmg = Math.round((fell - 3) * 2 * (1 - this.skills.agi * 0.04));
            if (dmg > 0) g.playerHurt(dmg, null, "fall");
          }
        }
        this.vy = 0; this.onGround = true;
      }
    } else {
      const hy = Math.floor(this.y + hgt);
      if (this.headSolid(g, hy)) { this.y = hy - hgt - 0.01; this.vy = 0; }
    }
    if (!this.onGround && this.vy < -1 && !this.wasAir) this.fallStart = prevY + 0.9;
    if (this.onGround) this.wasAir = false; else if (this.vy < -2) this.wasAir = true;
    if (this.y < -8) g.playerHurt(999, null, "void");
    // footsteps & walk anim
    const hspd = Math.hypot(this.vx, this.vz);
    this.moving = hspd > 0.5 && this.onGround;
    if (this.moving) {
      this.walkPhase += dt * (this.sprinting ? 11 : 8);
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = this.sprinting ? 0.28 : 0.42;
        const below = BLOCKS[w.getB(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z))];
        const mat = below ? (below.tool === 1 ? "stone" : below.sound === "wood" ? "wood" : below.sound === "sand" ? "sand" : "grass") : "grass";
        g.audio?.step?.(w.eyeUnder === true || this.eyeUnder ? "water" : mat, this.sprinting);
      }
    }
    // stamina
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - dt * 14 * (1 - this.skills.agi * 0.07));
    else if (!inp.jump) this.stamina = Math.min(this.maxStamina, this.stamina + dt * (this.moving ? 8 : 16));
    // hunger
    this.hungerT += dt;
    const drain = (this.sprinting ? 0.055 : 0.012) * (1 - this.skills.survival * 0.07) * g.hungerMul;
    if (this.hungerT > 1) { this.hungerT = 0; this.hunger = Math.max(0, this.hunger - drain * 4); }
    if (this.hunger <= 0) {
      this.starveT += dt;
      if (this.starveT > 4) { this.starveT = 0; g.playerHurt(1, null, "starve"); }
    }
    // regen
    if (this.hunger > 15 && this.hp < this.maxhp) {
      this.regenT += dt;
      const rate = this.hunger > 18 ? 2.5 : 5;
      if (this.regenT > rate) { this.regenT = 0; this.hp = Math.min(this.maxhp, this.hp + 1); }
    }
    // bleed / chill
    if (this.bleed > 0) {
      this.bleed -= dt * (1 + this.skills.survival * 0.2);
      this.hp -= dt * 1.2;
      if (Math.random() < dt * 6) g.ents?.burst(this.x, this.y + 1, this.z, [0.6, 0.05, 0.04], 1, 1, -6, 0.5);
      if (this.hp <= 0) g.playerHurt(1, null, "bleed");
    }
    if (this.chill > 0) this.chill -= dt;
    // air
    if (this.eyeUnder) {
      this.air -= dt;
      if (this.air <= 0) { this.drownT += dt; if (this.drownT > 1.2) { this.drownT = 0; g.playerHurt(2, null, "drown"); } }
    } else this.air = Math.min(10, this.air + dt * 4);
    // wetness / temperature
    this.wet = this.inWater ? Math.min(1, this.wet + dt * 0.5) : Math.max(0, this.wet - dt * 0.08);
    g.updateTemp?.(this, dt);
  }
  private feetSolid(g: any, fy: number): boolean {
    const w = g.world;
    for (const [ox, oz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]])
      if (w.isSolid(Math.floor(this.x + ox), fy, Math.floor(this.z + oz))) return true;
    return false;
  }
  private headSolid(g: any, hy: number): boolean {
    const w = g.world;
    for (const [ox, oz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]])
      if (w.isSolid(Math.floor(this.x + ox), hy, Math.floor(this.z + oz))) return true;
    return false;
  }
  private moveAxis(g: any, dx: number, _dy: number, dz: number): void {
    const w = g.world;
    const r = 0.3;
    const tryX = this.x + dx;
    if (!this.boxSolid(g, tryX, this.y, this.z, r)) this.x = tryX; else this.vx = 0;
    const tryZ = this.z + dz;
    if (!this.boxSolid(g, this.x, this.y, tryZ, r)) this.z = tryZ; else this.vz = 0;
    void w;
  }
  private boxSolid(g: any, x: number, y: number, z: number, r: number): boolean {
    const w = g.world;
    for (const dy of [0.1, 0.9, 1.7]) {
      for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
        if (w.isSolid(Math.floor(x + ox), Math.floor(y + dy), Math.floor(z + oz))) return true;
      }
    }
    return false;
  }

  dodge(dirX: number, dirZ: number): boolean {
    if (this.dodgeCd > 0 || this.stamina < 15) return false;
    this.dodgeT = 0.22; this.dodgeCd = 0.7 - this.skills.agi * 0.03;
    this.stamina -= 15;
    const l = Math.hypot(dirX, dirZ) || 1;
    this.dodgeDir = { x: dirX / l, z: dirZ / l };
    return true;
  }

  // ---------- viewmodel ----------
  viewmodelBoxes(g: any): Box[] {
    const boxes: Box[] = [];
    const skin: [number, number, number] = [0.78, 0.62, 0.47];
    const plate = this.armor.chest && this.armor.chest.id >= I.I_HELM;
    const sleeve: [number, number, number] = plate ? [0.62, 0.64, 0.68] : [0.42, 0.32, 0.2];
    const bob = this.moving ? Math.sin(this.walkPhase) * 0.025 : Math.sin(g.time * 1.6) * 0.006;
    const bobX = this.moving ? Math.cos(this.walkPhase * 0.5) * 0.02 : 0;
    const sway = Math.sin(this.pitch) * 0.12;
    const swing = g.swingT; // 0..1 attack anim
    const mine = g.mineT; // 0..1 mining anim
    const eat = g.eatT;
    const blocking = g.blocking;
    // right arm pivot
    let ax = 0.44 + bobX, ay = -0.5 + bob - sway, az = -0.45;
    let rot = 0;
    if (swing > 0) {
      const s = Math.sin(Math.PI * swing);
      rot = -s * 1.6; az -= s * 0.25; ax -= s * 0.15;
    } else if (mine > 0) {
      const s = Math.sin(Math.PI * ((mine * 3) % 1));
      rot = -s * 0.9; az -= s * 0.12;
    } else if (eat > 0) {
      const s = Math.sin(Math.PI * Math.min(1, eat * 2));
      ax = 0.3; ay = -0.32 - s * 0.02; az = -0.34 - s * 0.02;
    }
    const arm = (x: number, y: number, z: number, yaw2: number, skinHand: boolean): Box[] => [
      { x, y: y + 0.12, z: z + 0.14, sx: 0.14, sy: 0.14, sz: 0.42, r: sleeve[0], g: sleeve[1], b: sleeve[2], yaw: yaw2 },
      { x, y: y + 0.12, z: z - 0.18, sx: 0.13, sy: 0.13, sz: 0.25, r: skinHand ? skin[0] : sleeve[0], g: skinHand ? skin[1] : sleeve[1], b: skinHand ? skin[2] : sleeve[2], yaw: yaw2 },
    ];
    boxes.push(...arm(ax, ay, az, rot * 0.3, true));
    // left arm + shield
    const shield = this.armor.shield;
    if (blocking && shield) {
      boxes.push({ x: -0.05, y: -0.34 - sway, z: -0.62, sx: 0.5, sy: 0.62, sz: 0.07, r: 0.5, g: 0.38, b: 0.24, yaw: 0.15 });
      boxes.push({ x: -0.05, y: -0.34 - sway, z: -0.58, sx: 0.16, sy: 0.16, sz: 0.1, r: 0.75, g: 0.68, b: 0.3, yaw: 0.15 });
      boxes.push(...arm(-0.3, -0.42 - sway, -0.5, 0.4, true));
    } else {
      const lsway = this.moving ? Math.sin(this.walkPhase + Math.PI) * 0.03 : 0;
      boxes.push(...arm(-0.44 - bobX, -0.5 + bob - sway + lsway, -0.42, 0, true));
      if (shield) {
        boxes.push({ x: -0.52, y: -0.42 + bob - sway, z: -0.5, sx: 0.42, sy: 0.54, sz: 0.06, r: 0.5, g: 0.38, b: 0.24, yaw: 0.5 });
      }
    }
    // held item
    const held = this.held();
    if (held && !(blocking && shield)) {
      const def = ITEMS.get(held.id);
      const hx = ax - Math.sin(rot * 0.3) * 0.1, hy = ay + 0.16, hz = az - 0.38;
      if (def?.blockId !== undefined) {
        const bd = BLOCKS[def.blockId];
        const c = bd.color;
        const r = parseInt(c.slice(1, 3), 16) / 255, gg = parseInt(c.slice(3, 5), 16) / 255, bb = parseInt(c.slice(5, 7), 16) / 255;
        boxes.push({ x: hx, y: hy, z: hz, sx: 0.28, sy: 0.28, sz: 0.28, r, g: gg, b: bb, e: bd.light > 8 ? 0.9 : 0, yaw: rot * 0.3 });
      } else if (def?.kind === "weapon" || def?.kind === "tool" || def?.kind === "shield") {
        const iron = held.id >= I.I_SWORD && held.id <= I.I_SHOVEL;
        const stone = held.id >= I.S_SWORD && held.id <= I.S_SHOVEL;
        const hc: [number, number, number] = iron ? [0.85, 0.87, 0.9] : stone ? [0.55, 0.56, 0.55] : [0.65, 0.5, 0.3];
        const cls = def.toolClass;
        const yaw2 = rot * 0.3;
        if (cls === 4) { // sword — long blade up/forward
          boxes.push({ x: hx, y: hy + 0.05, z: hz, sx: 0.07, sy: 0.62, sz: 0.09, r: hc[0], g: hc[1], b: hc[2], yaw: yaw2 + 0.4 });
          boxes.push({ x: hx, y: hy - 0.24, z: hz, sx: 0.16, sy: 0.05, sz: 0.09, r: 0.75, g: 0.68, b: 0.3, yaw: yaw2 + 0.4 });
          boxes.push({ x: hx, y: hy - 0.36, z: hz + 0.02, sx: 0.06, sy: 0.18, sz: 0.06, r: 0.4, g: 0.3, b: 0.18, yaw: yaw2 + 0.4 });
        } else if (cls === 1) { // pick
          boxes.push({ x: hx, y: hy, z: hz, sx: 0.06, sy: 0.55, sz: 0.06, r: 0.5, g: 0.38, b: 0.24, yaw: yaw2 + 0.3 });
          boxes.push({ x: hx, y: hy + 0.28, z: hz, sx: 0.34, sy: 0.08, sz: 0.08, r: hc[0], g: hc[1], b: hc[2], yaw: yaw2 + 0.3 });
        } else if (cls === 2) { // axe
          boxes.push({ x: hx, y: hy, z: hz, sx: 0.06, sy: 0.55, sz: 0.06, r: 0.5, g: 0.38, b: 0.24, yaw: yaw2 + 0.3 });
          boxes.push({ x: hx + 0.1, y: hy + 0.26, z: hz, sx: 0.18, sy: 0.2, sz: 0.07, r: hc[0], g: hc[1], b: hc[2], yaw: yaw2 + 0.3 });
        } else if (cls === 3) { // shovel
          boxes.push({ x: hx, y: hy, z: hz, sx: 0.06, sy: 0.55, sz: 0.06, r: 0.5, g: 0.38, b: 0.24, yaw: yaw2 + 0.3 });
          boxes.push({ x: hx, y: hy + 0.3, z: hz, sx: 0.14, sy: 0.18, sz: 0.06, r: hc[0], g: hc[1], b: hc[2], yaw: yaw2 + 0.3 });
        } else { // shield in hand
          boxes.push({ x: hx - 0.1, y: hy, z: hz, sx: 0.4, sy: 0.5, sz: 0.06, r: 0.5, g: 0.38, b: 0.24, yaw: yaw2 });
        }
      } else if (def?.kind === "food" || def?.use) {
        const c: [number, number, number] = held.id === I.APPLE ? [0.75, 0.2, 0.15] : held.id === I.BREAD ? [0.78, 0.6, 0.33] : held.id === I.MEAT ? [0.65, 0.4, 0.22] : held.id === I.BERRIES ? [0.8, 0.35, 0.2] : held.id === I.STEW ? [0.55, 0.36, 0.17] : [0.9, 0.87, 0.78];
        boxes.push({ x: hx, y: hy + 0.05, z: hz, sx: 0.16, sy: 0.16, sz: 0.16, r: c[0], g: c[1], b: c[2], yaw: rot * 0.3 });
      } else {
        boxes.push({ x: hx, y: hy + 0.05, z: hz, sx: 0.14, sy: 0.14, sz: 0.3, r: 0.55, g: 0.42, b: 0.26, yaw: rot * 0.3 });
      }
    }
    // recoil
    const rec = g.recoil || 0;
    for (const b of boxes) { b.z += rec * 0.1; b.y -= rec * 0.05; }
    return boxes;
  }
}
