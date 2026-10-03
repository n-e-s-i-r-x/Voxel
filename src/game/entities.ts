// Emberfall entities: mobs with distinct AI, boss, item drops, particles.
import { Box } from "./engine";
import { B, BLOCKS } from "./blocks";
import { ItemStack, I } from "./items";
import { BIO } from "./world";

export interface MobDef {
  name: string; r: number; h: number; hp: number; spd: number; dmg: number; xp: number;
  hostile?: boolean; neutral?: boolean; aggro: number; sight: number; flee?: boolean;
  drops: [number, number, number][]; // [item, count, chance]
  night?: boolean; day?: boolean; cave?: boolean; dim1?: boolean; biomes?: number[];
  burnDay?: boolean; persist?: boolean; boss?: boolean; pack?: boolean;
}

export const MOBS: Record<string, MobDef> = {
  deer: { name: "Red Deer", r: 0.45, h: 1.3, hp: 12, spd: 3.4, dmg: 0, xp: 8, flee: true, neutral: true, aggro: 0, sight: 14, drops: [[I.MEAT_RAW, 2, 1], [I.HIDE, 1, 1]], day: true, biomes: [BIO.MEADOW, BIO.FOREST, BIO.BIRCH, BIO.PINE, BIO.HILLS] },
  boar: { name: "Wild Boar", r: 0.42, h: 0.85, hp: 18, spd: 3.0, dmg: 4, xp: 12, neutral: true, aggro: 6, sight: 10, drops: [[I.MEAT_RAW, 2, 1], [I.HIDE, 2, 0.8]], day: true, biomes: [BIO.FOREST, BIO.DARK, BIO.BIRCH, BIO.SWAMP] },
  wolf: { name: "Grey Wolf", r: 0.4, h: 0.9, hp: 22, spd: 4.2, dmg: 6, xp: 18, hostile: true, pack: true, aggro: 16, sight: 20, drops: [[I.HIDE, 2, 1], [I.BONE, 1, 0.6], [I.MEAT_RAW, 1, 0.4]], night: true, biomes: [BIO.FOREST, BIO.PINE, BIO.DARK, BIO.SNOW, BIO.HILLS, BIO.MEADOW] },
  bandit: { name: "Roadside Bandit", r: 0.38, h: 1.75, hp: 30, spd: 3.4, dmg: 8, xp: 26, hostile: true, aggro: 14, sight: 18, drops: [[I.COIN, 6, 1], [I.MEAT_RAW, 1, 0.5], [I.KEY, 1, 0.12], [I.S_SWORD, 1, 0.1], [I.BANDAGE, 1, 0.3]], night: true, biomes: [BIO.MEADOW, BIO.FOREST, BIO.HILLS, BIO.BIRCH, BIO.BADLANDS] },
  wight: { name: "Barrow Wight", r: 0.38, h: 1.75, hp: 26, spd: 3.0, dmg: 7, xp: 22, hostile: true, aggro: 13, sight: 16, burnDay: true, drops: [[I.BONE, 2, 1], [I.COIN, 2, 0.4], [I.RELIC, 1, 0.05]], night: true, cave: true, biomes: [BIO.MEADOW, BIO.FOREST, BIO.DARK, BIO.SWAMP, BIO.MOUNTAIN, BIO.SNOW, BIO.HILLS, BIO.BADLANDS] },
  bat: { name: "Cave Bat", r: 0.25, h: 0.35, hp: 6, spd: 4.5, dmg: 2, xp: 5, hostile: true, aggro: 8, sight: 12, cave: true, drops: [[I.BONE, 1, 0.3]] },
  wisp: { name: "Hollow Wisp", r: 0.3, h: 0.5, hp: 14, spd: 2.6, dmg: 5, xp: 20, hostile: true, dim1: true, aggro: 18, sight: 24, drops: [[I.EMBER, 1, 0.8], [I.EMBER, 1, 0.3]] },
  villager: { name: "Villager", r: 0.35, h: 1.7, hp: 30, spd: 2.0, dmg: 0, xp: 0, aggro: 0, sight: 8, flee: true, persist: true, drops: [] },
  elder: { name: "Eldric the Grey", r: 0.35, h: 1.7, hp: 40, spd: 1.6, dmg: 0, xp: 0, aggro: 0, sight: 10, persist: true, drops: [] },
  smith: { name: "Maud the Smith", r: 0.35, h: 1.7, hp: 40, spd: 1.6, dmg: 0, xp: 0, aggro: 0, sight: 10, persist: true, drops: [] },
  merchant: { name: "Wandering Merchant", r: 0.35, h: 1.7, hp: 30, spd: 2.2, dmg: 0, xp: 0, aggro: 0, sight: 10, drops: [] },
  barrowking: { name: "The Barrow King", r: 0.6, h: 2.6, hp: 260, spd: 2.8, dmg: 12, xp: 500, hostile: true, boss: true, aggro: 30, sight: 40, drops: [[I.CROWN, 1, 1], [I.COIN, 40, 1], [I.EMBER, 4, 1], [I.RELIC, 1, 0.6]] },
};

export class Mob {
  id: number; type: string; def: MobDef;
  x: number; y: number; z: number; vx = 0; vy = 0; vz = 0;
  yaw = 0; hp: number; maxhp: number;
  state: "idle" | "wander" | "chase" | "attack" | "flee" | "investigate" | "charge" | "whirl" = "idle";
  stateT = 0; attackT = 0; windup = 0; flash = 0; walkPhase = 0;
  tx = 0; ty = 0; tz = 0; // target point
  home: { x: number; y: number; z: number } | null = null;
  persist: boolean; name?: string; trade?: string;
  dead = false; deadT = 0; stuckT = 0; lastX = 0; lastZ = 0;
  aggroed = false; lastSeen: { x: number; y: number; z: number } | null = null; loseT = 0;
  phase = 1; summoned = false; roarT = 0; chargeDir = { x: 0, z: 0 };
  aiT = 0; // rate-limit timer
  onGround = false;

  constructor(id: number, type: string, x: number, y: number, z: number, opts?: { persist?: boolean; name?: string; trade?: string }) {
    this.id = id; this.type = type; this.def = MOBS[type];
    this.x = x; this.y = y; this.z = z;
    this.hp = this.maxhp = this.def.hp;
    this.persist = opts?.persist ?? this.def.persist ?? false;
    this.name = opts?.name; this.trade = opts?.trade;
    this.lastX = x; this.lastZ = z;
    this.tx = x; this.ty = y; this.tz = z;
  }
}

export interface ItemEnt { id: number; n: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; dur?: number; bonus?: number; }
export interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number; g: number; b: number; a: number; life: number; max: number; s: number; grav: number; }

let nextId = 1;

export class EntityManager {
  mobs: Mob[] = [];
  items: ItemEnt[] = [];
  particles: Particle[] = [];
  private pPool: Particle[] = [];
  spawnT = 0;
  boss: Mob | null = null;
  killedBarrows = new Set<string>();

  spawnMob(type: string, x: number, y: number, z: number, opts?: { persist?: boolean; name?: string; trade?: string }): Mob {
    const m = new Mob(nextId++, type, x, y, z, opts);
    this.mobs.push(m);
    return m;
  }
  drop(id: number, n: number, x: number, y: number, z: number, opts?: { dur?: number; bonus?: number }): void {
    if (this.items.length > 140) this.items.shift();
    const spread = () => (Math.random() - 0.5) * 1.6;
    this.items.push({ id, n, x: x + spread() * 0.3, y: y + 0.3, z: z + spread() * 0.3, vx: spread(), vy: 2.2, vz: spread(), t: 0, dur: opts?.dur, bonus: opts?.bonus });
  }
  burst(x: number, y: number, z: number, col: [number, number, number], n: number, spd = 3, grav = -9, life = 0.6, size = 0.09): void {
    for (let i = 0; i < n; i++) {
      let p = this.pPool.pop();
      if (!p) p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, a: 1, life: 1, max: 1, s: 0.1, grav: -9 };
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2;
      const v = spd * (0.4 + Math.random() * 0.8);
      p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(a) * Math.cos(e) * v; p.vy = Math.sin(e) * v + spd * 0.3; p.vz = Math.sin(a) * Math.cos(e) * v;
      p.r = col[0] * (0.8 + Math.random() * 0.3); p.g = col[1] * (0.8 + Math.random() * 0.3); p.b = col[2] * (0.8 + Math.random() * 0.3);
      p.a = 1; p.life = p.max = life * (0.6 + Math.random() * 0.8); p.s = size * (0.7 + Math.random() * 0.7); p.grav = grav;
      this.particles.push(p);
    }
    if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);
  }

  // ---------- spawning / despawning ----------
  spawnTick(g: any, dt: number): void {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 1.4;
    const w = g.world, p = g.player;
    if (!w || !p) return;
    const nonPersist = this.mobs.filter(m => !m.persist);
    const hostiles = nonPersist.filter(m => m.def.hostile).length;
    const passives = nonPersist.filter(m => !m.def.hostile).length;
    const daylight = g.daylight;
    const cave = p.y < w.heightAt(Math.floor(p.x), Math.floor(p.z)) - 3;
    const dim1 = w.dim === 1;
    // despawn far
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      if (m.persist || m.def.boss) continue;
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      if (d > 72) this.mobs.splice(i, 1);
    }
    if (nonPersist.length > 26) return;
    const ang = Math.random() * Math.PI * 2;
    const dist = 24 + Math.random() * 22;
    const x = p.x + Math.cos(ang) * dist, z = p.z + Math.sin(ang) * dist;
    const h = w.heightAt(Math.floor(x), Math.floor(z));
    if (h <= 22) return; // water
    const y = h + 1;
    const biome = w.biomeAt(Math.floor(x), Math.floor(z));
    const light = w.lightAt(Math.floor(x), Math.floor(y), Math.floor(z));
    const isNight = daylight < 0.22;
    const candidates: string[] = [];
    if (dim1) {
      if (hostiles < 10) candidates.push("wisp", "wisp", "bat");
    } else if (cave) {
      if (hostiles < 10) candidates.push("bat", "bat", "wight");
    } else if (isNight || light.sky < 0.4) {
      if (hostiles < g.hostileCap()) candidates.push("wolf", "wolf", "wight", "bandit", "wolf");
    } else {
      if (passives < 10) {
        const b = biome;
        if (b === BIO.MEADOW || b === BIO.HILLS || b === BIO.BIRCH) candidates.push("deer", "deer", "boar");
        else if (b === BIO.FOREST || b === BIO.DARK) candidates.push("boar", "deer", "boar");
        else if (b === BIO.PINE || b === BIO.SNOW) candidates.push("deer", "wolf");
        else if (b === BIO.SWAMP) candidates.push("boar");
      }
    }
    if (!candidates.length) return;
    const type = candidates[Math.floor(Math.random() * candidates.length)];
    const def = MOBS[type];
    if (def.biomes && !def.biomes.includes(biome) && !cave && !dim1) return;
    const m = this.spawnMob(type, x, y, z);
    if (type === "wolf" && Math.random() < 0.5) this.spawnMob("wolf", x + 2, y, z + 2);
    if (def.hostile) g.audio?.growl?.();
    void m;
  }

  triggerBoss(g: any, x: number, y: number, z: number): void {
    if (this.boss && !this.boss.dead) return;
    const key = `${Math.floor(x)}:${Math.floor(z)}`;
    if (this.killedBarrows.has(key)) return;
    const m = this.spawnMob("barrowking", x, y, z, { persist: true });
    m.aggroed = true;
    this.boss = m;
    g.audio?.bossRoar?.();
    g.toast?.("The Barrow King rises from his throne of bones!", "danger");
    g.events?.push?.({ type: "boss", t: 0 });
  }

  // ---------- updates ----------
  update(g: any, dt: number): void {
    const w = g.world, p = g.player;
    if (!w || !p) return;
    // mobs
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      if (m.dead) {
        m.deadT += dt;
        if (m.deadT > 1.4) { this.mobs.splice(i, 1); if (m === this.boss) this.boss = null; }
        continue;
      }
      const dx = p.x - m.x, dz = p.z - m.z;
      const distP = Math.hypot(dx, dz);
      if (distP > 90 && !m.persist) { this.mobs.splice(i, 1); continue; }
      // rate limit far mobs
      m.aiT -= dt;
      const near = distP < 40;
      if (!near && m.aiT > 0) continue;
      if (!near) m.aiT = 0.25;
      this.updateMob(g, m, dt, dx, dz, distP);
    }
    // items
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      if (it.t > 120) { this.items.splice(i, 1); continue; }
      // physics
      it.vy -= 18 * dt;
      it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
      it.vx *= 0.92; it.vz *= 0.92;
      if (w.isSolid(Math.floor(it.x), Math.floor(it.y - 0.15), Math.floor(it.z)) && it.vy < 0) {
        it.y = Math.floor(it.y - 0.15) + 1.15; it.vy = 0;
      }
      if (w.isFluid(Math.floor(it.x), Math.floor(it.y), Math.floor(it.z))) { it.vy = Math.min(it.vy + 24 * dt, 1.2); }
      const dp = Math.hypot(it.x - p.x, it.y - (p.y + 0.9), it.z - p.z);
      if (dp < 2.4 && it.t > 0.4) {
        const pull = 8 * dt / Math.max(dp, 0.3);
        it.x += (p.x - it.x) * pull; it.y += (p.y + 0.9 - it.y) * pull; it.z += (p.z - it.z) * pull;
      }
      if (dp < 0.9 && it.t > 0.4) {
        if (g.pickupItem(it)) this.items.splice(i, 1);
      }
    }
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { this.particles.splice(i, 1); this.pPool.push(pt); continue; }
      pt.vy += pt.grav * dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt;
      pt.a = Math.min(1, pt.life / pt.max * 2);
      if (w.isSolid(Math.floor(pt.x), Math.floor(pt.y), Math.floor(pt.z))) { pt.life = Math.min(pt.life, 0.1); pt.vy = 0; }
    }
  }

  private updateMob(g: any, m: Mob, dt: number, dx: number, dz: number, distP: number): void {
    const w = g.world, p = g.player, def = m.def;
    m.flash = Math.max(0, m.flash - dt);
    m.stateT += dt;
    const light = w.lightAt(Math.floor(m.x), Math.floor(m.y + 1), Math.floor(m.z));
    const daylight = g.daylight;
    // burning in daylight
    if (def.burnDay && daylight > 0.55 && light.sky > 0.7 && w.dim === 0) {
      m.hp -= 4 * dt;
      if (Math.random() < 0.3) this.burst(m.x, m.y + def.h * 0.6, m.z, [1, 0.55, 0.15], 1, 1.5, 3, 0.5);
      if (m.hp <= 0) { this.kill(g, m, false); return; }
    }
    // perception
    const canSee = distP < def.sight && (light.sky * daylight + light.torch > 0.15 || distP < 6);
    if (def.hostile && !m.aggroed && canSee && distP < def.aggro) {
      m.aggroed = true;
      m.lastSeen = { x: p.x, y: p.y, z: p.z };
      if (def.pack) for (const o of this.mobs) {
        if (o.type === m.type && !o.aggroed && Math.hypot(o.x - m.x, o.z - m.z) < 18) { o.aggroed = true; o.lastSeen = m.lastSeen; }
      }
      if (m.type === "wolf") g.audio?.growl?.();
      if (m.type === "wight") g.audio?.wightMoan?.();
      if (m.type === "bat") g.audio?.batScreech?.();
    }
    // hearing: mining/sprinting attracts
    if (g.noiseAt && (def.hostile || def.neutral) && !m.aggroed) {
      const n = g.noiseAt;
      if (Math.hypot(n.x - m.x, n.z - m.z) < 10 && m.state !== "investigate") {
        m.state = "investigate"; m.stateT = 0; m.tx = n.x; m.ty = n.y; m.tz = n.z;
      }
    }

    // state machine
    const wantsFight = m.aggroed && (def.hostile || def.neutral);
    if (def.flee && !m.persist && (distP < (m.aggroed ? 10 : 6)) && (m.aggroed || distP < 4)) {
      m.state = "flee";
    } else if (wantsFight && m.hp > 0) {
      m.lastSeen = { x: p.x, y: p.y, z: p.z };
      m.loseT = 0;
      const reach = def.boss ? 2.6 : 1.5;
      if (m.state === "charge") {
        // charging
        m.vx = m.chargeDir.x * 9; m.vz = m.chargeDir.z * 9;
        m.yaw = Math.atan2(m.chargeDir.x, -m.chargeDir.z);
        if (m.stateT > 0.75) { m.state = "chase"; m.stateT = 0; }
        if (distP < 1.3) this.hurtPlayer(g, m, def.dmg + 4);
      } else if (m.state === "whirl") {
        m.vx = 0; m.vz = 0; m.yaw += dt * 9;
        if (m.stateT > 0.2 && m.stateT < 0.55 && distP < 3.2 && !(m as any)._whirlHit) {
          (m as any)._whirlHit = true;
          this.hurtPlayer(g, m, 8);
        }
        if (m.stateT > 0.8) { m.state = "chase"; m.stateT = 0; m.attackT = 0.8; }
      } else if (distP < reach && m.attackT <= 0) {
        (m as any)._whirlHit = false;
        m.state = "attack"; m.stateT = 0; m.windup = def.boss ? 0.55 : 0.4;
        m.attackT = def.boss ? 2.2 : 1.6;
      } else if (def.boss && m.phase >= 1) {
        if (m.phase === 1 && m.hp < m.maxhp * 0.5) {
          m.phase = 2;
          g.audio?.bossRoar?.();
          g.toast?.("The Barrow King enters his second reign!", "danger");
          if (!m.summoned) {
            m.summoned = true;
            for (let k = 0; k < 3; k++) this.spawnMob("wight", m.x + (k - 1) * 2, m.y, m.z + 2);
          }
        }
        if (m.phase === 2 && m.attackT > 1.4 && distP < 3.5 && Math.random() < 0.02) {
          m.state = "whirl"; m.stateT = 0;
        } else if (distP > 4 && distP < 14 && m.attackT > 1.0 && Math.random() < 0.012) {
          m.state = "charge"; m.stateT = 0;
          const l = Math.hypot(dx, dz) || 1;
          m.chargeDir = { x: dx / l, z: dz / l };
        } else { m.state = "chase"; this.moveToward(g, m, p.x, p.z, def.spd * (m.phase === 2 ? 1.25 : 1), dt); }
      } else {
        m.state = "chase";
        this.moveToward(g, m, p.x, p.z, def.spd, dt);
      }
      m.attackT -= dt;
      if (m.state === "attack") {
        m.vx = 0; m.vz = 0;
        m.yaw = Math.atan2(dx, -dz);
        if (m.stateT > m.windup && m.stateT < m.windup + 0.15 && distP < (def.boss ? 3 : 1.8)) {
          this.hurtPlayer(g, m, def.dmg);
          m.stateT = 99; // one hit
        }
        if (m.stateT > m.windup + 0.5) { m.state = "chase"; m.stateT = 0; }
      }
    } else if (m.aggroed) {
      // lost target
      m.loseT += dt;
      if (m.lastSeen) this.moveToward(g, m, m.lastSeen.x, m.lastSeen.z, def.spd, dt);
      if (m.loseT > 6) { m.aggroed = false; m.lastSeen = null; m.state = "wander"; }
    } else {
      // peaceful behaviors
      if (m.persist) {
        // villager routine
        const isNight = daylight < 0.2;
        if (isNight) { m.state = "idle"; m.vx = 0; m.vz = 0; }
        else if (m.state === "idle" && m.stateT > 2 + Math.random() * 4) {
          m.state = "wander"; m.stateT = 0;
          const hx = m.home?.x ?? m.x, hz = m.home?.z ?? m.z;
          m.tx = hx + (Math.random() - 0.5) * 10; m.tz = hz + (Math.random() - 0.5) * 10;
          m.ty = w.heightAt(Math.floor(m.tx), Math.floor(m.tz)) + 1;
        } else if (m.state === "wander") {
          if (Math.hypot(m.tx - m.x, m.tz - m.z) < 1 || m.stateT > 6) { m.state = "idle"; m.stateT = 0; }
          else this.moveToward(g, m, m.tx, m.tz, def.spd, dt);
        }
      } else if (def.flee && m.state === "flee") {
        const l = Math.hypot(dx, dz) || 1;
        this.moveToward(g, m, m.x - dx / l * 10, m.z - dz / l * 10, def.spd * 1.3, dt);
        if (distP > 16) { m.state = "idle"; m.stateT = 0; m.aggroed = false; }
      } else if (m.state === "investigate") {
        if (Math.hypot(m.tx - m.x, m.tz - m.z) < 1.5 || m.stateT > 8) { m.state = "idle"; m.stateT = 0; }
        else this.moveToward(g, m, m.tx, m.tz, def.spd * 0.8, dt);
      } else if (m.state === "idle" && m.stateT > 1.5 + Math.random() * 4) {
        m.state = "wander"; m.stateT = 0;
        m.tx = m.x + (Math.random() - 0.5) * 14; m.tz = m.z + (Math.random() - 0.5) * 14;
      } else if (m.state === "wander") {
        if (Math.hypot(m.tx - m.x, m.tz - m.z) < 1.2 || m.stateT > 7) { m.state = "idle"; m.stateT = 0; }
        else this.moveToward(g, m, m.tx, m.tz, def.spd * 0.45, dt);
      }
      // wisp floats
      if (m.type === "wisp") {
        m.vy = Math.sin(g.time * 2 + m.id) * 0.8;
        m.y += m.vy * dt;
        if (w.isSolid(Math.floor(m.x), Math.floor(m.y - 0.2), Math.floor(m.z))) m.y += 0.5 * dt * 10;
      }
      if (m.type === "bat") m.y += Math.sin(g.time * 6 + m.id) * 0.6 * dt;
    }
    // physics
    if (m.type !== "wisp") {
      m.vy -= 24 * dt;
      const inWater = w.isFluid(Math.floor(m.x), Math.floor(m.y + 0.3), Math.floor(m.z));
      if (inWater) m.vy = Math.min(m.vy + 30 * dt, 2.4);
    }
    m.x += m.vx * dt; m.z += m.vz * dt;
    this.collide(g, m);
    m.y += m.vy * dt;
    const feetBlock = Math.floor(m.y - 0.05);
    if (m.vy <= 0 && w.isSolid(Math.floor(m.x), feetBlock, Math.floor(m.z))) {
      m.y = feetBlock + 1; m.vy = 0; m.onGround = true;
    } else m.onGround = false;
    if (m.y < -5) { this.kill(g, m, false); return; }
    // walk anim
    const spd = Math.hypot(m.vx, m.vz);
    if (spd > 0.3) { m.walkPhase += dt * (6 + spd * 2); m.yaw = Math.atan2(m.vx, -m.vz); }
    // stuck detection
    if (spd > 0.5 && Math.hypot(m.x - m.lastX, m.z - m.lastZ) < 0.02) {
      m.stuckT += dt;
      if (m.stuckT > 1.2 && m.onGround) { m.vy = 8; m.stuckT = 0; }
    } else m.stuckT = 0;
    m.lastX = m.x; m.lastZ = m.z;
  }

  private moveToward(g: any, m: Mob, tx: number, tz: number, spd: number, dt: number): void {
    const w = g.world;
    const dx = tx - m.x, dz = tz - m.z;
    const l = Math.hypot(dx, dz) || 1;
    let nx = dx / l, nz = dz / l;
    // obstacle ahead?
    const ax = Math.floor(m.x + nx * (m.def.r + 0.3)), az = Math.floor(m.z + nz * (m.def.r + 0.3));
    const fy = Math.floor(m.y);
    if (w.isSolid(ax, fy, az)) {
      if (!w.isSolid(ax, fy + 1, az) && m.onGround) m.vy = 8.2; // jump
      else {
        // sidestep
        const px = -nz, pz = nx;
        const side = Math.sin(m.id * 13.7 + Math.floor(g.time)) > 0 ? 1 : -1;
        nx = px * side; nz = pz * side;
      }
    }
    // don't walk into deep water / off cliffs unless chasing
    if (!m.aggroed) {
      const ahead = Math.floor(m.y) - 1;
      if (!w.isSolid(Math.floor(m.x + nx), ahead, Math.floor(m.z + nz)) && !w.isFluid(Math.floor(m.x + nx), ahead, Math.floor(m.z + nz))) {
        if (Math.random() < 0.3) { m.state = "idle"; m.stateT = 0; }
        return;
      }
    }
    m.vx = nx * spd; m.vz = nz * spd;
    void dt;
  }
  private collide(g: any, m: Mob): void {
    const w = g.world;
    const r = m.def.r;
    for (const [ox, oz] of [[r, 0], [-r, 0], [0, r], [0, -r]] as [number, number][]) {
      const bx = Math.floor(m.x + ox), bz = Math.floor(m.z + oz);
      for (const dy of [0.2, m.def.h * 0.5, m.def.h - 0.1]) {
        if (w.isSolid(bx, Math.floor(m.y + dy), bz)) {
          if (ox > 0) m.x = bx - r - 0.01; else if (ox < 0) m.x = bx + 1 + r + 0.01;
          if (oz > 0) m.z = bz - r - 0.01; else if (oz < 0) m.z = bz + 1 + r + 0.01;
        }
      }
    }
  }

  hurtPlayer(g: any, m: Mob, dmg: number): void {
    if (g.playerHurt) g.playerHurt(dmg, m);
    m.attackT = Math.max(m.attackT, 0.5);
  }

  damage(g: any, m: Mob, dmg: number, kx: number, kz: number, byPlayer: boolean): void {
    if (m.dead) return;
    m.hp -= dmg;
    m.flash = 0.15;
    m.vx += kx * 4; m.vz += kz * 4;
    this.burst(m.x, m.y + m.def.h * 0.6, m.z, [0.55, 0.08, 0.05], 8, 3, -8, 0.5);
    if (byPlayer) {
      if (m.def.neutral || m.def.hostile || m.def.boss) { m.aggroed = true; m.lastSeen = { x: g.player.x, y: g.player.y, z: g.player.z }; }
      if (m.def.pack && m.type === "wolf") for (const o of this.mobs) if (o.type === "wolf" && Math.hypot(o.x - m.x, o.z - m.z) < 18) o.aggroed = true;
      g.audio?.hitMob?.(dmg > 10);
    }
    g.hooks?.onHitMob?.(m);
    if (m.hp <= 0) this.kill(g, m, byPlayer);
  }
  kill(g: any, m: Mob, byPlayer: boolean): void {
    if (m.dead) return;
    m.dead = true; m.deadT = 0;
    const def = m.def;
    this.burst(m.x, m.y + def.h * 0.5, m.z, [0.6, 0.1, 0.08], 14, 3.5, -7, 0.8);
    if (byPlayer) {
      for (const [id, n, ch] of def.drops) if (Math.random() < ch) this.drop(id, n, m.x, m.y + 0.5, m.z);
      if (def.xp) g.gainXP?.(def.xp);
      g.hooks?.onKill?.(m);
      if (def.boss) {
        const key = `${Math.floor(m.x)}:${Math.floor(m.z)}`;
        this.killedBarrows.add(key);
        g.hooks?.onBossKill?.(m);
      }
    }
  }

  // ---------- meshes ----------
  mobBoxes(m: Mob, t: number): Box[] {
    if (m.dead) {
      const s = Math.max(0, 1 - m.deadT / 1.2);
      return [{ x: m.x, y: m.y + 0.1, z: m.z, sx: m.def.h * s * 0.9, sy: 0.2 * s + 0.02, sz: m.def.r * 2 * s + 0.1, r: 0.3, g: 0.08, b: 0.06 }];
    }
    const yaw = m.yaw;
    const sw = Math.sin(m.walkPhase) * 0.35;
    const windupPose = m.state === "attack" && m.stateT < m.windup ? 1 : 0;
    const flash = m.flash > 0;
    const C = (r: number, g2: number, b: number): [number, number, number] => flash ? [1, 1, 1] : [r, g2, b];
    const boxes: Box[] = [];
    const add = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: [number, number, number], e = 0, forward = 0, up = 0) => {
      // forward/up offsets relative to yaw
      const fx = Math.sin(yaw), fz = -Math.cos(yaw);
      boxes.push({ x: m.x + fx * forward + x, y: m.y + y + up, z: m.z + fz * forward + z, sx, sy, sz, r: c[0], g: c[1], b: c[2], e, yaw });
    };
    const type = m.type;
    if (type === "deer") {
      add(0, 0.75, 0, 0.5, 0.55, 1.0, C(0.62, 0.48, 0.32));
      add(0, 1.25, 0.55, 0.28, 0.35, 0.3, C(0.66, 0.52, 0.36));
      add(0, 1.5, 0.6, 0.1, 0.25, 0.08, C(0.75, 0.68, 0.55)); // antlers
      add(0.12, 1.5, 0.6, 0.06, 0.2, 0.06, C(0.75, 0.68, 0.55));
      add(-0.12, 1.5, 0.6, 0.06, 0.2, 0.06, C(0.75, 0.68, 0.55));
      for (const [lx, lz, ph] of [[-0.18, 0.35, sw], [0.18, 0.35, -sw], [-0.18, -0.35, -sw], [0.18, -0.35, sw]])
        add(lx, 0.25, lz, 0.12, 0.5, 0.12, C(0.5, 0.38, 0.25), 0, Math.sin(ph) * 0.15);
    } else if (type === "boar") {
      add(0, 0.45, 0, 0.6, 0.55, 0.95, C(0.32, 0.23, 0.16));
      add(0, 0.5, 0.55, 0.35, 0.35, 0.35, C(0.28, 0.2, 0.14));
      add(0.1, 0.42, 0.75, 0.06, 0.1, 0.06, C(0.9, 0.88, 0.8));
      add(-0.1, 0.42, 0.75, 0.06, 0.1, 0.06, C(0.9, 0.88, 0.8));
      for (const [lx, lz, ph] of [[-0.2, 0.3, sw], [0.2, 0.3, -sw], [-0.2, -0.3, -sw], [0.2, -0.3, sw]])
        add(lx, 0.12, lz, 0.13, 0.25, 0.13, C(0.22, 0.15, 0.1), 0, Math.sin(ph) * 0.1);
    } else if (type === "wolf") {
      const agg = m.aggroed;
      add(0, 0.55, 0, 0.42, 0.42, 0.95, C(0.42, 0.42, 0.45));
      add(0, 0.8, 0.5, 0.3, 0.3, 0.38, C(0.5, 0.5, 0.53));
      add(0.08, 0.98, 0.55, 0.08, 0.1, 0.06, C(0.35, 0.35, 0.38));
      add(-0.08, 0.98, 0.55, 0.08, 0.1, 0.06, C(0.35, 0.35, 0.38));
      add(0, 0.83, 0.62, 0.12, 0.1, 0.14, C(0.3, 0.3, 0.33));
      add(0.09, 0.88, 0.72, 0.05, 0.05, 0.03, agg ? [0.95, 0.15, 0.1] : [0.8, 0.7, 0.3], agg ? 1 : 0);
      add(-0.09, 0.88, 0.72, 0.05, 0.05, 0.03, agg ? [0.95, 0.15, 0.1] : [0.8, 0.7, 0.3], agg ? 1 : 0);
      add(0, 0.62, -0.55, 0.1, 0.1, 0.3, C(0.45, 0.45, 0.48));
      for (const [lx, lz, ph] of [[-0.14, 0.32, sw], [0.14, 0.32, -sw], [-0.14, -0.32, -sw], [0.14, -0.32, sw]])
        add(lx, 0.18, lz, 0.11, 0.36, 0.11, C(0.36, 0.36, 0.4), 0, Math.sin(ph) * 0.12);
    } else if (type === "bat") {
      const fl = Math.sin(t * 18 + m.id) * 0.5;
      add(0, 0, 0, 0.22, 0.22, 0.3, C(0.16, 0.13, 0.16));
      add(0.25, fl * 0.2, 0, 0.35, 0.04, 0.25, C(0.2, 0.16, 0.2));
      add(-0.25, -fl * 0.2, 0, 0.35, 0.04, 0.25, C(0.2, 0.16, 0.2));
      add(0.05, 0.05, 0.16, 0.04, 0.04, 0.02, [1, 0.3, 0.2], 1);
      add(-0.05, 0.05, 0.16, 0.04, 0.04, 0.02, [1, 0.3, 0.2], 1);
    } else if (type === "wisp") {
      const pu = 0.8 + Math.sin(t * 5 + m.id) * 0.2;
      add(0, 0, 0, 0.34 * pu, 0.34 * pu, 0.34 * pu, [0.45, 0.95, 0.7], 1);
      add(0, 0.3, 0, 0.14, 0.14, 0.14, [0.75, 1, 0.85], 1);
    } else if (type === "barrowking") {
      const bone: [number, number, number] = C(0.82, 0.8, 0.7);
      const dark: [number, number, number] = C(0.25, 0.1, 0.08);
      const gold: [number, number, number] = [0.9, 0.72, 0.25];
      const ph2 = m.phase === 2;
      add(0, 1.15, 0, 0.75, 1.1, 0.45, dark); // torso w/ cape
      add(0, 2.0, 0, 0.5, 0.55, 0.45, bone); // skull
      add(0.12, 2.05, 0.2, 0.1, 0.1, 0.06, ph2 ? [1, 0.3, 0.1] : [0.9, 0.55, 0.15], 1);
      add(-0.12, 2.05, 0.2, 0.1, 0.1, 0.06, ph2 ? [1, 0.3, 0.1] : [0.9, 0.55, 0.15], 1);
      add(0, 2.38, 0, 0.55, 0.18, 0.5, gold, 0.4); // crown
      add(0.16, 2.55, 0, 0.1, 0.22, 0.1, gold, 0.4);
      add(-0.16, 2.55, 0, 0.1, 0.22, 0.1, gold, 0.4);
      add(0, 2.55, 0.16, 0.1, 0.2, 0.1, gold, 0.4);
      // arms + great blade
      const raise = windupPose * 0.8 + (m.state === "whirl" ? 0.6 : 0);
      add(0.48, 1.55 + raise * 0.4, 0.1, 0.18, 0.85, 0.18, bone, 0, 0.1, raise * 0.3);
      add(-0.48, 1.55 + raise * 0.2, 0, 0.18, 0.85, 0.18, bone);
      add(0.48, 2.1 + raise * 0.8, 0.45, 0.09, 1.5, 0.3, [0.55, 0.58, 0.6], 0.15, 0.1 + raise * 0.2, raise * 0.4);
      for (const [lx, lz, ph] of [[-0.22, 0.1, sw], [0.22, 0.1, -sw], [-0.22, -0.2, -sw], [0.22, -0.2, sw]])
        add(lx, 0.35, lz, 0.2, 0.75, 0.2, bone, 0, Math.sin(ph) * 0.2);
    } else {
      // humanoids: villager / elder / smith / merchant / bandit / wight
      const isWight = type === "wight";
      const isBandit = type === "bandit";
      const skin: [number, number, number] = isWight ? C(0.6, 0.68, 0.55) : C(0.78, 0.62, 0.47);
      const robe: [number, number, number] = isWight ? C(0.25, 0.3, 0.24) :
        isBandit ? C(0.45, 0.18, 0.13) :
        type === "elder" ? C(0.45, 0.45, 0.47) :
        type === "smith" ? C(0.3, 0.26, 0.22) :
        type === "merchant" ? C(0.24, 0.38, 0.36) : C(0.45, 0.35, 0.22);
      add(0, 1.15, 0, 0.55, 0.75, 0.32, robe);
      add(0, 1.62, 0, 0.42, 0.42, 0.42, skin);
      if (type === "elder") { add(0, 1.48, 0.2, 0.28, 0.2, 0.1, C(0.85, 0.85, 0.82)); add(0, 1.92, 0, 0.46, 0.14, 0.46, C(0.5, 0.5, 0.52)); }
      if (type === "smith") add(0, 1.15, 0.17, 0.4, 0.7, 0.05, C(0.2, 0.18, 0.16));
      if (type === "merchant") add(0, 1.92, 0, 0.5, 0.12, 0.5, C(0.75, 0.65, 0.3));
      if (isBandit) { add(0, 1.72, 0, 0.45, 0.2, 0.45, C(0.2, 0.15, 0.12)); add(0, 1.58, 0.21, 0.3, 0.12, 0.03, C(0.2, 0.15, 0.12)); }
      if (isWight) {
        add(0.09, 1.66, 0.21, 0.06, 0.06, 0.02, [0.5, 1, 0.6], 1);
        add(-0.09, 1.66, 0.21, 0.06, 0.06, 0.02, [0.5, 1, 0.6], 1);
      } else {
        add(0.09, 1.66, 0.21, 0.05, 0.06, 0.02, C(0.15, 0.12, 0.1));
        add(-0.09, 1.66, 0.21, 0.05, 0.06, 0.02, C(0.15, 0.12, 0.1));
      }
      const armRaise = windupPose;
      add(0.36, 1.3 + armRaise * 0.35, armRaise * 0.25, 0.15, 0.6, 0.15, robe, 0, 0, armRaise * 0.15);
      add(-0.36, 1.3, 0, 0.15, 0.6, 0.15, robe);
      if (isBandit || (isWight && m.aggroed)) add(0.36, 1.1 + armRaise * 0.7, 0.35 + armRaise * 0.2, 0.07, 0.55, 0.07, [0.6, 0.62, 0.65], 0.1);
      for (const [lx, ph] of [[-0.14, sw], [0.14, -sw]])
        add(lx, 0.4, Math.sin(ph) * 0.15, 0.18, 0.8, 0.18, isWight ? C(0.2, 0.24, 0.2) : C(0.3, 0.24, 0.18), 0);
      if (type === "villager" || type === "merchant") add(0, 1.95, 0, 0.4, 0.12, 0.4, C(0.72, 0.62, 0.34));
    }
    return boxes;
  }
  itemBoxes(it: ItemEnt, t: number): Box[] {
    const bd = it.id < 256 ? BLOCKS[it.id] : null;
    let r = 0.8, g2 = 0.7, b = 0.3;
    if (bd) {
      const c = bd.color;
      r = parseInt(c.slice(1, 3), 16) / 255; g2 = parseInt(c.slice(3, 5), 16) / 255; b = parseInt(c.slice(5, 7), 16) / 255;
    } else {
      const cols: Record<number, [number, number, number]> = {
        [I.COIN]: [0.95, 0.8, 0.3], [I.IRON]: [0.8, 0.8, 0.78], [I.GOLD]: [0.95, 0.82, 0.35],
        [I.EMBER]: [1, 0.5, 0.15], [I.MEAT_RAW]: [0.8, 0.4, 0.35], [I.MEAT]: [0.65, 0.4, 0.22],
        [I.APPLE]: [0.75, 0.2, 0.15], [I.BERRIES]: [0.8, 0.35, 0.2], [I.BREAD]: [0.78, 0.6, 0.33],
        [I.HIDE]: [0.65, 0.47, 0.31], [I.BONE]: [0.9, 0.87, 0.77], [I.STICK]: [0.55, 0.42, 0.26],
        [I.COAL]: [0.2, 0.2, 0.2], [I.CROWN]: [0.95, 0.8, 0.3], [I.RELIC]: [0.85, 0.85, 0.75],
        [I.KEY]: [0.6, 0.55, 0.45], [I.WHEAT]: [0.85, 0.72, 0.38], [I.MUSH]: [0.55, 0.42, 0.3],
        [I.STEW]: [0.55, 0.36, 0.17], [I.BANDAGE]: [0.9, 0.87, 0.78], [I.WOOL_ITEM]: [0.9, 0.87, 0.8],
      };
      const c = cols[it.id] || [0.7, 0.7, 0.7];
      r = c[0]; g2 = c[1]; b = c[2];
      if ([I.S_SWORD, I.I_SWORD, I.W_SWORD, I.S_PICK, I.I_PICK, I.W_PICK, I.SHIELD_W, I.SHIELD_I, I.I_HELM, I.I_PLATE, I.I_LEGS, I.L_CAP, I.L_TUNIC, I.L_LEGS, I.W_AXE, I.S_AXE, I.I_AXE, I.W_SHOVEL, I.S_SHOVEL, I.I_SHOVEL].includes(it.id)) {
        r = 0.6; g2 = 0.62; b = 0.66;
        if (it.id >= I.W_SWORD && it.id <= I.W_SHOVEL) { r = 0.6; g2 = 0.48; b = 0.3; }
      }
    }
    const bob = Math.sin(t * 2.5 + it.x * 7 + it.z * 3) * 0.12;
    const e = it.id === I.EMBER ? 0.8 : it.id === I.CROWN ? 0.4 : 0;
    return [{ x: it.x, y: it.y + bob, z: it.z, sx: 0.28, sy: 0.28, sz: 0.28, r, g: g2, b, e, yaw: t * 2 + it.x }];
  }
  serializePersistent(): any[] {
    return this.mobs.filter(m => m.persist && !m.def.boss).map(m => ({
      type: m.type, x: m.x, y: m.y, z: m.z, name: m.name, trade: m.trade,
      home: m.home, hp: m.hp,
    }));
  }
  restorePersistent(data: any[]): void {
    for (const d of data || []) {
      const m = this.spawnMob(d.type, d.x, d.y, d.z, { persist: true, name: d.name, trade: d.trade });
      m.home = d.home; m.hp = d.hp || m.maxhp;
    }
  }
}
