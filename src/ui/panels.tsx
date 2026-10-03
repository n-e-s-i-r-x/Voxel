import React, { useState } from "react";
import { G, useGame, Settings, PRESETS, QUESTS } from "../game/game";
import { iconFor, ITEMS, I, RECIPES, SMELTS, FUEL, maxDur, Recipe, ItemStack, stackName } from "../game/items";
import { B, BLOCKS } from "../game/blocks";
import { SKILLS } from "../game/player";

const ADVS = [
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

function Shell({ title, children, wide, onClose }: { title: string; children: React.ReactNode; wide?: boolean; onClose?: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 anim-fade p-3" onPointerDown={(e) => { if (e.target === e.currentTarget) (onClose || G.closePanel.bind(G))(); }}>
      <div className={`panel-parch notch relative ${wide ? "w-[860px]" : "w-[560px]"} max-w-[96vw] max-h-[92vh] flex flex-col anim-fade-up`}>
        <div className="flex items-center justify-between px-5 pt-3.5 pb-2">
          <h2 className="font-display font-bold text-[20px] tracking-[0.12em] uppercase text-[#2b2118]">{title}</h2>
          <button className="btn btn-sm !text-[#2b2118] !bg-[#c9b584] !shadow-none border-[#4a3a22]" onClick={onClose || G.closePanel.bind(G)}>✕</button>
        </div>
        <div className="rule-gold mx-5" />
        <div className="p-5 overflow-y-auto scroll-dark">{children}</div>
      </div>
    </div>
  );
}
function Slot({ s, onClick, sel, small }: { s: ItemStack | null; onClick?: () => void; sel?: boolean; small?: boolean }) {
  return (
    <div className={`slot ${sel ? "sel" : ""} ${small ? "!w-[46px] !h-[46px]" : ""}`} onClick={onClick} title={s ? tooltip(s) : ""}>
      {s && <img src={iconFor(s.id)} alt="" />}
      {s && s.n > 1 && <span className="cnt">{s.n}</span>}
      {s && maxDur(s.id) > 0 && s.dur !== undefined && <span className="dur"><i style={{ width: `${Math.max(0, (s.dur / maxDur(s.id)) * 100)}%` }} /></span>}
    </div>
  );
}
function tooltip(s: ItemStack): string {
  const d = ITEMS.get(s.id);
  if (!d) return "";
  let t = d.name;
  if (d.dmg) t += ` — dmg ${d.dmg}`;
  if (d.armor) t += ` — armor ${d.armor}${s.bonus ? ` (+${s.bonus})` : ""}`;
  if (d.food) t += ` — food ${d.food}`;
  if (d.blockPct) t += ` — blocks ${Math.round(d.blockPct * 100)}%`;
  if (maxDur(s.id)) t += `\nDurability ${Math.max(0, Math.round(s.dur ?? maxDur(s.id)))}/${maxDur(s.id)}`;
  if (d.desc) t += `\n${d.desc}`;
  return t;
}
function CursorItem() {
  const { g } = useGame();
  const c = g.getCursor();
  const [pos, setPos] = useState({ x: -100, y: -100 });
  React.useEffect(() => {
    const mv = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", mv);
    return () => window.removeEventListener("mousemove", mv);
  }, []);
  if (!c) return null;
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <img src={iconFor(c.id)} alt="" className="absolute" style={{ left: pos.x - 18, top: pos.y - 18, width: 36, imageRendering: "pixelated" }} />
      {c.n > 1 && <span className="absolute text-[12px] font-bold text-white" style={{ left: pos.x + 8, top: pos.y + 4, textShadow: "0 1px 0 #000" }}>{c.n}</span>}
    </div>
  );
}

export function Panels() {
  const { g } = useGame();
  switch (g.panel) {
    case "inv": return <InventoryPanel />;
    case "craft": return <CraftPanel />;
    case "furnace": return <FurnacePanel />;
    case "chest": case "barrel": return <ChestPanel barrel={g.panel === "barrel"} />;
    case "trade": return <TradePanel />;
    case "skills": return <SkillsPanel />;
    case "quests": return <QuestPanel />;
    case "adv": return <AdvPanel />;
    case "map": return <MapPanel />;
    case "pause": return <PausePanel />;
    case "settings": return <SettingsPanel />;
    case "controls": return <ControlsPanel />;
    case "credits": return <CreditsPanel />;
    case "dialog": return <DialogPanel />;
    default: return null;
  }
}

function InventoryPanel() {
  const { g } = useGame();
  const p = g.player;
  return (
    <Shell title="Traveler's Pack" wide>
      <CursorItem />
      <div className="flex gap-5 flex-wrap md:flex-nowrap">
        <div className="flex flex-col gap-2">
          <div className="font-display text-[12px] tracking-widest uppercase text-[#6e5a3a]">Equipment</div>
          {(["head", "chest", "legs", "shield"] as const).map(slot => (
            <div key={slot} className="flex items-center gap-2">
              <Slot s={p.armor[slot]} onClick={() => G.armorClick(slot)} />
              <span className="text-[12px] text-[#4a3a22] capitalize w-16">{slot}</span>
            </div>
          ))}
          <div className="rule-gold my-1" />
          <div className="text-[13px] text-[#2b2118] flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="#d4a63f" stroke="#8a6c34" strokeWidth="1.4" /></svg>
            <b>{p.coins}</b> old coins
          </div>
          <div className="text-[12px] text-[#4a3a22]">Armor: <b>{p.armorVal}</b> · Melee: <b>{p.meleeDmg.toFixed(1)}</b></div>
          <button className="btn btn-sm" onClick={() => G.sortInv()}>Sort Pack</button>
          {g.getCursor() && <button className="btn btn-sm btn-blood" onClick={() => G.dropCursor()}>Drop held</button>}
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-9 gap-1 justify-start">
            {p.inv.slice(9, 36).map((s, i) => <Slot key={i + 9} s={s} onClick={() => G.invClick(i + 9)} />)}
          </div>
          <div className="rule-gold my-3" />
          <div className="grid grid-cols-9 gap-1 justify-start">
            {p.inv.slice(0, 9).map((s, i) => <Slot key={i} s={s} onClick={() => G.invClick(i)} sel={i === p.sel} />)}
          </div>
          <p className="text-[12px] text-[#6e5a3a] mt-3 italic">Click to lift or set down. A workbench nearby unlocks heavier crafting — press C beside one.</p>
        </div>
      </div>
    </Shell>
  );
}

function CraftPanel() {
  const { g } = useGame();
  const [tab, setTab] = useState<"all" | "hand" | "table">("all");
  const p = g.player;
  const list = RECIPES.filter(r => tab === "all" || r.station === tab);
  return (
    <Shell title={g.nearTable ? "Workbench" : "Hand Crafting"} wide>
      {!g.nearTable && <div className="mb-3 text-[13px] px-3 py-2 bg-[#4a3a22]/15 border border-[#8a6c34]/40 text-[#4a3a22]">You work with bare hands. Stand beside a <b>workbench</b> to unlock tools, armor and more.</div>}
      <div className="flex gap-2 mb-3">
        {([["all", "All"], ["hand", "By Hand"], ["table", "Workbench"]] as const).map(([k, l]) => (
          <button key={k} className={`btn btn-sm ${tab === k ? "btn-ember" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {list.map((r, i) => {
          const can = G.canCraft(r);
          return (
            <div key={i} className={`flex items-center gap-2 p-2 border ${can ? "border-[#7a8450] bg-[#7a8450]/10" : "border-[#8a6c34]/30 bg-black/5 opacity-80"}`}>
              <Slot s={{ id: r.out.id, n: r.out.n }} small />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px] text-[#2b2118] truncate">{ITEMS.get(r.out.id)?.name}{r.out.n > 1 ? ` ×${r.out.n}` : ""}</div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {r.ing.map(([id, n], j) => {
                    const have = p.countItem(id);
                    return (
                      <span key={j} className="flex items-center gap-0.5 text-[11px]" title={ITEMS.get(id)?.name}>
                        <img src={iconFor(id)} alt="" style={{ width: 16, imageRendering: "pixelated" }} />
                        <span className={have >= n ? "text-[#4a6a3a]" : "text-[#96301f] font-bold"}>{have}/{n}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <button className="btn btn-sm" disabled={!can} onClick={() => G.craft(r)}>Craft</button>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function FurnacePanel() {
  const { g } = useGame();
  if (!g.furnaceRef || !g.world) return null;
  const f = g.world.furnaceAt(g.furnaceRef.x, g.furnaceRef.y, g.furnaceRef.z);
  const recipe = f.in ? SMELTS.find(s => s.inId === f.in!.id) : null;
  return (
    <Shell title="Furnace">
      <div className="flex items-center justify-center gap-4 my-2">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-widest text-[#6e5a3a] mb-1">Ore / Food</div>
          <Slot s={f.in} onClick={() => (f.in ? G.furnaceTake("in") : G.furnacePut("in"))} />
          <div className="text-[10px] text-[#6e5a3a] mt-1">click: place held / take</div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <svg width="34" height="40" viewBox="0 0 34 40">
            <path d="M17 3c4 6 11 10 11 19a11 11 0 1 1-22 0C6 13 13 9 17 3z" fill={f.fuelLeft > 0 ? "#e07b2f" : "#3a2f24"} style={f.fuelLeft > 0 ? { animation: "flickerT 0.5s infinite" } : undefined} />
            <path d="M17 12c2.5 4 6 6 6 11a6 6 0 1 1-12 0c0-5 3.5-7 6-11z" fill={f.fuelLeft > 0 ? "#ffcf6a" : "#241c14"} />
          </svg>
          <div className="w-24 h-2 bg-black/30 border border-[#4a3a22]">
            <div className="h-full bg-[#e07b2f]" style={{ width: `${Math.min(100, f.prog * 100)}%` }} />
          </div>
          <div className="text-[11px] text-[#4a3a22]">Fuel: {f.fuelLeft > 0 ? Math.ceil(f.fuelLeft) : "cold"}</div>
        </div>
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-widest text-[#6e5a3a] mb-1">Fuel</div>
          <Slot s={f.fuel} onClick={() => (f.fuel ? G.furnaceTake("fuel") : G.furnacePut("fuel"))} />
          <div className="text-[10px] text-[#6e5a3a] mt-1">coal · logs · hay</div>
        </div>
        <div className="text-2xl text-[#4a3a22]">→</div>
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-widest text-[#6e5a3a] mb-1">Result</div>
          <Slot s={f.out} onClick={() => G.furnaceTake("out")} />
        </div>
      </div>
      <div className="rule-gold my-3" />
      <div className="text-[12px] text-[#4a3a22] grid grid-cols-1 md:grid-cols-2 gap-1">
        {SMELTS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <img src={iconFor(s.inId)} alt="" style={{ width: 18, imageRendering: "pixelated" }} /> →
            <img src={iconFor(s.out.id)} alt="" style={{ width: 18, imageRendering: "pixelated" }} />
            <span>{ITEMS.get(s.inId)?.name} → {ITEMS.get(s.out.id)?.name}</span>
          </div>
        ))}
        {recipe === null && f.in && <div className="text-[#96301f]">This cannot be smelted.</div>}
      </div>
    </Shell>
  );
}

function ChestPanel({ barrel }: { barrel: boolean }) {
  const { g } = useGame();
  if (!g.chestRef) return null;
  const n = barrel ? 9 : 18;
  const cols = barrel ? "grid-cols-9" : "grid-cols-9";
  return (
    <Shell title={barrel ? "Barrel" : "Chest"} wide>
      <CursorItem />
      <div className="font-display text-[12px] tracking-widest uppercase text-[#6e5a3a] mb-2">{barrel ? "Stored goods" : "Within the chest"}</div>
      <div className={`grid ${cols} gap-1 justify-start`}>
        {g.chestRef.arr.slice(0, n).map((s, i) => <Slot key={i} s={s} onClick={() => G.chestClick(i)} />)}
      </div>
      <div className="rule-gold my-4" />
      <div className="font-display text-[12px] tracking-widest uppercase text-[#6e5a3a] mb-2">Your pack</div>
      <div className="grid grid-cols-9 gap-1 justify-start">
        {g.player.inv.slice(9, 36).map((s, i) => <Slot key={i + 9} s={s} onClick={() => G.invClick(i + 9)} />)}
      </div>
      <div className="grid grid-cols-9 gap-1 justify-start mt-1">
        {g.player.inv.slice(0, 9).map((s, i) => <Slot key={i} s={s} onClick={() => G.invClick(i)} sel={i === g.player.sel} />)}
      </div>
    </Shell>
  );
}

function TradePanel() {
  const { g } = useGame();
  return (
    <Shell title={`Trade — ${g.tradeName}`}>
      <div className="text-[13px] text-[#4a3a22] mb-3 flex items-center gap-2">Your purse: <b className="text-[#8a6c34]">{g.player.coins}</b> old coins</div>
      <div className="flex flex-col gap-2">
        {(g.tradeList || []).map((t, i) => {
          const can = g.player.coins >= t.cost;
          return (
            <div key={i} className="flex items-center gap-3 p-2 border border-[#8a6c34]/40 bg-black/5">
              <img src={iconFor(t.give.id)} alt="" style={{ width: 30, imageRendering: "pixelated" }} />
              <div className="flex-1 font-bold text-[14px] text-[#2b2118]">{t.label}</div>
              <div className="flex items-center gap-1 text-[13px] text-[#8a6c34] font-bold">
                <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="#d4a63f" stroke="#8a6c34" strokeWidth="1.4" /></svg>{t.cost}
              </div>
              <button className="btn btn-sm" disabled={!can} onClick={() => G.buyTrade(i)}>Buy</button>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function SkillsPanel() {
  const { g } = useGame();
  const p = g.player;
  return (
    <Shell title="Skills & Attributes" wide>
      <div className="mb-3 text-[14px] text-[#2b2118]">
        Level <b className="font-display text-[18px] text-[#96301f]">{p.level}</b>
        <span className="mx-3 text-[#8a6c34]">·</span>
        Skill points: <b className={`font-display text-[18px] ${p.pts > 0 ? "text-[#e07b2f]" : "text-[#6e5a3a]"}`}>{p.pts}</b>
        <span className="mx-3 text-[#8a6c34]">·</span>
        <span className="text-[12px] text-[#6e5a3a]">XP {Math.floor(p.xp)} / {g.xpNeed(p.level)}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {SKILLS.map(sk => {
          const v = p.skills[sk.id];
          return (
            <div key={sk.id} className="p-3 border border-[#8a6c34]/40 bg-black/5">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-[15px] tracking-wider uppercase text-[#2b2118]">{sk.name}</span>
                <button className="btn btn-sm btn-ember !px-3" disabled={p.pts <= 0 || v >= 10} onClick={() => G.spendSkill(sk.id)}>+</button>
              </div>
              <div className="text-[12px] text-[#4a3a22] mb-2">{sk.desc}</div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-2.5 flex-1 border border-[#4a3a22]/60" style={{ background: i < v ? "linear-gradient(180deg,#e07b2f,#96501a)" : "rgba(0,0,0,0.15)" }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function QuestPanel() {
  const { g } = useGame();
  const active = Object.entries(g.quests.active);
  return (
    <Shell title="Quests" wide>
      {active.length === 0 && <p className="text-[#4a3a22] italic">No burdens on your shoulders. Village elders and quest boards offer work.</p>}
      <div className="flex flex-col gap-2.5">
        {active.map(([qid, st]) => {
          const def = QUESTS.find(q => q.id === qid)!;
          const doneAll = def.obj.every((o, i) => st.prog[i] >= o.n);
          return (
            <div key={qid} className="p-3 border border-[#8a6c34]/40 bg-black/5">
              <div className="flex items-center gap-2">
                <span className={`font-display text-[10px] tracking-[0.2em] px-1.5 py-0.5 border ${def.kind === "main" ? "text-[#96301f] border-[#96301f]/50" : "text-[#6e5a3a] border-[#6e5a3a]/50"}`}>{def.kind === "main" ? "MAIN" : "SIDE"}</span>
                <span className="font-display font-bold text-[15px] text-[#2b2118]">{def.title}</span>
                {doneAll && <span className="ml-auto text-[12px] font-bold text-[#4a6a3a]">Ready to turn in — visit Eldric</span>}
              </div>
              <p className="text-[12.5px] text-[#4a3a22] italic mt-1">{def.desc}</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {def.obj.map((o, i) => {
                  const prog = Math.min(st.prog[i] ?? 0, o.n);
                  return (
                    <div key={i} className="flex items-center gap-2 text-[12px]">
                      <span className="w-40 text-[#2b2118]">{o.label}</span>
                      <div className="flex-1 h-2 bg-black/20 border border-[#4a3a22]/50">
                        <div className="h-full" style={{ width: `${(prog / o.n) * 100}%`, background: prog >= o.n ? "#7a8450" : "#c9973f" }} />
                      </div>
                      <span className={`font-bold ${prog >= o.n ? "text-[#4a6a3a]" : "text-[#6e5a3a]"}`}>{prog}/{o.n}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {g.quests.done.length > 0 && (
        <>
          <div className="rule-gold my-4" />
          <div className="font-display text-[12px] tracking-widest uppercase text-[#6e5a3a] mb-2">Completed ({g.quests.done.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {g.quests.done.map(qid => {
              const d = QUESTS.find(q => q.id === qid);
              return d ? <span key={qid} className="text-[12px] px-2 py-0.5 border border-[#7a8450]/50 text-[#4a6a3a]">✓ {d.title}</span> : null;
            })}
          </div>
        </>
      )}
    </Shell>
  );
}

function AdvPanel() {
  const { g } = useGame();
  return (
    <Shell title="Advancements" wide>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {ADVS.map(a => {
          const got = g.advs.has(a.id);
          return (
            <div key={a.id} className={`p-2.5 border text-center ${got ? "border-[#d4a63f] bg-[#d4a63f]/15" : "border-[#8a6c34]/30 bg-black/10 opacity-60"}`}>
              <div className={`font-display font-bold text-[13px] ${got ? "text-[#8a6c34]" : "text-[#6e5a3a]"}`}>{got ? a.name : "？？？"}</div>
              <div className="text-[11px] text-[#4a3a22] mt-0.5">{got ? a.desc : "Undiscovered"}</div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function MapPanel() {
  const { g } = useGame();
  const w = g.world!;
  const p = g.player;
  const px = (x: number) => Math.max(6, Math.min(294, 150 + (x - p.x) / 2));
  const pz = (z: number) => Math.max(6, Math.min(294, 150 + (z - p.z) / 2));
  const dot = (x: number, z: number, color: string, label: string, idx: number) => (
    <g key={label + idx}>
      <circle cx={px(x)} cy={pz(z)} r={4.5} fill={color} stroke="#14100c" strokeWidth="1.4" />
    </g>
  );
  return (
    <Shell title="Wayfarer's Chart">
      <div className="flex justify-center">
        <svg width="300" height="300" className="border-2 border-[#4a3a22] bg-[#d9c58f]" style={{ boxShadow: "inset 0 0 40px rgba(90,60,20,0.4)" }}>
          {/* grid */}
          {Array.from({ length: 9 }).map((_, i) => (
            <g key={i} stroke="#8a6c34" strokeWidth="0.4" opacity="0.5">
              <line x1={i * 37.5} y1="0" x2={i * 37.5} y2="300" />
              <line x1="0" y1={i * 37.5} x2="300" y2={i * 37.5} />
            </g>
          ))}
          {w.villages.map((v, i) => dot(v.x, v.z, "#7a8450", "village", i))}
          {w.ruins.map((v, i) => dot(v.x, v.z, "#8d8d8a", "ruin", i))}
          {w.barrows.map((v, i) => dot(v.x, v.z, "#96301f", "barrow", i))}
          {w.portals.map((v, i) => dot(v.x, v.z, "#3a8a4a", "portal", i))}
          {/* player */}
          <g transform={`translate(150,150) rotate(${(p.yaw * 180) / Math.PI})`}>
            <path d="M0,-7 L5,6 L0,3 L-5,6 Z" fill="#e07b2f" stroke="#14100c" strokeWidth="1.2" />
          </g>
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-3 text-[12px] text-[#4a3a22]">
        <span><b style={{ color: "#7a8450" }}>●</b> Village ({w.villages.length})</span>
        <span><b style={{ color: "#8d8d8a" }}>●</b> Ruin ({w.ruins.length})</span>
        <span><b style={{ color: "#96301f" }}>●</b> Barrow ({w.barrows.length})</span>
        <span><b style={{ color: "#3a8a4a" }}>●</b> Green Gate ({w.portals.length})</span>
      </div>
      <p className="text-center text-[11px] text-[#6e5a3a] mt-2 italic">Only lands you have walked reveal their marks. Scale: half a pace per dot.</p>
    </Shell>
  );
}

function PausePanel() {
  const { g } = useGame();
  return (
    <div className="absolute inset-0 z-40 bg-black/70 anim-fade flex items-center justify-center">
      <div className="panel-iron notch w-[340px] max-w-[92vw] p-6 anim-fade-up">
        <div className="font-display text-[22px] font-bold tracking-[0.15em] text-center text-[#e3d3a8] mb-1">EMBERFALL</div>
        <div className="text-center text-[12px] text-[#a8915f] mb-4">{g.worldName} · Day {g.day}</div>
        <div className="rule-gold mb-4" />
        <div className="flex flex-col gap-2">
          <button className="btn" onClick={() => G.closePanel()}>Resume</button>
          <button className="btn" onClick={() => G.openPanel("settings")}>Settings</button>
          <button className="btn" onClick={() => G.openPanel("controls")}>Controls</button>
          <button className="btn" onClick={() => G.saveWorld()}>Save World</button>
          <button className="btn" onClick={() => G.openPanel("adv")}>Advancements</button>
          <button className="btn" onClick={() => G.openPanel("credits")}>Credits</button>
          <button className="btn btn-blood" onClick={() => G.quitToMenu()}>Save & Quit to Title</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-[13px] text-[#4a3a22]">{label}</span>
      <div className="flex items-center gap-2 w-56 justify-end">{children}</div>
    </div>
  );
}
function Slider({ v, min, max, step, set, fmt }: { v: number; min: number; max: number; step: number; set: (n: number) => void; fmt?: (n: number) => string }) {
  return (
    <>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(+e.target.value)} className="w-40" />
      <span className="text-[12px] font-bold text-[#2b2118] w-12 text-right">{fmt ? fmt(v) : v}</span>
    </>
  );
}
function Toggle({ v, set }: { v: boolean; set: (b: boolean) => void }) {
  return (
    <button className={`btn btn-sm ${v ? "btn-ember" : ""}`} onClick={() => set(!v)}>{v ? "On" : "Off"}</button>
  );
}

export function SettingsPanel({ inMenu }: { inMenu?: boolean }) {
  const { g } = useGame();
  const [tab, setTab] = useState<"graphics" | "audio" | "controls" | "game">("graphics");
  const s = g.settings;
  const set = (patch: Partial<Settings>) => { Object.assign(g.settings, patch); G.saveSettings(); G.notify(); };
  return (
    <Shell title="Settings" wide onClose={inMenu ? undefined : () => (g.screen === "play" && (g.paused || g.panel === "settings") && !inMenu ? G.openPanel("pause") : G.closePanel())}>
      <div className="flex gap-2 mb-4 flex-wrap">
        {([["graphics", "Graphics"], ["audio", "Audio"], ["controls", "Controls"], ["game", "Game"]] as const).map(([k, l]) => (
          <button key={k} className={`btn btn-sm ${tab === k ? "btn-ember" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "graphics" && (
        <div>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {Object.keys(PRESETS).map(p => (
              <button key={p} className={`btn btn-sm ${s.preset === p ? "btn-ember" : ""}`} onClick={() => G.applyPreset(p)}>{p}</button>
            ))}
          </div>
          <Row label="Render distance (chunks)"><Slider v={s.renderDist} min={2} max={14} step={1} set={(n) => set({ renderDist: n, preset: "Custom" })} /></Row>
          <Row label="Simulation distance"><Slider v={s.simDist} min={2} max={10} step={1} set={(n) => set({ simDist: n })} /></Row>
          <Row label="Field of view"><Slider v={s.fov} min={55} max={110} step={1} set={(n) => { set({ fov: n }); if (G.renderer) G.renderer.fov = n; }} /></Row>
          <Row label="Fog density"><Slider v={s.fog} min={0.5} max={2} step={0.05} set={(n) => set({ fog: n })} fmt={(n) => n.toFixed(2)} /></Row>
          <Row label="Particle density"><Slider v={s.particles} min={0} max={1} step={0.1} set={(n) => set({ particles: n })} fmt={(n) => `${Math.round(n * 100)}%`} /></Row>
          <Row label="Animated water"><Toggle v={s.fancyWater} set={(b) => set({ fancyWater: b })} /></Row>
          <Row label="View bobbing"><Toggle v={s.viewBob} set={(b) => set({ viewBob: b })} /></Row>
          <Row label="Dynamic resolution"><Toggle v={s.dynamicRes} set={(b) => set({ dynamicRes: b })} /></Row>
          <Row label="Show coordinates"><Toggle v={s.showCoords} set={(b) => set({ showCoords: b })} /></Row>
        </div>
      )}
      {tab === "audio" && (
        <div>
          <Row label="Master volume"><Slider v={s.volMaster} min={0} max={1} step={0.05} set={(n) => set({ volMaster: n })} fmt={(n) => `${Math.round(n * 100)}%`} /></Row>
          <Row label="Music (lute & drone)"><Slider v={s.volMusic} min={0} max={1} step={0.05} set={(n) => set({ volMusic: n })} fmt={(n) => `${Math.round(n * 100)}%`} /></Row>
          <Row label="Effects"><Slider v={s.volSfx} min={0} max={1} step={0.05} set={(n) => set({ volSfx: n })} fmt={(n) => `${Math.round(n * 100)}%`} /></Row>
          <p className="text-[12px] italic text-[#6e5a3a] mt-2">Every sound in Emberfall is synthesized live — wind, wolves, lutes and thunder.</p>
        </div>
      )}
      {tab === "controls" && <ControlsInner />}
      {tab === "game" && (
        <div>
          <Row label="Platform"><div className="flex gap-1.5">
            <button className={`btn btn-sm ${s.platform === "pc" ? "btn-ember" : ""}`} onClick={() => set({ platform: "pc" })}>PC</button>
            <button className={`btn btn-sm ${s.platform === "mobile" ? "btn-ember" : ""}`} onClick={() => set({ platform: "mobile" })}>Mobile</button>
          </div></Row>
          <Row label="Touch control size"><Slider v={s.touchScale} min={0.6} max={1.6} step={0.05} set={(n) => set({ touchScale: n })} fmt={(n) => n.toFixed(2)} /></Row>
          <Row label="Touch opacity"><Slider v={s.touchOpacity} min={0.2} max={1} step={0.05} set={(n) => set({ touchOpacity: n })} fmt={(n) => `${Math.round(n * 100)}%`} /></Row>
          <Row label="Left-handed layout"><Toggle v={s.touchLefty} set={(b) => set({ touchLefty: b })} /></Row>
          <div className="rule-gold my-3" />
          <button className="btn btn-blood" onClick={() => { G.resetBoot(); }}>Reset first-boot setup</button>
          <p className="text-[11px] text-[#6e5a3a] mt-2">Returns you to the platform & preferences rite on next title screen.</p>
        </div>
      )}
    </Shell>
  );
}

const BIND_LABELS: [string, string][] = [
  ["forward", "Walk forward"], ["back", "Walk back"], ["left", "Strafe left"], ["right", "Strafe right"],
  ["jump", "Jump / Swim up"], ["sprint", "Sprint"], ["sneak", "Sneak"], ["interact", "Interact / Talk"],
  ["inv", "Inventory"], ["craft", "Crafting"], ["skills", "Skills"], ["quests", "Quests"], ["map", "Chart"],
  ["drop", "Drop item"], ["dodge", "Dodge"],
];
const keyName = (code: string) => code.replace("Key", "").replace("Digit", "").replace("Left", " L").replace("Right", " R").replace("Control", "Ctrl");
function ControlsInner() {
  const { g } = useGame();
  const s = g.settings;
  return (
    <div>
      <Row label="Mouse / look sensitivity"><Slider v={s.sens} min={0.2} max={3} step={0.05} set={(n) => { Object.assign(g.settings, { sens: n }); G.saveSettings(); G.notify(); }} fmt={(n) => n.toFixed(2)} /></Row>
      <div className="rule-gold my-2" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        {BIND_LABELS.map(([k, label]) => (
          <div key={k} className="flex items-center justify-between py-1">
            <span className="text-[13px] text-[#4a3a22]">{label}</span>
            <button className="btn btn-sm !min-w-[84px]" onClick={() => G.startRebind(k)}>
              {g.rebinding === k ? "press…" : <span className="key-cap">{keyName(s.binds[k] || "?")}</span>}
            </button>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-[#6e5a3a] mt-2 italic">Left-click: mine / attack (hold to charge a heavy blow). Right-click: use, place, or raise your shield. Parry by blocking at the last breath.</p>
    </div>
  );
}
function ControlsPanel() {
  const { g } = useGame();
  return (
    <Shell title="Controls" wide onClose={() => (g.screen === "play" ? G.openPanel("pause") : G.closePanel())}>
      <ControlsInner />
    </Shell>
  );
}

function CreditsPanel() {
  const { g } = useGame();
  return (
    <Shell title="Credits" onClose={() => (g.screen === "play" ? G.openPanel("pause") : G.closePanel())}>
      <div className="text-center text-[14px] text-[#2b2118] leading-relaxed">
        <div className="font-display text-[26px] font-bold tracking-[0.2em] text-[#96301f] mb-2">EMBERFALL</div>
        <p className="italic text-[#4a3a22]">A dark medieval survival, forged from nothing.</p>
        <div className="rule-gold my-4" />
        <p>World, engine, creatures, quests & lute-songs —<br />all original, all procedural, all hand-woven code.</p>
        <p className="mt-3 text-[12px] text-[#6e5a3a]">No trees were harmed. Several were, however, punched.</p>
        <p className="mt-3 text-[12px] text-[#6e5a3a]">Fonts: Cinzel & Alegreya Sans.</p>
      </div>
    </Shell>
  );
}

function DialogPanel() {
  const { g } = useGame();
  const d = g.dialog;
  if (!d) return null;
  return (
    <Shell title={d.name} onClose={() => G.closePanel()}>
      <div className="text-[15px] leading-relaxed text-[#2b2118]">
        {d.lines.map((l, i) => <p key={i} className="mb-2">{l}</p>)}
      </div>
      <div className="flex gap-2 mt-3">
        {d.canAccept && d.questId && <button className="btn btn-ember" onClick={() => G.acceptQuest(d.questId!)}>Accept the charge</button>}
        {d.canTurn && d.questId && <button className="btn btn-ember" onClick={() => G.turnInQuest(d.questId!)}>Claim reward</button>}
        <button className="btn" onClick={() => G.closePanel()}>Farewell</button>
      </div>
    </Shell>
  );
}

export function DeathScreen() {
  const { g } = useGame();
  const p = g.player;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center anim-fade" style={{ background: "radial-gradient(ellipse at center, rgba(60,10,5,0.88), rgba(5,3,2,0.96))" }}>
      <div className="text-center anim-fade-up">
        <div className="font-display text-[44px] md:text-[60px] font-black tracking-[0.18em] text-[#96301f]" style={{ textShadow: "0 0 30px rgba(150,48,31,0.6), 0 3px 0 #000" }}>YOU HAVE FALLEN</div>
        <div className="text-[15px] text-[#c9a08a] italic mt-2 mb-6">The cold earth keeps what it is given. Day {g.day}, {g.worldName}.</div>
        <div className="text-[13px] text-[#a8915f] mb-6">Slain {g.stats.kills} · Mined {g.stats.mined} · Crafted {g.stats.crafts} · Level {p.level} — a fifth of your coins slip through dead fingers.</div>
        <button className="btn btn-ember !text-[16px] !px-8 !py-3" onClick={() => G.respawn()}>Rise Again</button>
      </div>
    </div>
  );
}
