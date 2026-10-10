// The cast as 3D models, built from simple shapes. Each model stands on the ground at its
// origin, faces +Z (towards the camera), and is about 2 units tall so it can be scaled by the
// same "radius" the 2D drawings used.

function build(THREE, id) {
  const mats = [];
  const mat = (color, o = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: o.rough === undefined ? 0.55 : o.rough, transparent: o.opacity !== undefined, opacity: o.opacity === undefined ? 1 : o.opacity,
    });
    m.userData.base = m.opacity;
    mats.push(m);
    return m;
  };
  const root = new THREE.Group();
  const tilt = new THREE.Group();   // everything that sways when drunk
  root.add(tilt);
  const add = (geo, material, x, y, z, parent = tilt) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const sphere = (r) => new THREE.SphereGeometry(r, 24, 16);

  let faceY = 1.05;
  let faceZ = 0.8;
  let faceS = 1;

  if (id === 'pint') {
    add(new THREE.CylinderGeometry(0.72, 0.72, 1.5, 28), mat('#f2a51d'), 0, 0.95, 0);
    const handle = add(new THREE.TorusGeometry(0.36, 0.1, 10, 20), mat('#ffe9b0'), 0.84, 0.95, 0);
    handle.scale.set(1, 1.15, 1);
    const foam = mat('#fffaf0', { rough: 0.9 });
    for (const [x, y, z, r] of [[-0.4, 1.74, 0.1, 0.34], [0.4, 1.74, -0.1, 0.34], [0, 1.74, 0.42, 0.32], [0, 1.74, -0.42, 0.32], [0, 1.9, 0, 0.4]]) {
      add(sphere(r), foam, x, y, z);
    }
    faceZ = 0.72;
  } else if (id === 'shot') {
    add(new THREE.CylinderGeometry(0.6, 0.46, 1.05, 24), mat('#ffcf5a'), 0, 0.82, 0);
    add(new THREE.CylinderGeometry(0.7, 0.5, 1.55, 24), mat('#d6f1ff', { opacity: 0.45, rough: 0.15 }), 0, 0.98, 0);
    faceY = 1.0;
    faceZ = 0.64;
    faceS = 0.9;
  } else if (id === 'lime') {
    add(sphere(0.86), mat('#4fae2a'), 0, 1.0, 0);
    const slice = add(new THREE.CircleGeometry(0.62, 28), mat('#b8ee6b'), 0, 1.0, 0.82);
    slice.castShadow = false;
    add(sphere(0.12), mat('#2f6f18'), 0, 1.86, 0);
    faceZ = 0.86;
  } else if (id === 'olive') {
    const body = add(sphere(0.84), mat('#8a9a2b'), 0, 1.05, 0);
    body.scale.set(0.95, 1.12, 0.95);
    add(sphere(0.22), mat('#e2412f'), 0, 1.98, 0.08);
    const pick = add(new THREE.CylinderGeometry(0.035, 0.035, 1.2, 8), mat('#e8d2a0'), -0.12, 2.3, 0);
    pick.rotation.z = 0.3;
    faceZ = 0.8;
  } else if (id === 'tini') {
    const bowl = add(new THREE.ConeGeometry(0.98, 0.95, 28), mat('#ff9ed2', { opacity: 0.9, rough: 0.2 }), 0, 1.55, 0);
    bowl.rotation.x = Math.PI;
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.95, 10), mat('#ffd3ea'), 0, 0.62, 0);
    add(new THREE.CylinderGeometry(0.5, 0.55, 0.08, 24), mat('#ffd3ea'), 0, 0.2, 0);
    add(sphere(0.15), mat('#8a9a2b'), 0.35, 2.1, 0);
    faceY = 1.74;
    faceZ = 0.7;
    faceS = 0.72;
  } else {
    add(sphere(0.86), mat('#e8323c', { rough: 0.3 }), 0, 1.0, 0);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 1.8, 0), new THREE.Vector3(0.05, 2.4, 0), new THREE.Vector3(0.45, 2.6, 0));
    add(new THREE.TubeGeometry(curve, 10, 0.05, 8), mat('#4a8f2a'), 0, 0, 0);
    const leaf = add(sphere(0.2), mat('#5fb234'), 0.62, 2.56, 0);
    leaf.scale.set(1.3, 0.35, 0.7);
    faceZ = 0.86;
  }

  // Face: eyes, blush that shows as the character gets drunk, and a mouth with two moods.
  const white = mat('#ffffff', { rough: 0.3 });
  const dark = mat('#1b1320', { rough: 0.3 });
  const blush = [];
  for (const sx of [-1, 1]) {
    const eye = add(sphere(0.2 * faceS), white, sx * 0.3 * faceS, faceY + 0.12 * faceS, faceZ - 0.04);
    eye.scale.z = 0.55;
    const pupil = add(sphere(0.1 * faceS), dark, sx * 0.3 * faceS, faceY + 0.1 * faceS, faceZ + 0.06);
    pupil.scale.z = 0.55;
    const cheekMat = mat('#ff5a78', { opacity: 0 });
    const cheek = add(sphere(0.16 * faceS), cheekMat, sx * 0.54 * faceS, faceY - 0.12 * faceS, faceZ - 0.08);
    cheek.scale.set(1, 0.65, 0.4);
    cheek.castShadow = false;
    blush.push(cheekMat);
  }
  const smile = add(new THREE.TorusGeometry(0.18 * faceS, 0.04 * faceS, 6, 14, Math.PI), dark, 0, faceY - 0.14 * faceS, faceZ + 0.02);
  smile.rotation.z = Math.PI;
  const frown = add(new THREE.TorusGeometry(0.16 * faceS, 0.04 * faceS, 6, 14, Math.PI), dark, 0, faceY - 0.42 * faceS, faceZ + 0.02);
  frown.visible = false;

  // Feet stay on the floor while the body sways.
  const shoe = mat('#2a1d1d');
  const feet = [-1, 1].map((sx) => {
    const f = add(sphere(0.26), shoe, sx * 0.34, 0.12, 0.12, root);
    f.scale.set(1, 0.5, 1.4);
    return f;
  });

  root.userData = { id, tilt, feet, blush, smile, frown, mats };
  return root;
}

export function buildCharacter(THREE, id) {
  return build(THREE, id);
}

// o: { r, z, face, hop, sx, sy, t, drunk, phase, moving, walk, tilt, lean, sad, alpha }
export function poseCharacter(c, x, y, o) {
  const u = c.userData;
  const r = o.r || 30;
  const d = o.drunk || 0;
  const t = o.t || 0;
  const phase = o.phase || 0;
  c.position.set(x, (o.z || 0) + (o.hop || 0), y);
  c.scale.set(r * (o.sx || 1), r * (o.sy || 1), r * (o.sx || 1));
  // With no heading given the character faces the camera.
  c.rotation.y = o.face === undefined ? 0 : Math.PI / 2 - o.face;
  u.tilt.rotation.z = Math.sin(t * 2.6 + phase) * 0.26 * d - (o.tilt || 0);
  u.tilt.rotation.x = Math.cos(t * 2.1 + phase) * 0.12 * d + (o.lean || 0);
  const step = o.moving ? Math.sin((o.walk || 0) * 14) : 0;
  u.feet[0].position.z = 0.12 + step * 0.3;
  u.feet[1].position.z = 0.12 - step * 0.3;
  u.tilt.position.y = o.moving ? Math.abs(step) * 0.14 : 0;
  for (const m of u.blush) { m.opacity = 0.75 * d; m.userData.base = m.opacity; }
  u.smile.visible = !o.sad;
  u.frown.visible = !!o.sad;
  const alpha = o.alpha === undefined ? 1 : Math.max(0, o.alpha);
  if (alpha !== u.alpha) {
    u.alpha = alpha;
    for (const m of u.mats) {
      if (u.blush.includes(m)) continue;
      m.opacity = m.userData.base * alpha;
      const clear = m.opacity < 1;
      // three.js needs telling when a material switches between solid and see-through.
      if (m.transparent !== clear) { m.transparent = clear; m.needsUpdate = true; }
    }
  }
}
