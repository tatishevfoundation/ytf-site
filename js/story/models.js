// Процедурные модели сцены: полигональные персонажи, деревья, мелкие объекты.
// Всё строится из примитивов Three.js; материалы матовые, с плоским затенением.
import * as THREE from 'three';

const shared = new Map();

/** Общий матовый материал по цвету (переиспользуется между объектами). */
export function mat(color, extra = {}) {
  const key = `${color}|${JSON.stringify(extra)}`;
  if (!shared.has(key)) {
    shared.set(key, new THREE.MeshStandardMaterial({
      color, roughness: 0.92, metalness: 0, flatShading: true, ...extra,
    }));
  }
  return shared.get(key);
}

/** Отдельный материал — для того, что меняет цвет по ходу истории. */
export const ownMat = (color, extra = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.92, metalness: 0, flatShading: true, ...extra,
});

/** Параллелепипед, стоящий нижней гранью на y. */
export function box(w, h, d, material, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/** Параллелепипед по границам: x ∈ [x0, x1], y ∈ [y0, y1], z ∈ [z0, z1]. */
export function block([x0, x1], [y0, y1], [z0, z1], material, opts) {
  return box(x1 - x0, y1 - y0, z1 - z0, material, (x0 + x1) / 2, y0, (z0 + z1) / 2, opts);
}

// ——— Персонаж ———
// Рост ≈ 1.1. Смотрит вдоль +z, правая рука — на −x.

const PERSON = {
  hip: 0.46,
  legLen: 0.42,
  shoulder: 0.82,
  armLen: 0.36,
};

const geo = {
  leg: new THREE.BoxGeometry(0.13, PERSON.legLen, 0.14).translate(0, -PERSON.legLen / 2, 0),
  shoe: new THREE.BoxGeometry(0.14, 0.07, 0.21),
  torso: new THREE.BoxGeometry(0.36, 0.4, 0.21),
  arm: new THREE.BoxGeometry(0.1, PERSON.armLen, 0.11).translate(0, -PERSON.armLen / 2, 0),
  hand: new THREE.BoxGeometry(0.09, 0.09, 0.09),
  head: new THREE.BoxGeometry(0.25, 0.25, 0.24),
  eye: new THREE.BoxGeometry(0.035, 0.035, 0.01),
};

export function createPerson({ skin, hair, top, bottom, shoes = '#2b2b30', hairStyle = 'short' }) {
  const root = new THREE.Group();     // позиция и поворот в мире
  const body = new THREE.Group();     // подпрыгивание при ходьбе и прыжке
  root.add(body);

  const mats = {
    skin: mat(skin),
    hair: mat(hair),
    top: ownMat(top),
    bottom: ownMat(bottom),
    shoes: mat(shoes),
  };

  const mesh = (g, m) => {
    const x = new THREE.Mesh(g, m);
    x.castShadow = true;
    return x;
  };

  const makeLeg = (side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.09, PERSON.hip, 0);
    leg.add(mesh(geo.leg, mats.bottom));
    const shoe = mesh(geo.shoe, mats.shoes);
    shoe.position.set(0, -PERSON.legLen + 0.03, 0.03);
    leg.add(shoe);
    body.add(leg);
    return leg;
  };

  const makeArm = (side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.235, PERSON.shoulder, 0);
    arm.add(mesh(geo.arm, mats.top));
    const hand = mesh(geo.hand, mats.skin);
    hand.position.y = -PERSON.armLen - 0.03;
    arm.add(hand);
    const anchor = new THREE.Object3D(); // сюда крепятся папка, диплом, сумка
    anchor.position.y = -PERSON.armLen - 0.06;
    arm.add(anchor);
    body.add(arm);
    return { arm, anchor };
  };

  const legL = makeLeg(1);
  const legR = makeLeg(-1);

  const torso = mesh(geo.torso, mats.top);
  torso.position.y = PERSON.hip + 0.2 - 0.02;
  body.add(torso);

  const head = new THREE.Group();
  head.position.y = 1.0;
  head.add(mesh(geo.head, mats.skin));
  const hairTop = mesh(new THREE.BoxGeometry(0.27, 0.08, 0.26), mats.hair);
  hairTop.position.set(0, 0.13, -0.005);
  head.add(hairTop);
  const hairBack = mesh(new THREE.BoxGeometry(0.27, hairStyle === 'long' ? 0.36 : 0.16, 0.07), mats.hair);
  hairBack.position.set(0, hairStyle === 'long' ? -0.06 : 0.05, -0.11);
  head.add(hairBack);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(geo.eye, mat('#1d1d22'));
    eye.position.set(side * 0.055, 0.01, 0.121);
    head.add(eye);
  }
  body.add(head);

  const { arm: armL, anchor: handL } = makeArm(1);
  const { arm: armR, anchor: handR } = makeArm(-1);

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return { root, body, torso, head, legL, legR, armL, armR, handL, handR, mats };
}

/**
 * Поза персонажа.
 *  walk: фаза шага в радианах (из пройденного расстояния), stride: 0…1 — амплитуда шага.
 *  armL/armR: { x, z } — переопределение поворота руки (x < 0 — вперёд/вверх).
 */
export function applyPose(person, { walk = 0, stride = 0, armL = null, armR = null, bob = 0, lean = 0 } = {}) {
  const swing = Math.sin(walk) * 0.6 * stride;
  person.legL.rotation.x = -swing;
  person.legR.rotation.x = swing;
  person.body.position.y = bob + Math.abs(Math.cos(walk)) * 0.035 * stride;
  person.body.rotation.x = lean;

  const armSwing = swing * 0.8;
  person.armL.rotation.set(armL?.x ?? armSwing, 0, armL?.z ?? 0.06);
  person.armR.rotation.set(armR?.x ?? -armSwing, 0, armR?.z ?? -0.06);
}

/** Длина шага в единицах сцены → фаза для applyPose. */
export const STRIDE = 0.62;
export const walkPhase = (distance) => (distance / STRIDE) * Math.PI;

// ——— Аксессуары героя ———

export function createBackpack() {
  const g = new THREE.Group();
  const bag = box(0.3, 0.34, 0.13, mat('#c0563f'), 0, 0.5, -0.17);
  const flap = box(0.3, 0.1, 0.14, mat('#a8432f'), 0, 0.76, -0.17);
  g.add(bag, flap);
  return g;
}

export function createGown() {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.3, 0.72, 8), mat('#16171c'));
  robe.position.y = 0.46;
  robe.castShadow = true;
  const stole = box(0.24, 0.3, 0.02, mat('#465ED5'), 0, 0.5, 0.115);
  g.add(robe, stole);
  return g;
}

export function createCap() {
  const g = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.08, 8), mat('#16171c'));
  skull.position.y = 0.15;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.38), mat('#16171c'));
  board.position.y = 0.2;
  board.rotation.y = Math.PI / 4;
  const tassel = box(0.025, 0.14, 0.025, mat('#465ED5'), 0.19, 0.07, 0);
  g.add(skull, board, tassel);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createDiploma() {
  const g = new THREE.Group();
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 8), mat('#f6f3ea'));
  roll.rotation.z = Math.PI / 2;
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.035, 8), mat('#465ED5'));
  ribbon.rotation.z = Math.PI / 2;
  g.add(roll, ribbon);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createBriefcase() {
  const g = new THREE.Group();
  const leather = mat('#5c4030');
  const caseBody = box(0.07, 0.2, 0.28, leather, 0, -0.24, 0);
  const handle = box(0.03, 0.04, 0.12, leather, 0, -0.06, 0);
  g.add(caseBody, handle);
  return g;
}

/** Воротник и галстук делового костюма. */
export function createBusinessDetails() {
  const g = new THREE.Group();
  const collar = box(0.18, 0.1, 0.02, mat('#f4f4f2'), 0, 0.7, 0.108, { cast: false });
  const tie = box(0.05, 0.2, 0.02, mat('#465ED5'), 0, 0.52, 0.118, { cast: false });
  g.add(collar, tie);
  return g;
}

// ——— Окружение ———

const treeGeo = {
  trunk: new THREE.CylinderGeometry(0.07, 0.1, 1, 6).translate(0, 0.5, 0),
  crown: new THREE.IcosahedronGeometry(1, 1),
  crownSmall: new THREE.IcosahedronGeometry(1, 0),
};

/** Дерево. crownMat общий для всех деревьев — им управляет смена сезонов. */
export function createTree(crownMat, { x, z, size = 1, trunk = 0.6 }) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(treeGeo.trunk, mat('#7a5a43'));
  t.scale.set(size, trunk * size * 1.2, size);
  t.castShadow = true;
  const crown = new THREE.Mesh(size > 0.85 ? treeGeo.crown : treeGeo.crownSmall, crownMat);
  crown.scale.setScalar(0.62 * size);
  crown.position.y = trunk * size + 0.55 * size;
  crown.castShadow = true;
  crown.receiveShadow = true;
  g.add(t, crown);
  g.position.set(x, 0, z);
  g.userData.crown = crown;
  return g;
}

export function createLamp(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.5, 6), mat('#2d3140'));
  pole.position.y = 0.75;
  pole.castShadow = true;
  const head = box(0.14, 0.18, 0.14, mat('#2d3140'), 0, 1.5, 0);
  const glow = box(0.1, 0.1, 0.1, mat('#fff3d6', { emissive: '#ffe2a8', emissiveIntensity: 0.6 }), 0, 1.52, 0, { cast: false });
  g.add(pole, head, glow);
  g.position.set(x, 0, z);
  return g;
}

export function createBench(x, z, rotationY = 0) {
  const g = new THREE.Group();
  const wood = mat('#9a6d4a');
  const iron = mat('#2d3140');
  g.add(
    box(0.9, 0.06, 0.3, wood, 0, 0.3, 0),
    box(0.9, 0.22, 0.05, wood, 0, 0.38, -0.14),
    box(0.06, 0.3, 0.28, iron, -0.38, 0, 0),
    box(0.06, 0.3, 0.28, iron, 0.38, 0, 0),
  );
  g.position.set(x, 0, z);
  g.rotation.y = rotationY;
  return g;
}

export function createHedge([x0, x1], [z0, z1], hedgeMat, h = 0.32) {
  const m = block([x0, x1], [0, h], [z0, z1], hedgeMat);
  return m;
}

// ——— Логотип как текстура ———
// Оригинальный SVG из assets/brand рисуется на холст целиком, с сохранением пропорций
// (вписывание без обрезки). Холст и плоскость имеют одинаковое соотношение сторон,
// поэтому логотип не искажается.

export async function loadLogoTexture(src, { width, height, padding = 0.1, background = '#ffffff' }) {
  // У SVG логотипа задан только viewBox — размеры берём из него, чтобы пропорции были точными
  // во всех браузерах, и растрируем с запасом по разрешению.
  const svgText = await (await fetch(src)).text();
  const [, , vbW, vbH] = svgText.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const scale = Math.ceil(width / vbW) * 2;
  const sized = svgText.replace('<svg ', `<svg width="${vbW * scale}" height="${vbH * scale}" `);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } finally {
    URL.revokeObjectURL(url);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const availW = width * (1 - padding * 2);
  const availH = height * (1 - padding * 2);
  const ratio = vbW / vbH;
  let w = availW;
  let h = w / ratio;
  if (h > availH) {
    h = availH;
    w = h * ratio;
  }
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
