// 3D-сцена «Путь стипендиата»: процедурный кампус, офис и персонажи.
// Состояние сцены — чистая функция прогресса p: update(p) выставляет позиции, позы,
// одежду, сезон и камеру без накопления состояния между кадрами.
import * as THREE from 'three';
import {
  T, Path, span, smooth, easeInOut, lerp, lerpAngle, bell, clamp01, pingPong,
} from './timeline.js';
import {
  mat, ownMat, box, block, createPerson, applyPose, walkPhase,
  createBackpack, createGown, createCap, createDiploma, createBriefcase, createBusinessDetails,
  createTree, createLamp, createBench, createHedge, loadLogoTexture,
} from './models.js';

// ——— Палитра ———
const C = {
  stone: '#ede5d6',
  stoneDark: '#ddd2bf',
  roof: '#4c5fc7',        // синий бренда, приглушённый под матовый материал
  glass: '#46557a',
  glassLit: '#f1cf8f',
  concrete: '#f1f0eb',
  concreteDark: '#d9d6ce',
  plateSide: '#d8d2c6',
  trunk: '#7a5a43',
  snow: '#f7f9fb',
};

// Сезоны: s = 0 (лето) → 0.25 (осень) → 0.5 (зима) → 0.75 (весна) → 1 (снова лето).
const SEASONS = {
  crown: ['#6aa35a', '#d8913c', '#e8edf1', '#9fd27c', '#6aa35a'],
  grass: ['#93c16f', '#cdb56c', '#eef2f5', '#a3d07c', '#93c16f'],
  hedge: ['#5c9150', '#a9853f', '#dfe6ea', '#6fa557', '#5c9150'],
  path: ['#e7e2d8', '#e5dccb', '#f3f5f7', '#e7e2d8', '#e7e2d8'],
  light: ['#fff4e2', '#ffe9cc', '#eef3ff', '#fff6e8', '#fff4e2'],
};

// ——— Ключевые точки сцены ———
const PERSON_SCALE = 1.4; // персонажи чуть крупнее «реального» масштаба — так они читаются на фоне зданий
const HERO_START = [0.9, 0, -4.2];
// Представитель стоит справа от героя (по экрану) и чуть ближе к зрителю — чтобы правые руки встретились.
const REP_GAP = 0.8 * PERSON_SCALE;
const REP_SHIFT = 0.47 * PERSON_SCALE;
const REP_POS = [
  HERO_START[0] + (REP_GAP + REP_SHIFT) * Math.SQRT1_2,
  0,
  HERO_START[2] + (REP_SHIFT - REP_GAP) * Math.SQRT1_2,
];
const CHEER_POS = [0.55, 0, -3.75];
const COLLEAGUE_POS = [1.95, 0, 7.3];
const OCCLUDER_TREE = { x: 3.6, z: 3.0 }; // за этим деревом герой переодевается

const PATHS = {
  toUniversity: new Path([
    HERO_START, [0.2, 0, -4.5], [-0.3, 0.08, -4.5], [-1.5, 0.6, -4.5], [-3.0, 0.6, -4.5], [-3.9, 0.6, -4.5],
  ]),
  exit: new Path([
    [-3.9, 0.6, -4.5], [-3.0, 0.6, -4.5], [-1.5, 0.6, -4.5], [-0.3, 0.08, -4.5], [0.1, 0, -4.2], CHEER_POS,
  ]),
  toOffice: new Path([
    CHEER_POS, [2.0, 0, -2.6], [2.6, 0, -1.4],
    [2.6, 0, 2.0],           // индекс 3 — точка за деревом, здесь меняется одежда
    [2.6, 0, 5.8], [2.55, 0, 6.3],
  ]),
  enterOffice: new Path([[2.55, 0, 6.3], [1.75, 0, 6.45], [0.6, 0, 6.45]]),
  colleagueIn: new Path([COLLEAGUE_POS, [1.65, 0, 6.75], [0.6, 0, 6.75]]),
};
const SWAP_DISTANCE = PATHS.toOffice.distTo(3);

// Камера: ракурс фиксирован, по ходу истории она лишь плавно смещает центр и масштаб.
const VIEW_DIR = new THREE.Vector3(1, 0.86, 1).normalize();
const CAMERA_KEYS = [
  { p: 0.0, x: 0.9, z: -5.3, zoom: 2.25 },
  { p: 0.19, x: 0.9, z: -5.3, zoom: 2.25 },
  { p: 0.34, x: -1.0, z: -4.4, zoom: 1.8 },
  { p: 0.4, x: 0.2, z: -1.0, zoom: 1.08 },
  { p: 0.555, x: 0.2, z: -1.0, zoom: 1.08 },
  { p: 0.63, x: 0.2, z: -4.6, zoom: 2.1 },
  { p: 0.7, x: 0.9, z: -3.9, zoom: 2.05 },
  { p: 0.8, x: 2.2, z: 1.0, zoom: 1.6 },
  { p: 0.9, x: 1.6, z: 5.9, zoom: 2.2 },
  { p: 1.0, x: 1.4, z: 6.1, zoom: 2.2 },
];

function cameraAt(p) {
  let i = 1;
  while (i < CAMERA_KEYS.length - 1 && CAMERA_KEYS[i].p < p) i++;
  const a = CAMERA_KEYS[i - 1];
  const b = CAMERA_KEYS[i];
  const t = smooth(clamp01((p - a.p) / (b.p - a.p || 1)));
  return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), zoom: lerp(a.zoom, b.zoom, t) };
}

function colorAt(keys, s, target) {
  const scaled = clamp01(s) * (keys.length - 1);
  const i = Math.min(Math.floor(scaled), keys.length - 2);
  return target.set(keys[i]).lerp(new THREE.Color(keys[i + 1]), smooth(scaled - i));
}

/** Снежный слой: геометрия сдвинута так, что масштаб по y растёт от основания. */
function snowSlab([x0, x1], y, [z0, z1], h = 0.09) {
  const g = new THREE.BoxGeometry(x1 - x0, h, z1 - z0).translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, mat(C.snow));
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  m.scale.y = 0.001;
  m.visible = false;
  return m;
}

/** Окна одним InstancedMesh на материал. Каждое окно: центр, размеры. */
class WindowSet {
  constructor() { this.items = []; }

  add(x, y, z, sx, sy, sz, lit) { this.items.push({ x, y, z, sx, sy, sz, lit }); }

  build(group) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (const lit of [false, true]) {
      const list = this.items.filter((w) => w.lit === lit);
      const material = lit
        ? mat(C.glassLit, { emissive: '#f5c26b', emissiveIntensity: 0.35 })
        : mat(C.glass, { roughness: 0.4, metalness: 0.15 });
      const mesh = new THREE.InstancedMesh(geo, material, list.length);
      const m = new THREE.Matrix4();
      list.forEach((w, i) => {
        m.compose(new THREE.Vector3(w.x, w.y, w.z), new THREE.Quaternion(), new THREE.Vector3(w.sx, w.sy, w.sz));
        mesh.setMatrixAt(i, m);
      });
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
}

// Детерминированный «случайный» выбор горящих окон.
const lit = (i) => ((i * 37) % 11) < 3;

export function createStoryScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);

  // ——— Свет ———
  const hemi = new THREE.HemisphereLight('#f4f7ff', '#c4cbd9', 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e2', 2.4);
  sun.position.set(9, 18, -7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ——— Материалы, меняющиеся с сезонами ———
  const seasonal = {
    crown: ownMat(SEASONS.crown[0]),
    grass: ownMat(SEASONS.grass[0]),
    hedge: ownMat(SEASONS.hedge[0]),
    path: ownMat(SEASONS.path[0]),
  };
  const snowLayers = [];

  // ——— Основание-диорама ———
  scene.add(block([-11, 11], [-0.9, -0.12], [-11, 11], mat(C.plateSide), { cast: false }));
  scene.add(block([-11, 11], [-0.12, 0], [-11, 11], seasonal.grass, { cast: false }));
  const pave = (xs, zs) => scene.add(block(xs, [0, 0.035], zs, seasonal.path, { cast: false }));
  pave([-10.6, 4.4], [-10.6, -0.6]);   // площадь перед университетом
  pave([1.8, 3.4], [-0.6, 10.6]);      // главная аллея
  pave([1.5, 1.8], [5.8, 7.2]);        // вход в офис
  pave([4.4, 10.6], [-5.2, -3.8]);     // восточная дорожка
  pave([5.6, 10.4], [-6.4, -5.2]);     // перед корпусом

  const windows = new WindowSet();

  // ——— Университет: классический корпус с портиком ———
  const uni = new THREE.Group();
  const stone = mat(C.stone);
  const stoneDark = mat(C.stoneDark);
  const roof = mat(C.roof);
  uni.add(block([-8.6, -3.0], [0, 3.9], [-10.2, 0.6], stone));
  uni.add(block([-8.75, -2.85], [3.9, 4.12], [-10.35, 0.75], stoneDark));
  uni.add(block([-8.5, -3.1], [4.12, 4.5], [-10.1, 0.5], roof));
  snowLayers.push(snowSlab([-8.5, -3.1], 4.5, [-10.1, 0.5]));
  for (const [z0, z1] of [[-10.2, -7.4], [-1.6, 0.6]]) {
    uni.add(block([-3.0, -1.9], [0, 3.5], [z0, z1], stone));
    uni.add(block([-3.05, -1.85], [3.5, 3.72], [z0 - 0.05, z1 + 0.05], roof));
    snowLayers.push(snowSlab([-3.05, -1.85], 3.72, [z0 - 0.05, z1 + 0.05]));
  }
  // подиум, ступени, колонны
  uni.add(block([-3.0, -1.5], [0, 0.6], [-6.8, -2.2], stoneDark));
  for (let i = 0; i < 4; i++) {
    uni.add(block([-1.5, -1.5 + (i + 1) * 0.3], [0, 0.6 - i * 0.15], [-6.0, -3.0], stoneDark));
  }
  const columnGeo = new THREE.CylinderGeometry(0.14, 0.17, 2.9, 8);
  // между центральными колоннами — проход 1.1 под дверью
  for (const z of [-6.6, -5.8, -5.05, -3.95, -3.2, -2.4]) {
    const col = new THREE.Mesh(columnGeo, stone);
    col.position.set(-1.75, 0.6 + 1.45, z);
    col.castShadow = true;
    col.receiveShadow = true;
    uni.add(col);
  }
  uni.add(block([-3.0, -1.5], [3.5, 3.85], [-6.9, -2.1], stone));
  const pedimentShape = new THREE.Shape([new THREE.Vector2(-2.4, 0), new THREE.Vector2(2.4, 0), new THREE.Vector2(0, 1.0)]);
  const pediment = new THREE.Mesh(
    new THREE.ExtrudeGeometry(pedimentShape, { depth: 1.5, bevelEnabled: false }).rotateY(Math.PI / 2),
    stone,
  );
  pediment.position.set(-3.0, 3.85, -4.5);
  pediment.castShadow = true;
  uni.add(pediment);
  for (const side of [1, -1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 2.66), roof);
    slope.position.set(-2.25, 3.85 + 0.55, -4.5 + side * 1.2);
    slope.rotation.x = side * Math.atan2(1.0, 2.4);
    slope.castShadow = true;
    uni.add(slope);
  }
  // дверь — тёмный проём с тёплым светом изнутри
  uni.add(block([-3.04, -2.97], [0.6, 2.15], [-5.05, -3.95], mat('#3a3128', { emissive: '#6b4a22', emissiveIntensity: 0.35 })));
  // окна фасада (+x) и торца (+z)
  let wi = 0;
  for (const y of [1.15, 2.45, 3.35]) {
    for (let z = -9.7; z <= 0.2; z += 0.95) {
      const inPortico = z > -7.0 && z < -2.0;
      if (inPortico && y < 3) continue;
      windows.add(-2.99, y, z, 0.06, y > 3 ? 0.42 : 0.78, 0.48, lit(wi++));
    }
    for (let x = -8.1; x <= -3.4; x += 0.95) windows.add(x, y, 0.61, 0.48, y > 3 ? 0.42 : 0.78, 0.06, lit(wi++));
  }
  for (const y of [1.15, 2.45]) {
    for (const z of [-9.7, -8.75, -7.9]) windows.add(-1.89, y, z, 0.06, 0.78, 0.48, lit(wi++));
    for (const z of [-1.1, -0.15]) windows.add(-1.89, y, z, 0.06, 0.78, 0.48, lit(wi++));
    windows.add(-2.45, y, 0.61, 0.48, 0.78, 0.06, lit(wi++));
  }
  scene.add(uni);

  // ——— Баннер с логотипом фонда ———
  const banner = new THREE.Group();
  const BANNER_W = 3.2;
  const BANNER_H = 1.6; // 2 : 1 — как у холста текстуры
  const bannerMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const bannerPlane = new THREE.Mesh(new THREE.PlaneGeometry(BANNER_W, BANNER_H), bannerMat);
  bannerPlane.position.y = 1.75;
  bannerPlane.castShadow = true;
  const bannerBack = new THREE.Mesh(new THREE.PlaneGeometry(BANNER_W, BANNER_H), mat('#e9e9ec'));
  bannerBack.position.set(0, 1.75, -0.005);
  bannerBack.rotation.y = Math.PI;
  banner.add(bannerPlane, bannerBack);
  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.65, 6), mat('#2d3140'));
    pole.position.set(side * (BANNER_W / 2 + 0.06), 1.325, -0.02);
    pole.castShadow = true;
    banner.add(pole);
  }
  banner.position.set(0.9, 0, -7.6);
  banner.rotation.y = Math.PI / 4; // плоскостью к зрителю — логотип читается без перспективных искажений
  scene.add(banner);

  // ——— Офис: современное здание ———
  const office = new THREE.Group();
  const concrete = mat(C.concrete);
  const officeGlass = mat('#3f5482', { roughness: 0.35, metalness: 0.2 });
  office.add(block([-3.6, 1.5], [0, 3.6], [4.2, 9.6], concrete));
  office.add(block([-3.65, 1.55], [3.6, 3.78], [4.15, 9.65], mat(C.concreteDark)));
  office.add(block([-2.6, -1.2], [3.78, 4.2], [5.2, 6.4], mat('#c9c6be')));
  snowLayers.push(snowSlab([-3.65, 1.55], 3.78, [4.15, 9.65]));
  for (const [y0, y1] of [[1.0, 1.65], [2.25, 2.9]]) {
    office.add(block([1.5, 1.56], [y0, y1], [4.5, 9.3], officeGlass));
    office.add(block([-3.3, 1.2], [y0, y1], [9.6, 9.66], officeGlass));
  }
  office.add(block([1.5, 1.56], [0.15, 0.8], [4.5, 5.7], officeGlass));
  office.add(block([1.5, 1.56], [0.15, 0.8], [7.3, 9.3], officeGlass));
  office.add(block([-3.3, 1.2], [0.15, 0.8], [9.6, 9.66], officeGlass));
  office.add(block([1.5, 1.55], [0, 1.45], [6.0, 7.0], mat('#25304a', { emissive: '#3a4f7a', emissiveIntensity: 0.25 })));
  office.add(block([1.5, 2.35], [1.55, 1.66], [5.7, 7.3], mat(C.concreteDark)));
  office.add(block([1.5, 1.53], [1.78, 1.98], [5.95, 7.05], mat('#465ED5'), { cast: false }));
  scene.add(office);

  // ——— Учебный корпус справа ———
  const annex = new THREE.Group();
  annex.add(block([5.6, 10.4], [0, 3.0], [-10.4, -6.4], mat('#eef0f4')));
  annex.add(block([5.5, 10.5], [3.0, 3.22], [-10.5, -6.3], roof));
  snowLayers.push(snowSlab([5.5, 10.5], 3.22, [-10.5, -6.3]));
  for (const [y0, y1] of [[0.3, 1.2], [1.75, 2.65]]) {
    annex.add(block([5.9, 10.1], [y0, y1], [-6.4, -6.34], officeGlass));
    annex.add(block([10.4, 10.46], [y0, y1], [-10.1, -6.7], officeGlass));
  }
  scene.add(annex);
  for (const s of snowLayers) scene.add(s);
  windows.build(scene);

  // ——— Деревья, кусты, фонари, скамейки ———
  // Деревья — по краям, чтобы не загораживать действие; одно крупное у аллеи служит укрытием для переодевания.
  const trees = [
    { ...OCCLUDER_TREE, size: 1.9, trunk: 0.36 },
    { x: 9.6, z: -2.2, size: 1.1 }, { x: 8.0, z: 3.4, size: 1.4 }, { x: 10.0, z: 0.6, size: 1.0 },
    { x: 9.3, z: 7.8, size: 1.4 }, { x: 6.0, z: 9.6, size: 1.1 }, { x: 10.1, z: 5.0, size: 0.9 },
    { x: -5.6, z: 2.4, size: 1.2 }, { x: -8.8, z: 4.6, size: 1.3 },
    { x: -7.6, z: 9.2, size: 1.1 }, { x: -9.9, z: 1.6, size: 0.9 },
    { x: -10.0, z: -3.0, size: 1.0 }, { x: -10.0, z: -7.5, size: 1.1 },
    { x: 4.3, z: -9.6, size: 0.9 },
  ];
  for (const t of trees) scene.add(createTree(seasonal.crown, t));

  for (const [xs, zs] of [
    [[3.6, 4.4], [-0.4, -0.2]], [[1.0, 1.6], [-0.4, -0.2]],
    [[3.55, 3.75], [4.6, 8.8]], [[1.55, 1.75], [0.4, 4.6]],
    [[4.4, 10.6], [-3.6, -3.4]], [[-1.0, 1.4], [9.9, 10.1]],
  ]) scene.add(createHedge(xs, zs, seasonal.hedge));

  for (const [x, z] of [[1.4, 1.2], [3.75, -0.25], [3.75, 4.4], [1.4, 8.9], [0.25, -0.9], [4.6, -5.5]]) {
    scene.add(createLamp(x, z));
  }
  for (const [x, z, r] of [[-1.1, 2.6, Math.PI / 2], [4.3, 6.4, -Math.PI / 2]]) {
    const bench = createBench(x, z, r);
    bench.scale.setScalar(PERSON_SCALE);
    scene.add(bench);
  }

  // ——— Персонажи ———
  const hero = createPerson({ skin: '#d6a07a', hair: '#1f1a17', top: '#465ED5', bottom: '#2b3550' });
  const outfit = {
    backpack: createBackpack(),
    gown: createGown(),
    cap: createCap(),
    diploma: createDiploma(),
    briefcase: createBriefcase(),
    business: createBusinessDetails(),
  };
  hero.body.add(outfit.backpack, outfit.gown, outfit.business);
  hero.head.add(outfit.cap);
  outfit.cap.position.y = -0.03;
  hero.handR.add(outfit.diploma, outfit.briefcase);
  scene.add(hero.root);

  const rep = createPerson({ skin: '#e0ae86', hair: '#2a2420', top: '#1f2a48', bottom: '#1f2a48' });
  rep.body.add(createBusinessDetails());
  rep.root.position.set(...REP_POS);
  scene.add(rep.root);

  const colleague = createPerson({ skin: '#e8b892', hair: '#3b2a20', top: '#e6eaf4', bottom: '#3a3f52', hairStyle: 'long' });
  scene.add(colleague.root);

  // Фоновые студенты
  const walkers = [
    { person: createPerson({ skin: '#c99872', hair: '#2a211b', top: '#7f9f6a', bottom: '#384057' }), from: [4.9, -4.5], to: [10.1, -4.5], speed: 2.2, offset: 0.1 },
    { person: createPerson({ skin: '#e2b08a', hair: '#4a3020', top: '#d48a5c', bottom: '#2f3446', hairStyle: 'long' }), from: [6.1, -5.8], to: [10.0, -5.8], speed: 1.7, offset: 0.62 },
  ];
  for (const w of walkers) scene.add(w.person.root);
  const reader = createPerson({ skin: '#d9a57f', hair: '#1f1a17', top: '#9b86c4', bottom: '#2f3446', hairStyle: 'long' });
  reader.root.position.set(-1.1, 0, 2.6);
  reader.root.rotation.y = Math.PI / 2;
  reader.body.position.y = -0.1;
  reader.legL.rotation.x = reader.legR.rotation.x = -1.45;
  reader.armL.rotation.x = reader.armR.rotation.x = -0.9;
  reader.armL.rotation.z = 0.35;
  reader.armR.rotation.z = -0.35;
  const book = box(0.22, 0.03, 0.16, mat('#465ED5'), 0, 0.62, 0.3);
  reader.body.add(book);
  scene.add(reader.root);

  for (const person of [hero, rep, colleague, reader, ...walkers.map((w) => w.person)]) {
    person.root.scale.setScalar(PERSON_SCALE);
  }

  // ——— Папка с грантом ———
  const folderSide = mat('#3c52c4');
  const folderFront = new THREE.MeshBasicMaterial({ color: '#465ED5', toneMapped: false });
  const folder = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.34, 0.035),
    [folderSide, folderSide, folderSide, folderSide, folderFront, folderSide],
  );
  folder.castShadow = true;
  folder.scale.setScalar(PERSON_SCALE);
  scene.add(folder);

  // ——— Снегопад ———
  const SNOW_COUNT = 320;
  const snowSeeds = Array.from({ length: SNOW_COUNT }, (_, i) => {
    const r = (n) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
    return [r(1) * 22 - 11, r(2) * 9, r(3) * 22 - 11, r(4) * 6.28];
  });
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SNOW_COUNT * 3), 3));
  const snowMat = new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const snowfall = new THREE.Points(snowGeo, snowMat);
  snowfall.frustumCulled = false;
  scene.add(snowfall);

  // ——— Логотипы как текстуры (оригинальные SVG из assets/brand) ———
  const ready = Promise.all([
    loadLogoTexture('assets/brand/logo-vertical-blue.svg', { width: 1024, height: 512, padding: 0.12 }).then((tex) => {
      bannerMat.map = tex;
      bannerMat.needsUpdate = true;
    }),
    loadLogoTexture('assets/brand/logo-vertical-white.svg', { width: 260, height: 340, padding: 0.14, background: '#465ED5' }).then((tex) => {
      folderFront.map = tex;
      folderFront.color.set('#ffffff');
      folderFront.needsUpdate = true;
    }),
  ]).catch((err) => console.warn('[story] Логотип не загрузился', err));

  // ——— Камера: вписываем диораму в кадр ———
  let baseFrustum = { w: 10, h: 10, cx: 0, cy: 0 };
  let aspect = 1;
  let mobileBoost = 1;

  function fitCamera(width, height) {
    aspect = width / height;
    mobileBoost = aspect < 0.95 ? 1.12 : 1;
    camera.position.copy(VIEW_DIR).multiplyScalar(60);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const inv = camera.matrixWorldInverse;
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    for (const x of [-11, 11]) for (const y of [-0.9, 5.2]) for (const z of [-11, 11]) {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(inv);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    let w = (maxX - minX) * 1.04;
    let h = (maxY - minY) * 1.04;
    if (w / h > aspect) h = w / aspect;
    else w = h * aspect;
    baseFrustum = { w, h, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }

  function placeCamera(p) {
    const focus = cameraAt(p);
    const target = new THREE.Vector3(focus.x, 0, focus.z);
    camera.position.copy(target).addScaledVector(VIEW_DIR, 60);
    camera.lookAt(target);
    // центр кадра: смещение вписанной диорамы плавно уступает точке фокуса по мере приближения
    const k = clamp01((focus.zoom - 1) / 0.8);
    const { w, h, cx, cy } = baseFrustum;
    const ox = lerp(cx, 0, k);
    const oy = lerp(cy, 0, k);
    Object.assign(camera, { left: ox - w / 2, right: ox + w / 2, top: oy + h / 2, bottom: oy - h / 2 });
    camera.zoom = focus.zoom * mobileBoost;
    camera.updateProjectionMatrix();
  }

  // ——— Состояние по прогрессу ———
  const tmpColor = new THREE.Color();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();

  function setRoot(person, [x, y, z], heading) {
    person.root.position.set(x, y, z);
    if (heading != null) person.root.rotation.y = heading;
  }

  const headingTo = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);
  const HERO_FACING_REP = headingTo(HERO_START, REP_POS);
  const REP_FACING_HERO = headingTo(REP_POS, HERO_START);
  const FACING_VIEWER = Math.PI / 4;

  function walkAlong(person, path, t, { ease = true } = {}) {
    const d = path.length * (ease ? easeInOut(t) : t);
    const pos = path.at(d);
    setRoot(person, pos, path.heading(d));
    // амплитуда шага затухает в начале и конце пути
    const stride = t <= 0 || t >= 1 ? 0 : Math.min(1, d / 0.3, (path.length - d) / 0.3);
    return { d, phase: walkPhase(d / PERSON_SCALE), stride };
  }

  function setOutfit(kind) {
    const casual = kind === 'casual';
    const gown = kind === 'gown';
    const business = kind === 'business';
    outfit.backpack.visible = casual;
    outfit.gown.visible = gown;
    outfit.cap.visible = gown;
    outfit.diploma.visible = gown;
    outfit.business.visible = business;
    outfit.briefcase.visible = business;
    hero.mats.top.color.set(casual ? '#465ED5' : gown ? '#16171c' : '#273352');
    hero.mats.bottom.color.set(casual ? '#2b3550' : gown ? '#16171c' : '#3b3f4a');
  }

  function update(p) {
    // ——— Сезоны ———
    const s = span(p, T.seasons);
    colorAt(SEASONS.crown, s, seasonal.crown.color);
    colorAt(SEASONS.grass, s, seasonal.grass.color);
    colorAt(SEASONS.hedge, s, seasonal.hedge.color);
    colorAt(SEASONS.path, s, seasonal.path.color);
    colorAt(SEASONS.light, s, sun.color);
    const winter = smooth(clamp01(1 - Math.abs(s - 0.5) / 0.2));
    for (const layer of snowLayers) {
      layer.visible = winter > 0.01;
      layer.scale.y = Math.max(winter, 0.001);
    }
    const snowing = smooth(clamp01(1 - Math.abs(s - 0.47) / 0.17));
    snowfall.visible = snowing > 0.01;
    snowMat.opacity = snowing * 0.95;
    if (snowfall.visible) {
      const arr = snowGeo.attributes.position.array;
      snowSeeds.forEach(([x, y, z, ph], i) => {
        arr[i * 3] = x + Math.sin(s * 30 + ph) * 0.25;
        arr[i * 3 + 1] = ((y - s * 45) % 9 + 9) % 9 + 0.05;
        arr[i * 3 + 2] = z + Math.cos(s * 24 + ph) * 0.25;
      });
      snowGeo.attributes.position.needsUpdate = true;
    }

    // ——— Герой ———
    let heroVisible = true;
    let folderHolder = 'rep';
    let holdBlend = 0;

    if (p < T.toUniversity[0]) {
      // 1. Грант: передача папки, рукопожатие, поворот
      setOutfit('casual');
      const ht = span(p, T.handover);
      const hs = span(p, T.handshake);
      const turn = smooth(span(p, T.turn));
      setRoot(hero, HERO_START, lerpAngle(HERO_FACING_REP, PATHS.toUniversity.heading(0), turn));
      const reach = smooth(clamp01((ht - 0.15) / 0.35)) * (1 - smooth(clamp01((ht - 0.8) / 0.2)) * 0.7);
      const shake = smooth(clamp01(hs * 3)) * smooth(clamp01((1 - hs) * 3));
      applyPose(hero, {
        armL: { x: -1.05 * reach - 0.05 },
        armR: { x: -1.1 * shake + Math.sin(hs * Math.PI * 8) * 0.12 * shake },
      });
      holdBlend = smooth(clamp01((ht - 0.45) / 0.3));
      folderHolder = holdBlend >= 1 ? 'hero' : 'transfer';
    } else if (p < T.seasons[0] - 0.005) {
      // 2. Идёт в университет
      setOutfit('casual');
      const { phase, stride } = walkAlong(hero, PATHS.toUniversity, span(p, T.toUniversity));
      applyPose(hero, { walk: phase, stride, armL: { x: -0.3 } });
      folderHolder = 'hero';
      heroVisible = span(p, T.toUniversity) < 0.985;
    } else if (p < T.exit[0]) {
      // 3. Годы учёбы — героя не видно
      heroVisible = false;
      folderHolder = 'none';
    } else if (p < T.cheer[0]) {
      // 4. Выходит выпускником
      setOutfit('gown');
      const { phase, stride } = walkAlong(hero, PATHS.exit, span(p, T.exit));
      applyPose(hero, { walk: phase, stride, armR: { x: -0.35 } });
      folderHolder = 'none';
    } else if (p < T.toOffice[0]) {
      // 4b. Радостный жест
      setOutfit('gown');
      const ct = span(p, T.cheer);
      const env = bell(ct);
      const arrive = PATHS.exit.heading(PATHS.exit.length - 0.01) ?? 0;
      const face = lerpAngle(arrive, FACING_VIEWER, smooth(clamp01(ct * 3)));
      const leave = PATHS.toOffice.heading(0);
      setRoot(hero, CHEER_POS, lerpAngle(face, leave, smooth(clamp01((ct - 0.75) / 0.25))));
      applyPose(hero, {
        armL: { x: -2.7 * env, z: 0.06 + 0.3 * env },
        armR: { x: -0.35 - 2.35 * env, z: -0.06 - 0.3 * env },
        bob: 0.16 * Math.max(0, Math.sin(ct * Math.PI * 4)) * env,
      });
      folderHolder = 'none';
    } else if (p < T.greet[0]) {
      // 5. Путь к офису; за деревом мантия сменяется деловой одеждой
      const { d, phase, stride } = walkAlong(hero, PATHS.toOffice, span(p, T.toOffice));
      const business = d >= SWAP_DISTANCE;
      setOutfit(business ? 'business' : 'gown');
      applyPose(hero, { walk: phase, stride, armR: business ? { x: Math.sin(phase) * 0.15 } : { x: -0.35 } });
      folderHolder = 'none';
    } else if (p < T.enterOffice[0]) {
      // 5b. Встреча с коллегой
      setOutfit('business');
      const gt = span(p, T.greet);
      const env = bell(clamp01(gt * 1.15));
      const arrive = PATHS.toOffice.heading(PATHS.toOffice.length - 0.01) ?? 0;
      const toColleague = headingTo(PATHS.enterOffice.at(0), COLLEAGUE_POS);
      setRoot(hero, PATHS.enterOffice.at(0), lerpAngle(arrive, toColleague, smooth(clamp01(gt * 3))));
      applyPose(hero, { armL: { x: -2.4 * env, z: 0.06 + Math.sin(gt * Math.PI * 7) * 0.25 * env } });
      folderHolder = 'none';
    } else {
      // 5c. Заходит в офис
      setOutfit('business');
      const et = span(p, T.enterOffice);
      const { phase, stride } = walkAlong(hero, PATHS.enterOffice, et);
      applyPose(hero, { walk: phase, stride, armR: { x: Math.sin(phase) * 0.15 } });
      heroVisible = et < 0.97;
      folderHolder = 'none';
    }
    hero.root.visible = heroVisible;

    // ——— Представитель фонда ———
    {
      const ht = span(p, T.handover);
      const hs = span(p, T.handshake);
      const ct = span(p, T.cheer);
      const offer = smooth(clamp01(ht / 0.35)) * (1 - smooth(clamp01((ht - 0.7) / 0.3)));
      const shake = smooth(clamp01(hs * 3)) * smooth(clamp01((1 - hs) * 3));
      const clap = p >= T.cheer[0] && p < T.toOffice[0] ? bell(ct) : 0;
      const clapBeat = Math.abs(Math.sin(ct * Math.PI * 9));
      const lookAtCheer = smooth(span(p, [T.exit[0] + 0.02, T.cheer[0]]));
      setRoot(rep, REP_POS, lerpAngle(REP_FACING_HERO, headingTo(REP_POS, CHEER_POS), lookAtCheer));
      applyPose(rep, {
        armR: {
          x: -1.0 * offer - 1.1 * shake + Math.sin(hs * Math.PI * 8) * 0.12 * shake - 1.1 * clap - 0.1,
          z: -0.06 - (0.32 + 0.18 * clapBeat) * clap,
        },
        armL: { x: -1.1 * clap, z: 0.06 + (0.32 + 0.18 * clapBeat) * clap },
      });
    }

    // ——— Коллега у офиса ———
    {
      const gt = span(p, T.greet);
      const env = bell(clamp01(gt * 1.15));
      const followT = span(p, [T.enterOffice[0] + 0.015, T.enterOffice[1]]);
      if (followT <= 0) {
        const heroPos = hero.root.position;
        const watch = smooth(span(p, [T.toOffice[0] + 0.08, T.greet[0]]));
        const toHero = Math.atan2(heroPos.x - COLLEAGUE_POS[0], heroPos.z - COLLEAGUE_POS[2]);
        setRoot(colleague, COLLEAGUE_POS, lerpAngle(-Math.PI * 0.75, toHero, watch));
        applyPose(colleague, { armR: { x: -2.5 * env, z: -0.06 - Math.sin(gt * Math.PI * 7) * 0.25 * env } });
        colleague.root.visible = true;
      } else {
        const { phase, stride } = walkAlong(colleague, PATHS.colleagueIn, followT);
        applyPose(colleague, { walk: phase, stride });
        colleague.root.visible = followT < 0.97;
      }
    }

    // ——— Фоновые студенты ———
    for (const w of walkers) {
      const len = Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1]);
      const x = p * w.speed + w.offset;
      const u = pingPong(x);
      const forward = (x - Math.floor(x)) < 0.5;
      setRoot(w.person, [lerp(w.from[0], w.to[0], u), 0, lerp(w.from[1], w.to[1], u)],
        Math.atan2((w.to[0] - w.from[0]) * (forward ? 1 : -1), (w.to[1] - w.from[1]) * (forward ? 1 : -1)));
      applyPose(w.person, { walk: walkPhase((x * 2 * len) / PERSON_SCALE), stride: 1 });
    }

    // ——— Папка с грантом ———
    scene.updateMatrixWorld(true);
    folder.visible = folderHolder !== 'none' && (folderHolder === 'rep' || folderHolder === 'transfer' || heroVisible);
    if (folder.visible) {
      rep.handR.getWorldPosition(v1);
      hero.handL.getWorldPosition(v2);
      const k = folderHolder === 'hero' ? 1 : holdBlend;
      folder.position.lerpVectors(v1, v2, k);
      folder.position.y -= 0.12 * PERSON_SCALE;
      folder.rotation.set(0, lerpAngle(rep.root.rotation.y, hero.root.rotation.y, k), 0);
    }

    placeCamera(p);
  }

  return {
    ready,
    render(p) {
      update(p);
      renderer.render(scene, camera);
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      fitCamera(width, height);
    },
    dispose() {
      renderer.dispose();
    },
  };
}
