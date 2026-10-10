// The 3D renderer (three.js). Game code describes what is in the world each frame with simple
// calls (box, cylinder, character...) and the stage keeps a pool of meshes behind the scenes,
// so drawing in 3D reads much like drawing on the 2D canvas did.
//
// Coordinates: the game's (x, y) is the ground plane, in the same pixel units the 2D game used;
// "z" in these calls is height above the ground.
import * as THREE from '../vendor/three.module.min.js';
import { W, H } from '../config.js';
import { buildCharacter, poseCharacter } from './characters3d.js';

const RAD = Math.PI / 180;
const X_AXIS = new THREE.Vector3(1, 0, 0);

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 28),
  cone: new THREE.ConeGeometry(1, 1, 24),
  ball: new THREE.SphereGeometry(1, 24, 16),
  torus: new THREE.TorusGeometry(1, 0.1, 10, 36),
  flat: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
};

// Ring shapes are shared by thickness, so a big thin ring and a small fat one both look right.
const ringCache = new Map();
function ringGeometry(ratio) {
  const key = Math.max(1, Math.round(ratio * 400));
  if (!ringCache.has(key)) ringCache.set(key, new THREE.TorusGeometry(1, key / 400, 8, 48));
  return ringCache.get(key);
}

let renderer = null;
let canvas = null;
const camera = new THREE.PerspectiveCamera(40, W / H, 10, 14000);
const views = new Map();
const tmp = new THREE.Vector3();
const dir = new THREE.Vector3();

// A view is one 3D scene: its lights, any fixed scenery, and pools of reusable meshes.
function makeView() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d0a14');
  const hemi = new THREE.HemisphereLight(0xffffff, 0x554466, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 2;
  scene.add(sun);
  scene.add(sun.target);
  const fixed = new THREE.Group();   // scenery built once (the board's bars, for example)
  scene.add(fixed);
  return { scene, sun, hemi, fixed, pools: {}, used: {}, chars: new Map(), seen: new Set(), anim: [], data: {} };
}

export const stage = {
  ok: false,        // WebGL is available
  enabled: true,    // the player has not switched back to the flat 2D view
  active: false,    // something was drawn in 3D this frame
  view: null,
  THREE,

  init(el) {
    canvas = el;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.ok = true;
    } catch {
      this.ok = false;
      el.style.display = 'none';
    }
  },

  get on() { return this.ok && this.enabled; },

  cssScale: 1,     // screen pixels per game pixel
  window: null,    // { x, y, w, h }: draw this frame into part of the screen only
  shake: 0,        // camera shake, in pixels; set by whoever wants an impact to land

  resize(cssW, cssH, dpr) {
    if (!this.ok) return;
    this.cssScale = cssW / W;
    renderer.setPixelRatio(dpr);
    renderer.setSize(cssW, cssH, false);
  },

  begin() { this.active = false; },

  // Switches to a named view for this frame. Returns true the first time, so the caller can
  // build that view's fixed scenery.
  use(name) {
    let fresh = false;
    let view = views.get(name);
    if (!view) { view = makeView(); views.set(name, view); fresh = true; }
    this.view = view;
    this.active = true;
    for (const k in view.used) view.used[k] = 0;
    view.seen.clear();
    return fresh;
  },

  // Renders the frame, hiding any pooled mesh that was not asked for this time.
  end(t = 0) {
    if (!this.ok) return;
    if (!this.active || !this.enabled) { canvas.style.visibility = 'hidden'; this.window = null; return; }
    const view = this.view;
    for (const kind in view.pools) {
      const pool = view.pools[kind];
      for (let i = view.used[kind] || 0; i < pool.length; i++) pool[i].visible = false;
    }
    for (const [key, c] of view.chars) c.visible = view.seen.has(key);
    for (const fn of view.anim) fn(t);
    canvas.style.visibility = 'visible';
    // Normally the picture fills the screen; `window` confines it to a rectangle (given in
    // the game's 1280 x 720 coordinates), which is how the instruction screen shows a live demo.
    const full = this.window || { x: 0, y: 0, w: W, h: H };
    const k = this.cssScale;
    renderer.setScissorTest(!!this.window);
    renderer.setViewport(full.x * k, (H - full.y - full.h) * k, full.w * k, full.h * k);
    renderer.setScissor(full.x * k, (H - full.y - full.h) * k, full.w * k, full.h * k);
    renderer.render(view.scene, camera);
    this.window = null;
  },

  // Points the camera at a spot on the ground. pitch is degrees above the horizon.
  // o: { yaw, lookZ (height to look at), shiftX (pixels to slide the picture right), fov }
  cam(cx, cy, dist, pitch, o = {}) {
    const p = pitch * RAD;
    const yaw = (o.yaw || 0) * RAD;
    camera.fov = o.fov || 40;
    camera.position.set(cx + Math.sin(yaw) * Math.cos(p) * dist, Math.sin(p) * dist + (o.lookZ || 0), cy + Math.cos(yaw) * Math.cos(p) * dist);
    camera.lookAt(cx, o.lookZ || 0, cy);
    if (this.shake > 0.1) {
      camera.position.x += (Math.random() - 0.5) * this.shake;
      camera.position.y += (Math.random() - 0.5) * this.shake;
    }
    if (o.shiftX) camera.setViewOffset(W, H, -o.shiftX, 0, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    // The sun follows the camera so shadows stay sharp wherever it looks.
    const { sun } = this.view;
    const reach = Math.max(900, dist * 0.8);
    sun.position.set(cx + reach * 0.45, reach * 1.2, cy + reach * 0.55);
    sun.target.position.set(cx, 0, cy);
    const sc = sun.shadow.camera;
    sc.left = -reach; sc.right = reach; sc.top = reach; sc.bottom = -reach;
    sc.near = 10; sc.far = reach * 4;
    sc.updateProjectionMatrix();
  },

  // Where a point in the world lands on the 2D canvas (for labels drawn over the 3D picture).
  project(x, y, z = 0) {
    tmp.set(x, z, y).project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * W, y: (1 - (tmp.y * 0.5 + 0.5)) * H, behind: tmp.z > 1 };
  },

  // ---- pooled shapes ----

  take(kind, color, o) {
    const view = this.view;
    const opacity = o.opacity === undefined ? 1 : o.opacity;
    const solid = opacity >= 1;
    // See-through shapes get a pool of their own: three.js compiles a different shader for
    // them, so a mesh should not flip between solid and see-through from frame to frame.
    const key = solid ? kind : kind + ':clear';
    const pool = view.pools[key] || (view.pools[key] = []);
    const i = view.used[key] || 0;
    view.used[key] = i + 1;
    let m = pool[i];
    if (!m) {
      m = new THREE.Mesh(GEO[kind], new THREE.MeshStandardMaterial({ roughness: 0.75, transparent: !solid, depthWrite: solid }));
      view.scene.add(m);
      pool.push(m);
    }
    m.visible = true;
    m.rotation.set(0, 0, 0);
    m.castShadow = kind !== 'flat' && solid && o.shadow !== false;
    m.receiveShadow = solid;
    const mat = m.material;
    mat.color.set(color);
    mat.opacity = opacity;
    mat.emissive.set(o.glow ? color : 0x000000);
    mat.emissiveIntensity = o.glow || 0;
    return m;
  },

  // A box standing on the ground at (x, y): w across, d deep, h tall. o: { z, rot, opacity, glow }
  box(x, y, w, d, h, color, o = {}) {
    const m = this.take('box', color, o);
    m.scale.set(w, h, d);
    m.position.set(x, (o.z || 0) + h / 2, y);
    if (o.rot) m.rotation.y = -o.rot;
    return m;
  },

  // An upright cylinder. o.lay = 'x' or 'y' lays it on its side along that axis.
  cyl(x, y, r, h, color, o = {}) {
    const m = this.take('cyl', color, o);
    m.scale.set(r, h, r);
    if (o.lay === 'x') { m.rotation.z = Math.PI / 2; m.position.set(x, (o.z || 0) + r, y); }
    else if (o.lay === 'y') { m.rotation.x = Math.PI / 2; m.position.set(x, (o.z || 0) + r, y); }
    else m.position.set(x, (o.z || 0) + h / 2, y);
    return m;
  },

  cone(x, y, r, h, color, o = {}) {
    const m = this.take('cone', color, o);
    m.scale.set(r, h, r);
    m.position.set(x, (o.z || 0) + h / 2, y);
    if (o.flip) m.rotation.x = Math.PI;
    return m;
  },

  ball(x, y, z, r, color, o = {}) {
    const m = this.take('ball', color, o);
    m.scale.set(r * (o.sx || 1), r * (o.sz || 1), r * (o.sy || 1));
    m.position.set(x, z, y);
    return m;
  },

  // A ring of radius r. Lies flat on the ground unless o.upright (then it faces the camera side).
  // o.tube is how thick the ring itself is, in pixels.
  torus(x, y, z, r, color, o = {}) {
    const m = this.take('torus', color, { shadow: false, ...o });
    m.geometry = ringGeometry((o.tube || 4) / r);
    m.scale.set(r, r, r);
    m.position.set(x, z, y);
    if (!o.upright) m.rotation.x = Math.PI / 2;
    return m;
  },

  // A flat rectangle painted on the ground, centred at (x, y).
  flat(x, y, w, d, color, o = {}) {
    const m = this.take('flat', color, o);
    m.scale.set(w, 1, d);
    m.position.set(x, o.z === undefined ? 0.5 : o.z, y);
    if (o.rot) m.rotation.y = -o.rot;
    return m;
  },

  // A flat strip on the ground between two points.
  strip(x1, y1, x2, y2, width, color, o = {}) {
    const m = this.take('flat', color, o);
    const len = Math.hypot(x2 - x1, y2 - y1);
    m.scale.set(len, 1, width);
    m.position.set((x1 + x2) / 2, o.z === undefined ? 1 : o.z, (y1 + y2) / 2);
    m.rotation.y = -Math.atan2(y2 - y1, x2 - x1);
    return m;
  },

  // A bar between any two points in space (ropes, streams, poles at an angle).
  beam(x1, y1, z1, x2, y2, z2, thick, color, o = {}) {
    const m = this.take('box', color, o);
    dir.set(x2 - x1, z2 - z1, y2 - y1);
    const len = dir.length() || 0.001;
    m.scale.set(len, thick, thick);
    m.position.set((x1 + x2) / 2, (z1 + z2) / 2, (y1 + y2) / 2);
    m.quaternion.setFromUnitVectors(X_AXIS, dir.divideScalar(len));
    return m;
  },

  // A character, kept between frames under `key`. o is the same bag of options the 2D
  // drawCharacter took, plus: r (size), z (height), face (heading, radians), hop, sx/sy (squash).
  char(key, id, x, y, o = {}) {
    const view = this.view;
    let c = view.chars.get(key);
    if (!c || c.userData.id !== id) {
      if (c) view.scene.remove(c);
      c = buildCharacter(THREE, id);
      view.scene.add(c);
      view.chars.set(key, c);
    }
    view.seen.add(key);
    poseCharacter(c, x, y, o);
    return c;
  },

  // ---- helpers for building fixed scenery ----

  // A texture painted with the ordinary 2D canvas API.
  paint(w, h, fn) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    fn(cv.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  },

  // Adds a mesh to the current view's fixed scenery.
  fixed(kind, color, o = {}) {
    const mat = o.map
      ? new THREE.MeshStandardMaterial({ map: o.map, roughness: 0.85, transparent: !!o.transparent })
      : new THREE.MeshStandardMaterial({ color, roughness: o.rough === undefined ? 0.8 : o.rough, metalness: o.metal || 0 });
    if (o.glow) { mat.emissive.set(color); mat.emissiveIntensity = o.glow; }
    if (o.map && o.glow) { mat.emissiveMap = o.map; mat.emissive.set(0xffffff); }
    if (o.opacity !== undefined) { mat.transparent = true; mat.opacity = o.opacity; }
    if (o.flatShading) mat.flatShading = true;
    const m = new THREE.Mesh(o.geo || GEO[kind], mat);
    m.castShadow = kind !== 'flat' && o.shadow !== false;
    m.receiveShadow = true;
    this.view.fixed.add(m);
    return m;
  },

  fixedBox(x, y, w, d, h, color, o = {}) {
    const m = this.fixed('box', color, o);
    m.scale.set(w, h, d);
    m.position.set(x, (o.z || 0) + h / 2, y);
    if (o.rot) m.rotation.y = -o.rot;
    return m;
  },

  fixedCyl(x, y, r, h, color, o = {}) {
    const m = this.fixed('cyl', color, o);
    m.scale.set(r, h, r);
    m.position.set(x, (o.z || 0) + h / 2, y);
    return m;
  },

  fixedBall(x, y, z, r, color, o = {}) {
    const m = this.fixed('ball', color, o);
    m.scale.setScalar(r);
    m.position.set(x, z, y);
    return m;
  },

  fixedFlat(x, y, w, d, color, o = {}) {
    const m = this.fixed('flat', color, o);
    m.scale.set(w, 1, d);
    m.position.set(x, o.z === undefined ? 0 : o.z, y);
    return m;
  },

  // A flat picture standing upright, facing the camera side (signs on the back walls).
  fixedSign(x, y, z, w, h, map, o = {}) {
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, z + h / 2, y);
    if (o.tilt) m.rotation.x = -o.tilt;
    this.view.fixed.add(m);
    return m;
  },

  // Runs every frame while this view is shown (flickering flames, spinning disco ball).
  animate(fn) { this.view.anim.push(fn); },
};
