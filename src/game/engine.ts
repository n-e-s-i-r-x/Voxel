// Emberfall rendering engine — raw WebGL voxel renderer.
import { getAtlas, BLOCKS, B, ATLAS_TILES, TILE_PX } from "./blocks";
import { World, Chunk, CH, HH } from "./world";

export interface Box {
  x: number; y: number; z: number; // center
  sx: number; sy: number; sz: number;
  r: number; g: number; b: number;
  e?: number; // emissive 0..1
  yaw?: number; // rotation around Y (radians)
}

// ---------- matrix math ----------
export function persp(fovDeg: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}
export function lookAt(eye: number[], fwd: number[], up: number[]): Float32Array {
  const z = norm3([-fwd[0], -fwd[1], -fwd[2]]);
  const x = norm3(cross3(up, z));
  const y = cross3(z, x);
  const m = new Float32Array(16);
  m[0] = x[0]; m[1] = y[0]; m[2] = z[0];
  m[4] = x[1]; m[5] = y[1]; m[6] = z[1];
  m[8] = x[2]; m[9] = y[2]; m[10] = z[2];
  m[12] = -dot3(x, eye); m[13] = -dot3(y, eye); m[14] = -dot3(z, eye); m[15] = 1;
  return m;
}
export function mulMat(a: Float32Array, b: Float32Array): Float32Array {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
const cross3 = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (a: number[]) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function forwardVec(yaw: number, pitch: number): number[] {
  return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}

// ---------- shaders ----------
const TERRAIN_VS = `
attribute vec3 aPos; attribute vec2 aUV; attribute vec2 aLight;
uniform mat4 uProj; uniform mat4 uView;
varying vec2 vUV; varying vec2 vL; varying float vDist; varying vec3 vW;
void main(){
  vec4 vp = uView * vec4(aPos, 1.0);
  gl_Position = uProj * vp;
  vUV = aUV; vL = aLight; vDist = length(vp.xyz); vW = aPos;
}`;
const TERRAIN_FS = `
precision mediump float;
uniform sampler2D uTex; uniform float uDay; uniform vec3 uFog; uniform float uFogS; uniform float uFogE; uniform float uTime;
varying vec2 vUV; varying vec2 vL; varying float vDist; varying vec3 vW;
void main(){
  vec4 c = texture2D(uTex, vUV);
  if (c.a < 0.5) discard;
  float lum = clamp(vL.y + vL.x * uDay, 0.045, 1.0);
  vec3 col = c.rgb * lum;
  float f = smoothstep(uFogS, uFogE, vDist);
  gl_FragColor = vec4(mix(col, uFog, f), 1.0);
}`;
const WATER_VS = `
attribute vec3 aPos; attribute vec2 aUV; attribute vec2 aLight;
uniform mat4 uProj; uniform mat4 uView; uniform float uTime;
varying vec2 vUV; varying vec2 vL; varying float vDist;
void main(){
  vec3 p = aPos;
  p.y += sin(aPos.x * 1.7 + uTime * 1.6) * 0.03 + cos(aPos.z * 1.9 + uTime * 1.3) * 0.03;
  vec4 vp = uView * vec4(p, 1.0);
  gl_Position = uProj * vp;
  vUV = aUV + vec2(sin(uTime * 0.7 + aPos.x * 0.5) * 0.006, cos(uTime * 0.6 + aPos.z * 0.5) * 0.006);
  vL = aLight; vDist = length(vp.xyz);
}`;
const WATER_FS = `
precision mediump float;
uniform sampler2D uTex; uniform float uDay; uniform vec3 uFog; uniform float uFogS; uniform float uFogE; uniform float uAlpha; uniform vec3 uTint;
varying vec2 vUV; varying vec2 vL; varying float vDist;
void main(){
  vec4 c = texture2D(uTex, vUV);
  float lum = clamp(vL.y + vL.x * uDay, 0.12, 1.0);
  vec3 col = mix(c.rgb, uTint, 0.35) * lum;
  float f = smoothstep(uFogS * 0.6, uFogE * 0.75, vDist);
  gl_FragColor = vec4(mix(col, uFog, f), uAlpha);
}`;
const ENTITY_VS = `
attribute vec3 aPos; attribute vec3 aCol;
uniform mat4 uProj; uniform mat4 uView;
varying vec3 vC; varying float vDist;
void main(){
  vec4 vp = uView * vec4(aPos, 1.0);
  gl_Position = uProj * vp;
  vC = aCol; vDist = length(vp.xyz);
}`;
const ENTITY_FS = `
precision mediump float;
uniform vec3 uFog; uniform float uFogS; uniform float uFogE; uniform float uAlpha;
varying vec3 vC; varying float vDist;
void main(){
  float f = smoothstep(uFogS, uFogE, vDist);
  gl_FragColor = vec4(mix(vC, uFog, f), uAlpha);
}`;
const SKY_VS = `
attribute vec2 aP; varying vec2 vP;
void main(){ vP = aP; gl_Position = vec4(aP, 0.9999, 1.0); }`;
const SKY_FS = `
precision mediump float;
uniform vec3 uTop; uniform vec3 uBot; uniform vec2 uSun; uniform float uSunAmt; uniform float uNight; uniform float uAspect;
varying vec2 vP;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 col = mix(uBot, uTop, smoothstep(-0.6, 0.9, vP.y));
  // stars
  if (uNight > 0.05) {
    vec2 sp = vP * vec2(uAspect, 1.0) * 140.0;
    vec2 id = floor(sp);
    float h = hash(id);
    if (h > 0.985) {
      vec2 f = fract(sp) - 0.5;
      float d = length(f);
      col += vec3(0.9, 0.92, 1.0) * smoothstep(0.25, 0.0, d) * uNight * (0.5 + 0.5 * sin(h * 40.0 + uNight * 6.0));
    }
  }
  // sun / moon
  vec2 sc = vP - uSun; sc.x *= uAspect;
  float sd = length(sc);
  col += vec3(1.0, 0.85, 0.55) * smoothstep(0.075, 0.02, sd) * uSunAmt;
  col += vec3(1.0, 0.62, 0.3) * smoothstep(0.42, 0.05, sd) * 0.35 * uSunAmt;
  gl_FragColor = vec4(col, 1.0);
}`;
const PART_VS = `
attribute vec3 aPos; attribute vec4 aCol; attribute float aSize;
uniform mat4 uProj; uniform mat4 uView; uniform float uScale;
varying vec4 vC;
void main(){
  vec4 vp = uView * vec4(aPos, 1.0);
  gl_Position = uProj * vp;
  gl_PointSize = clamp(aSize * uScale / max(vp.z, 0.1), 1.0, 40.0);
  vC = aCol;
}`;
const PART_FS = `
precision mediump float; varying vec4 vC;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.15, length(d));
  gl_FragColor = vec4(vC.rgb, vC.a * a);
}`;

interface Mesh { vbo: WebGLBuffer; ibo: WebGLBuffer; n: number; }

const FACES: { d: number[]; c: number[][]; shade: number }[] = [
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8 },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8 },
  { d: [0, 1, 0], c: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]], shade: 1.0 },
  { d: [0, -1, 0], c: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]], shade: 0.5 },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.68 },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.68 },
];
const FACE_UV = [[0, 1], [1, 1], [1, 0], [0, 0]]; // v: 0 = tile top
const AO_CURVE = [0.5, 0.68, 0.84, 1.0];

export class Renderer {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  prog: any = {};
  tex: WebGLTexture | null = null;
  meshes = new Map<string, { solid: Mesh | null; water: Mesh | null }>();
  unitCube: { vbo: WebGLBuffer; n: number } | null = null;
  partBuf: WebGLBuffer;
  lineBuf: WebGLBuffer;
  skyBuf: WebGLBuffer;
  resScale = 1;
  fov = 75;
  projM: any = new Float32Array(16);
  viewM: any = new Float32Array(16);
  vpM: any = new Float32Array(16);
  frustum: number[][] = [];
  eye = [0, 0, 0];
  dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" })!;
    this.gl = gl;
    gl.getExtension("OES_element_index_uint");
    this.prog.terrain = this.makeProg(TERRAIN_VS, TERRAIN_FS);
    this.prog.water = this.makeProg(WATER_VS, WATER_FS);
    this.prog.entity = this.makeProg(ENTITY_VS, ENTITY_FS);
    this.prog.sky = this.makeProg(SKY_VS, SKY_FS);
    this.prog.part = this.makeProg(PART_VS, PART_FS);
    this.tex = gl.createTexture();
    const atlas = getAtlas();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.partBuf = gl.createBuffer()!;
    this.lineBuf = gl.createBuffer()!;
    this.skyBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }

  makeProg(vs: string, fs: string): any {
    const gl = this.gl;
    const c = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s), src);
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, c(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, c(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p));
    const u: any = {}, a: any = {};
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) { const inf = gl.getActiveUniform(p, i)!; u[inf.name] = gl.getUniformLocation(p, inf.name); }
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i++) { const inf = gl.getActiveAttrib(p, i)!; a[inf.name] = gl.getAttribLocation(p, inf.name); }
    return { p, u, a };
  }

  resize(w: number, h: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = this.dpr * this.resScale;
    this.canvas.width = Math.max(2, Math.floor(w * s));
    this.canvas.height = Math.max(2, Math.floor(h * s));
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  // ---------- chunk meshing ----------
  meshChunk(world: World, c: Chunk): void {
    const verts: number[] = [], idx: number[] = [];
    const wverts: number[] = [], widx: number[] = [];
    const x0 = c.cx * CH, z0 = c.cz * CH;
    // collect nearby lights
    const lights: { x: number; y: number; z: number; l: number }[] = [...c.lights];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue;
      const nc = world.chunkAt(c.cx + dx, c.cz + dz);
      if (nc) for (const L of nc.lights) {
        const lx = L.x - x0, lz = L.z - z0;
        if (lx > -10 && lx < 26 && lz > -10 && lz < 26) lights.push(L);
      }
    }
    const solidAt = (x: number, y: number, z: number) => {
      const b = BLOCKS[world.getB(x, y, z)];
      return b?.opaque || false;
    };
    const opaqueOrSelf = (x: number, y: number, z: number, self: number) => {
      const b = world.getB(x, y, z);
      return BLOCKS[b]?.opaque || b === self;
    };
    const tileUV = (t: number, u: number, v: number): [number, number] => {
      const inset = 0.6 / (ATLAS_TILES * TILE_PX);
      const tx = (t % ATLAS_TILES) / ATLAS_TILES, ty = Math.floor(t / ATLAS_TILES) / ATLAS_TILES;
      const s = 1 / ATLAS_TILES;
      return [tx + inset + u * (s - inset * 2), ty + inset + v * (s - inset * 2)];
    };
    const torchAt = (x: number, y: number, z: number): number => {
      let t = 0;
      for (const L of lights) {
        const d = Math.hypot(L.x + 0.5 - x, L.y + 0.5 - y, L.z + 0.5 - z);
        if (d < 9.5) t = Math.max(t, (L.l / 14) * (1 - d / 9.5));
      }
      return Math.min(1, t);
    };

    for (let ly = 1; ly < HH; ly++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const id = c.blocks[lx | (lz << 4) | (ly << 8)];
      if (id === B.AIR) continue;
      const bd = BLOCKS[id];
      const wx = x0 + lx, wz = z0 + lz;
      const hm = c.hm[lx | (lz << 4)];
      const skyExp = world.dim === 1 ? (ly >= 58 ? 0.4 : 0) : (ly >= hm ? 1 : Math.max(0, 1 - (hm - ly) * 0.5));
      const torch = bd.light >= 10 ? 1 : Math.max(bd.light / 14, torchAt(wx + 0.5, ly + 0.5, wz + 0.5));

      if (bd.fluid) {
        // water / ember fluid — top face + sides to air
        const above = world.getB(wx, ly + 1, wz);
        const isEmber = id === B.EMBERFLUID;
        if (!BLOCKS[above]?.fluid) {
          const t = isEmber ? 54 : 5;
          this.pushFace(wverts, widx, wx, ly, wz, FACES[2], t, tileUV, 1, isEmber ? 1 : skyExp, isEmber ? 1 : torch * 0.6, -0.14);
        }
        for (const fi of [0, 1, 4, 5]) {
          const f = FACES[fi];
          const nid = world.getB(wx + f.d[0], ly + f.d[1], wz + f.d[2]);
          if (!BLOCKS[nid]?.fluid && !BLOCKS[nid]?.opaque) {
            const t = isEmber ? 54 : 5;
            this.pushFace(wverts, widx, wx, ly, wz, f, t, tileUV, 1, isEmber ? 1 : skyExp, isEmber ? 1 : torch * 0.6, 0);
          }
        }
        continue;
      }
      if (bd.cross) {
        // X-shaped billboard quads (two triangles each direction)
        const t = bd.tex[0];
        const [u0, v0] = tileUV(t, 0, 0), [u1, v1] = tileUV(t, 1, 1);
        const sky = Math.max(skyExp, 0.15), tor = torch;
        const quad = (a: number[], b: number[], cc: number[], d: number[]) => {
          const base = verts.length / 8;
          const push = (p: number[], uv: [number, number]) => verts.push(wx + p[0], ly + p[1], wz + p[2], uv[0], uv[1], sky, tor);
          push(a, [u0, v1]); push(b, [u1, v1]); push(cc, [u1, v0]); push(d, [u0, v0]);
          idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        };
        quad([0.08, 0, 0.08], [0.92, 0, 0.92], [0.92, 1, 0.92], [0.08, 1, 0.08]);
        quad([0.92, 0, 0.08], [0.08, 0, 0.92], [0.08, 1, 0.92], [0.92, 1, 0.08]);
        continue;
      }
      // solid cube
      for (let fi = 0; fi < 6; fi++) {
        const f = FACES[fi];
        if (opaqueOrSelf(wx + f.d[0], ly + f.d[1], wz + f.d[2], id)) continue;
        const texIdx = bd.tex.length === 1 ? 0 : fi === 2 ? 0 : fi === 3 ? bd.tex.length - 1 : 1;
        const t = bd.tex[texIdx];
        const emissive = bd.light >= 8;
        // per-corner AO + light
        const corners: number[][] = [];
        for (let ci = 0; ci < 4; ci++) {
          const cn = f.c[ci];
          // AO neighbors
          const axes: number[][] = [];
          for (let ax = 0; ax < 3; ax++) if (f.d[ax] === 0) axes.push([ax === 0 ? 1 : 0, ax === 1 ? 1 : 0, ax === 2 ? 1 : 0]);
          const s1v = cn[axes[0][0] === 1 ? 0 : axes[0][1] === 1 ? 1 : 2];
          const dir1 = axes[0].map((v, i) => (v ? (cn[i] === 1 ? 1 : -1) : 0));
          const dir2 = axes[1].map((v, i) => (v ? (cn[i] === 1 ? 1 : -1) : 0));
          const s1 = solidAt(wx + f.d[0] + dir1[0], ly + f.d[1] + dir1[1], wz + f.d[2] + dir1[2]);
          const s2 = solidAt(wx + f.d[0] + dir2[0], ly + f.d[1] + dir2[1], wz + f.d[2] + dir2[2]);
          const cD = solidAt(wx + f.d[0] + dir1[0] + dir2[0], ly + f.d[1] + dir1[1] + dir2[1], wz + f.d[2] + dir1[2] + dir2[2]);
          const ao = s1 && s2 ? 0 : 3 - ((s1 ? 1 : 0) + (s2 ? 1 : 0) + (cD ? 1 : 0));
          corners.push([ao, cn[0], cn[1], cn[2]]);
          void s1v;
        }
        const base = verts.length / 8;
        for (let ci = 0; ci < 4; ci++) {
          const cn = f.c[ci];
          const ao = AO_CURVE[corners[ci][0]];
          const sky = emissive ? 1 : skyExp * f.shade * ao;
          const tor = Math.max(emissive ? 1 : 0, torch * (f.shade * 0.4 + 0.6) * ao);
          const [u, v] = tileUV(t, FACE_UV[ci][0], FACE_UV[ci][1]);
          verts.push(wx + cn[0], ly + cn[1], wz + cn[2], u, v, sky, tor);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const key = `${world.dim}:${c.cx},${c.cz}`;
    let entry = this.meshes.get(key);
    if (!entry) { entry = { solid: null, water: null }; this.meshes.set(key, entry); }
    entry.solid = this.uploadMesh(entry.solid, verts, idx);
    entry.water = this.uploadMesh(entry.water, wverts, widx);
    c.meshed = true;
    world.dirty.delete(key);
  }
  private pushFace(verts: number[], idx: number[], wx: number, wy: number, wz: number, f: { d: number[]; c: number[][]; shade: number }, t: number, tileUV: (t: number, u: number, v: number) => [number, number], shade: number, sky: number, torch: number, dy: number): void {
    const base = verts.length / 8;
    for (let ci = 0; ci < 4; ci++) {
      const cn = f.c[ci];
      const [u, v] = tileUV(t, FACE_UV[ci][0], FACE_UV[ci][1]);
      verts.push(wx + cn[0], wy + cn[1] + (cn[1] === 1 ? dy : 0), wz + cn[2], u, v, sky * shade, torch);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  private uploadMesh(old: Mesh | null, verts: number[], idx: number[]): Mesh | null {
    const gl = this.gl;
    if (!idx.length) {
      if (old) { gl.deleteBuffer(old.vbo); gl.deleteBuffer(old.ibo); }
      return null;
    }
    const vbo = old?.vbo || gl.createBuffer()!;
    const ibo = old?.ibo || gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.DYNAMIC_DRAW);
    return { vbo, ibo, n: idx.length };
  }
  dropChunk(key: string): void {
    const e = this.meshes.get(key);
    if (!e) return;
    const gl = this.gl;
    if (e.solid) { gl.deleteBuffer(e.solid.vbo); gl.deleteBuffer(e.solid.ibo); }
    if (e.water) { gl.deleteBuffer(e.water.vbo); gl.deleteBuffer(e.water.ibo); }
    this.meshes.delete(key);
  }
  dropFar(px: number, pz: number, r: number): void {
    const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH);
    for (const [k] of this.meshes) {
      const [dimS, coords] = k.split(":");
      const [cx, cz] = coords.split(",").map(Number);
      if (Math.abs(cx - pcx) > r + 3 || Math.abs(cz - pcz) > r + 3) this.dropChunk(k);
    }
  }
  dropAll(): void {
    for (const k of [...this.meshes.keys()]) this.dropChunk(k);
  }

  // ---------- frame ----------
  beginFrame(cam: { x: number; y: number; z: number; yaw: number; pitch: number }, opts: {
    daylight: number; fog: [number, number, number]; fogS: number; fogE: number; time: number;
    skyTop: [number, number, number]; skyBot: [number, number, number]; sunNdc: [number, number]; sunAmt: number; night: number;
    underwater: boolean; tint: [number, number, number];
  }): void {
    const gl = this.gl;
    this.eye = [cam.x, cam.y, cam.z];
    this.projM = persp(this.fov, this.canvas.width / this.canvas.height, 0.08, opts.fogE + 80);
    this.viewM = lookAt([cam.x, cam.y, cam.z], forwardVec(cam.yaw, cam.pitch), [0, 1, 0]);
    this.vpM = mulMat(this.projM, this.viewM);
    this.frustum = this.extractFrustum(this.vpM);
    gl.clearColor(opts.fog[0], opts.fog[1], opts.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // sky
    gl.disable(gl.DEPTH_TEST);
    const s = this.prog.sky;
    gl.useProgram(s.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.enableVertexAttribArray(s.a.aP);
    gl.vertexAttribPointer(s.a.aP, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(s.u.uTop, opts.skyTop);
    gl.uniform3fv(s.u.uBot, opts.skyBot);
    gl.uniform2fv(s.u.uSun, opts.sunNdc);
    gl.uniform1f(s.u.uSunAmt, opts.sunAmt);
    gl.uniform1f(s.u.uNight, opts.night);
    gl.uniform1f(s.u.uAspect, this.canvas.width / this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    (this as any)._opts = opts;
  }

  drawTerrain(world: World, cam: { x: number; y: number; z: number }): number {
    const gl = this.gl;
    const opts = (this as any)._opts;
    const p = this.prog.terrain;
    gl.useProgram(p.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(p.u.uTex, 0);
    gl.uniformMatrix4fv(p.u.uProj, false, this.projM);
    gl.uniformMatrix4fv(p.u.uView, false, this.viewM);
    gl.uniform1f(p.u.uDay, opts.daylight);
    gl.uniform3fv(p.u.uFog, opts.fog);
    gl.uniform1f(p.u.uFogS, opts.fogS);
    gl.uniform1f(p.u.uFogE, opts.fogE);
    gl.uniform1f(p.u.uTime, opts.time);
    let drawn = 0;
    for (const [key, m] of this.meshes) {
      if (!m.solid) continue;
      const [, coords] = key.split(":");
      const [cx, cz] = coords.split(",").map(Number);
      const ccx = cx * CH + 8, ccz = cz * CH + 8;
      if (!this.sphereVisible(ccx, 30, ccz, 46)) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, m.solid.vbo);
      gl.enableVertexAttribArray(p.a.aPos);
      gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(p.a.aUV);
      gl.vertexAttribPointer(p.a.aUV, 2, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(p.a.aLight);
      gl.vertexAttribPointer(p.a.aLight, 2, gl.FLOAT, false, 32, 20);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.solid.ibo);
      gl.drawElements(gl.TRIANGLES, m.solid.n, gl.UNSIGNED_INT, 0);
      drawn++;
    }
    return drawn;
  }

  drawWater(): void {
    const gl = this.gl;
    const opts = (this as any)._opts;
    const p = this.prog.water;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.uProj, false, this.projM);
    gl.uniformMatrix4fv(p.u.uView, false, this.viewM);
    gl.uniform1f(p.u.uDay, opts.daylight);
    gl.uniform3fv(p.u.uFog, opts.fog);
    gl.uniform1f(p.u.uFogS, opts.fogS);
    gl.uniform1f(p.u.uFogE, opts.fogE);
    gl.uniform1f(p.u.uTime, opts.time);
    gl.uniform1f(p.u.uAlpha, opts.underwater ? 0.45 : 0.72);
    gl.uniform3fv(p.u.uTint, opts.tint);
    gl.uniform1i(p.u.uTex, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for (const [, m] of this.meshes) {
      if (!m.water) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, m.water.vbo);
      gl.enableVertexAttribArray(p.a.aPos);
      gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(p.a.aUV);
      gl.vertexAttribPointer(p.a.aUV, 2, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(p.a.aLight);
      gl.vertexAttribPointer(p.a.aLight, 2, gl.FLOAT, false, 32, 20);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.water.ibo);
      gl.drawElements(gl.TRIANGLES, m.water.n, gl.UNSIGNED_INT, 0);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  /** Draw colored boxes in world space (mobs, drops, viewmodel relative handled separately). */
  drawBoxes(boxes: Box[], viewOverride?: Float32Array, opts?: { alpha?: number; fog?: boolean }): void {
    if (!boxes.length) return;
    const gl = this.gl;
    const o = (this as any)._opts;
    const data = new Float32Array(boxes.length * 36 * 6);
    let w = 0;
    const N = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    ];
    const C = [
      [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
      [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
      [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],
      [[-1, -1, -1], [-1, -1, 1], [1, -1, 1], [1, -1, -1]],
      [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
      [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
    ];
    const shadeF = [0.82, 0.82, 1, 0.5, 0.7, 0.7];
    for (const b of boxes) {
      const cy = Math.cos(b.yaw || 0), sy = Math.sin(b.yaw || 0);
      for (let f = 0; f < 6; f++) {
        let sh = shadeF[f];
        const e = b.e || 0;
        for (const [vx, vy, vz] of C[f]) {
          let px = vx * b.sx / 2, pz = vz * b.sz / 2;
          if (b.yaw) { const rx = px * cy - pz * sy; const rz = px * sy + pz * cy; px = rx; pz = rz; }
          data[w++] = b.x + px; data[w++] = b.y + vy * b.sy / 2; data[w++] = b.z + pz;
          const l = e + (1 - e) * sh;
          data[w++] = Math.min(1, b.r * l); data[w++] = Math.min(1, b.g * l); data[w++] = Math.min(1, b.b * l);
        }
      }
      // indices via triangles: rewrite as explicit triangles
    }
    // rebuild as triangles (simpler than index buffer churn)
    const tri = new Float32Array(boxes.length * 36 * 6);
    let tw = 0;
    const order = [0, 1, 2, 0, 2, 3];
    let src = 0;
    for (let i = 0; i < boxes.length; i++) {
      for (let f = 0; f < 6; f++) {
        const base = src + f * 4 * 6;
        for (const oi of order) for (let k = 0; k < 6; k++) tri[tw++] = data[base + oi * 6 + k];
      }
      src += 6 * 4 * 6;
    }
    void N;
    const p = this.prog.entity;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.uProj, false, this.projM);
    gl.uniformMatrix4fv(p.u.uView, false, viewOverride || this.viewM);
    gl.uniform3fv(p.u.uFog, o.fog);
    gl.uniform1f(p.u.uFogS, opts?.fog === false ? 1e9 : o.fogS);
    gl.uniform1f(p.u.uFogE, opts?.fog === false ? 2e9 : o.fogE);
    gl.uniform1f(p.u.uAlpha, opts?.alpha ?? 1);
    if ((opts?.alpha ?? 1) < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, tri, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p.a.aPos);
    gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(p.a.aCol);
    gl.vertexAttribPointer(p.a.aCol, 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.TRIANGLES, 0, boxes.length * 36);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  drawHighlight(hx: number, hy: number, hz: number): void {
    const gl = this.gl;
    const e = 0.004;
    const x0 = hx - e, y0 = hy - e, z0 = hz - e, x1 = hx + 1 + e, y1 = hy + 1 + e, z1 = hz + 1 + e;
    const L: number[] = [];
    const seg = (a: number[], b: number[]) => L.push(...a, ...b);
    seg([x0, y0, z0], [x1, y0, z0]); seg([x1, y0, z0], [x1, y0, z1]); seg([x1, y0, z1], [x0, y0, z1]); seg([x0, y0, z1], [x0, y0, z0]);
    seg([x0, y1, z0], [x1, y1, z0]); seg([x1, y1, z0], [x1, y1, z1]); seg([x1, y1, z1], [x0, y1, z1]); seg([x0, y1, z1], [x0, y1, z0]);
    seg([x0, y0, z0], [x0, y1, z0]); seg([x1, y0, z0], [x1, y1, z0]); seg([x1, y0, z1], [x1, y1, z1]); seg([x0, y0, z1], [x0, y1, z1]);
    const p = this.prog.entity;
    const o = (this as any)._opts;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.uProj, false, this.projM);
    gl.uniformMatrix4fv(p.u.uView, false, this.viewM);
    gl.uniform3fv(p.u.uFog, o.fog);
    gl.uniform1f(p.u.uFogS, 1e9);
    gl.uniform1f(p.u.uFogE, 2e9);
    gl.uniform1f(p.u.uAlpha, 0.8);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const arr = new Float32Array(L.length * 3);
    for (let i = 0; i < L.length; i += 3) { arr[i * 2] = L[i]; arr[i * 2 + 1] = L[i + 1]; arr[i * 2 + 2] = L[i + 2]; arr[i * 2 + 3] = 0.08; arr[i * 2 + 4] = 0.06; arr[i * 2 + 5] = 0.04; }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p.a.aPos);
    gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(p.a.aCol);
    gl.vertexAttribPointer(p.a.aCol, 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.LINES, 0, 24);
    gl.disable(gl.BLEND);
  }

  drawParticles(list: { x: number; y: number; z: number; r: number; g: number; b: number; a: number; s: number }[]): void {
    if (!list.length) return;
    const gl = this.gl;
    const o = (this as any)._opts;
    const data = new Float32Array(list.length * 8);
    let w = 0;
    for (const pt of list) {
      data[w++] = pt.x; data[w++] = pt.y; data[w++] = pt.z;
      data[w++] = pt.r; data[w++] = pt.g; data[w++] = pt.b; data[w++] = pt.a;
      data[w++] = pt.s;
    }
    const p = this.prog.part;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.uProj, false, this.projM);
    gl.uniformMatrix4fv(p.u.uView, false, this.viewM);
    gl.uniform1f(p.u.uScale, this.canvas.height * 0.9);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p.a.aPos);
    gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(p.a.aCol);
    gl.vertexAttribPointer(p.a.aCol, 4, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(p.a.aSize);
    gl.vertexAttribPointer(p.a.aSize, 1, gl.FLOAT, false, 32, 28);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.drawArrays(gl.POINTS, 0, list.length);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    void o;
  }

  extractFrustum(vp: Float32Array): number[][] {
    const m = vp;
    const row = (i: number) => [m[i], m[4 + i], m[8 + i], m[12 + i]];
    const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
    const add = (a: number[], b: number[]) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
    const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]];
    const planes = [add(r3, r0), sub(r3, r0), add(r3, r1), sub(r3, r1), add(r3, r2), sub(r3, r2)];
    return planes.map(p => {
      const l = Math.hypot(p[0], p[1], p[2]) || 1;
      return [p[0] / l, p[1] / l, p[2] / l, p[3] / l];
    });
  }
  sphereVisible(x: number, y: number, z: number, r: number): boolean {
    for (const p of this.frustum) {
      if (p[0] * x + p[1] * y + p[2] * z + p[3] < -r) return false;
    }
    return true;
  }
  /** Viewmodel space box conversion: boxes given in camera-relative coords (x right, y up, z forward). */
  relBoxes(boxes: Box[], cam: { x: number; y: number; z: number; yaw: number; pitch: number }): Box[] {
    const fwd = forwardVec(cam.yaw, cam.pitch);
    const right = norm3(cross3(fwd, [0, 1, 0]));
    const up = cross3(right, fwd);
    return boxes.map(b => ({
      ...b,
      x: cam.x + right[0] * b.x + up[0] * b.y + fwd[0] * b.z,
      y: cam.y + right[1] * b.x + up[1] * b.y + fwd[1] * b.z,
      z: cam.z + right[2] * b.x + up[2] * b.y + fwd[2] * b.z,
      yaw: (b.yaw || 0) + cam.yaw,
    }));
  }
}
