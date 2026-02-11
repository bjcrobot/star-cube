import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/ShaderPass.js";
import { HorizontalBlurShader } from "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/shaders/VerticalBlurShader.js";
import { createSolvedCube } from "./cube-shared.js";

const Cube = window.Cube || (window.cubejs && window.cubejs.Cube);
if (!Cube) {
  throw new Error("Cubejs failed to load. Check the cubejs script tag.");
}

const bootStart = performance.now();
const debugCube = false;
const logCube = (...args) => {
  if (!debugCube) {
    return;
  }
  console.log("[cube]", ...args);
};
let bootLogged = false;

const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speedValue");
const hud = document.getElementById("hud");
const hudTitle = document.getElementById("hudTitle");
const sceneWrap = document.getElementById("sceneWrap");
const hudShowButton = document.getElementById("hudShow");
const hudHideButton = document.getElementById("hudHide");
const resetButton = document.getElementById("resetButton");
const aboutPanel = document.getElementById("aboutPanel");
const aboutToggle = document.getElementById("aboutToggle");
const cubeView = document.getElementById("cubeView");
const cubeStar = document.querySelector(".cube-star");
const storageKeys = {
  speed: "magic-cube.speed",
  sound: "magic-cube.sound",
  bgm: "magic-cube.bgm"
};
const hudFadeDelay = 5000;
const hudHideDelay = 10000;
let hudDimTimer = 0;
let hudHideTimer = 0;

const blurState = {
  current: 1,
  target: 2,
  lastSwitch: performance.now(),
  interval: 900
};
const saturationState = {
  min: 0.85,
  max: 1.2,
  cycleMs: 18000
};
let speedFactor = Number(speedInput.value);
speedValue.textContent = `${speedFactor.toFixed(1)}x`;
speedInput.addEventListener("input", event => {
  speedFactor = Number(event.target.value);
  speedValue.textContent = `${speedFactor.toFixed(1)}x`;
  saveSettings();
});

function updateSpeed(value) {
  speedFactor = Number(value);
  speedInput.value = speedFactor.toFixed(1);
  speedValue.textContent = `${speedFactor.toFixed(1)}x`;
  if (!isLoadingSettings) {
    saveSettings();
  }
}

function resetHudValues() {
  const defaultSpeed = Number(speedInput.defaultValue || speedInput.value || 1.0);
  updateSpeed(defaultSpeed);
  soundToggle.checked = soundToggle.defaultChecked;
  soundEnabled = soundToggle.checked;
  soundValue.textContent = soundEnabled ? "On" : "Off";
  bgmToggle.checked = true;
  bgmEnabled = true;
  bgmValue.textContent = bgmEnabled ? "On" : "Off";
  if (soundEnabled) {
    unlockAudio();
  }
  if (bgmEnabled) {
    unlockAudio();
    startBgm();
  } else {
    stopBgm();
  }
  saveSettings();
}

const soundToggle = document.getElementById("soundToggle");
const soundValue = document.getElementById("soundValue");
let soundEnabled = false;
soundValue.textContent = "Off";
soundToggle.addEventListener("change", event => {
  soundEnabled = event.target.checked;
  soundValue.textContent = soundEnabled ? "On" : "Off";
  if (soundEnabled) {
    hasUserGesture = true;
    unlockAudio();
  }
  saveSettings();
});

const bgmToggle = document.getElementById("bgmToggle");
const bgmValue = document.getElementById("bgmValue");
let bgmEnabled = false;
let bgmSound = null;
const bgmBaseVolume = 0.55;
const bgmFadeDurationMs = 1200;
const bgmFadeDelayMs = 5000;
let bgmFadeTimer = 0;
let bgmFadingOut = false;
bgmValue.textContent = "Off";

function ensureBgmSound() {
  if (bgmSound) {
    return bgmSound;
  }
  if (!window.Howl) {
    return null;
  }
  bgmSound = new window.Howl({
    src: ["assets/sounds/Ancient_memories.mp3"],
    loop: true,
    volume: bgmBaseVolume
  });
  return bgmSound;
}

function startBgm() {
  if (!bgmEnabled || !isViewActive) {
    return;
  }
  const sound = ensureBgmSound();
  if (!sound) {
    return;
  }
  if (sound.volume() !== bgmBaseVolume) {
    sound.volume(bgmBaseVolume);
  }
  if (!sound.playing()) {
    sound.play();
  }
}

function fadeOutBgm(durationMs = bgmFadeDurationMs, delayMs = 0) {
  if (!bgmSound) {
    logCube("fadeOutBgm skip: no sound");
    return;
  }
  if (delayMs > 0) {
    if (bgmFadeTimer) {
      logCube("fadeOutBgm skip: already scheduled");
      return;
    }
    logCube("fadeOutBgm scheduled", { delayMs, durationMs });
    bgmFadeTimer = window.setTimeout(() => {
      bgmFadeTimer = 0;
      fadeOutBgm(durationMs, 0);
    }, delayMs);
    return;
  }
  if (!bgmSound.playing()) {
    logCube("fadeOutBgm skip: not playing");
    return;
  }
  if (bgmFadingOut) {
    logCube("fadeOutBgm skip: already fading");
    return;
  }
  bgmFadingOut = true;
  const currentVolume = bgmSound.volume();
  logCube("fadeOutBgm start", { currentVolume, durationMs });
  bgmSound.fade(currentVolume, 0, durationMs);
  window.setTimeout(() => {
    if (bgmSound && bgmSound.playing()) {
      bgmSound.pause();
    }
    if (bgmSound) {
      bgmSound.volume(bgmBaseVolume);
    }
    bgmFadingOut = false;
    logCube("fadeOutBgm complete", { restoredVolume: bgmBaseVolume });
  }, durationMs + 30);
}

function stopBgm() {
  if (bgmSound && bgmSound.playing()) {
    bgmSound.pause();
  }
}

function setViewActive(active) {
  isViewActive = Boolean(active);
  if (isViewActive && cubeView) {
    cubeView.classList.remove("is-warping");
  }
}

function refreshSettings() {
  loadSettings();
  if (!bgmEnabled) {
    stopBgm();
    return;
  }
  if (hasUserGesture && isViewActive) {
    unlockAudio();
    startBgm();
  }
}

window.magicCubeAudio = {
  startBgm,
  stopBgm,
  fadeOutBgm,
  setViewActive,
  refreshSettings,
  grantUserGesture: () => {
    hasUserGesture = true;
    unlockAudio();
  }
};

bgmToggle.addEventListener("change", event => {
  bgmEnabled = event.target.checked;
  bgmValue.textContent = bgmEnabled ? "On" : "Off";
  if (bgmEnabled) {
    hasUserGesture = true;
    unlockAudio();
    startBgm();
  } else {
    stopBgm();
  }
  saveSettings();
});

let isLoadingSettings = false;

function loadSettings() {
  isLoadingSettings = true;
  const storedSpeed = Number(window.localStorage.getItem(storageKeys.speed));
  if (!Number.isNaN(storedSpeed)) {
    const min = Number(speedInput.min) || 0.2;
    const max = Number(speedInput.max) || 1.5;
    const clamped = Math.min(max, Math.max(min, storedSpeed));
    const defaultSpeed = Number(speedInput.defaultValue || 1.0);
    updateSpeed(clamped === min ? defaultSpeed : clamped);
  }
  const storedSound = window.localStorage.getItem(storageKeys.sound);
  if (storedSound !== null) {
    const enabled = storedSound === "true";
    soundToggle.checked = enabled;
    soundEnabled = enabled;
    soundValue.textContent = soundEnabled ? "On" : "Off";
  }
  const storedBgm = window.localStorage.getItem(storageKeys.bgm);
  if (storedBgm !== null) {
    const enabled = storedBgm === "true";
    bgmToggle.checked = enabled;
    bgmEnabled = enabled;
    bgmValue.textContent = bgmEnabled ? "On" : "Off";
  }
  isLoadingSettings = false;
}

function saveSettings() {
  window.localStorage.setItem(storageKeys.speed, String(speedFactor));
  window.localStorage.setItem(storageKeys.sound, soundEnabled ? "true" : "false");
  window.localStorage.setItem(storageKeys.bgm, bgmEnabled ? "true" : "false");
}

let zzfxX = window.zzfxX;
let audioUnlocked = false;
let hasUserGesture = false;
let isViewActive = true;
if (typeof window.zzfxV === "number") {
  window.zzfxV = 0.7;
}

function unlockAudio() {
  if (!hasUserGesture) {
    return;
  }
  if (audioUnlocked) {
    return;
  }
  if (!zzfxX && (window.AudioContext || window.webkitAudioContext)) {
    zzfxX = new (window.AudioContext || window.webkitAudioContext)();
    window.zzfxX = zzfxX;
  }
  if (!zzfxX) {
    return;
  }
  if (zzfxX.state === "running") {
    audioUnlocked = true;
    if (window.Howler && window.Howler.ctx && window.Howler.ctx.state === "suspended") {
      window.Howler.ctx.resume().catch(() => {});
    }
    if (bgmEnabled && isViewActive) {
      startBgm();
    }
    return;
  }
  zzfxX.resume()
    .then(() => {
      audioUnlocked = true;
      if (window.Howler && window.Howler.ctx && window.Howler.ctx.state === "suspended") {
        window.Howler.ctx.resume().catch(() => {});
      }
      if (bgmEnabled && isViewActive) {
        startBgm();
      }
    })
    .catch(() => {
      audioUnlocked = false;
    });
}

function playRotateSound() {
  const play = window.zzfx;
  if (!soundEnabled || !play || !isViewActive) {
    return;
  }
  if (!hasUserGesture) {
    return;
  }
  if (!zzfxX && (window.AudioContext || window.webkitAudioContext)) {
    zzfxX = new (window.AudioContext || window.webkitAudioContext)();
    window.zzfxX = zzfxX;
  }
  if (!audioUnlocked || (zzfxX && zzfxX.state !== "running")) {
    unlockAudio();
  }
  if (zzfxX && zzfxX.state === "running") {
    audioUnlocked = true;
    play(...[,,328,.01,.02,.09,,2.9,,168,,,,,,,,.56,.02]);
  }
}

function handleUserGesture() {
  hasUserGesture = true;
  unlockAudio();
}

window.addEventListener("pointerdown", handleUserGesture, { once: true });
window.addEventListener("keydown", handleUserGesture, { once: true });
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 6, 18);
const baseFogNear = scene.fog.near;
const baseFogFar = scene.fog.far;

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(6, 6, 8);
const baseCameraDir = camera.position.clone().normalize();
const baseCameraDistance = camera.position.length();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.setClearColor(0x000000, 0);
(sceneWrap || document.body).appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const saturationShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1 },
    lift: { value: 0.085 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float lift;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      float luma = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 gray = vec3(luma);
      vec3 color = mix(gray, texel.rgb, saturation);
      color += lift;
      gl_FragColor = vec4(color, texel.a);
    }
  `
};

const saturationPass = new ShaderPass(saturationShader);
composer.addPass(saturationPass);

const hBlurPass = new ShaderPass(HorizontalBlurShader);
const vBlurPass = new ShaderPass(VerticalBlurShader);
composer.addPass(hBlurPass);
composer.addPass(vBlurPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 16;
controls.autoRotate = true;
controls.autoRotateSpeed = (Math.random() < 0.5 ? -1 : 1) * 0.7;

let lastInteraction = performance.now();
const idleDelay = 5000;
let isSolving = false;
const idleRotation = {
  active: false,
  axis: new THREE.Vector3(0, 1, 0),
  speed: 0.15,
  lastTime: performance.now()
};

function scheduleHudFade() {
  if (!hud) {
    return;
  }
  window.clearTimeout(hudDimTimer);
  window.clearTimeout(hudHideTimer);
  hud.classList.remove("hud-dim", "hud-hidden");
  if (aboutPanel) {
    aboutPanel.classList.remove("about-dim", "about-hidden");
  }
  if (cubeStar) {
    cubeStar.classList.remove("star-dim", "star-hidden");
  }
  hudDimTimer = window.setTimeout(() => {
    hud.classList.add("hud-dim");
    if (aboutPanel) {
      aboutPanel.classList.add("about-dim");
    }
    if (cubeStar) {
      cubeStar.classList.add("star-dim");
    }
  }, hudFadeDelay);
  hudHideTimer = window.setTimeout(() => {
    hud.classList.add("hud-hidden");
    if (aboutPanel) {
      aboutPanel.classList.add("about-hidden");
    }
    if (cubeStar) {
      cubeStar.classList.add("star-hidden");
    }
  }, hudHideDelay);
}

function setHudCollapsed(collapsed) {
  if (!hud) {
    return;
  }
  hud.classList.toggle("hud-collapsed", collapsed);
}

if (hudShowButton) {
  hudShowButton.addEventListener("click", () => {
    setHudCollapsed(false);
    scheduleHudFade();
  });
}

if (hudHideButton) {
  hudHideButton.addEventListener("click", () => {
    setHudCollapsed(true);
    scheduleHudFade();
  });
}

if (hudTitle) {
  hudTitle.addEventListener("click", () => {
    if (!hud) {
      return;
    }
    const isCollapsed = hud.classList.contains("hud-collapsed");
    setHudCollapsed(!isCollapsed);
    scheduleHudFade();
  });
}

if (resetButton) {
  resetButton.addEventListener("click", () => {
    resetHudValues();
    scheduleHudFade();
  });
}

if (aboutToggle && aboutPanel) {
  aboutToggle.addEventListener("click", () => {
    if (!cubeView || !cubeView.classList.contains("is-active")) {
      return;
    }
    aboutPanel.classList.toggle("about-open");
  });
}

if (cubeStar) {
  cubeStar.addEventListener("click", () => {
    if (cubeView) {
      cubeView.classList.add("is-warping");
    }
    if (window.starCubeWarp && typeof window.starCubeWarp.startTransition === "function") {
      window.starCubeWarp.startTransition("intro");
    }
  });
}

window.addEventListener("keydown", event => {
  hasUserGesture = true;
  if (event.key === "ArrowDown") {
    setHudCollapsed(false);
    scheduleHudFade();
  }
  if (event.key === "ArrowUp") {
    setHudCollapsed(true);
    scheduleHudFade();
  }
  if (event.key === "ArrowLeft") {
    const step = Number(speedInput.step) || 0.1;
    const min = Number(speedInput.min) || 0.2;
    const next = Math.max(min, Number(speedInput.value) - step);
    updateSpeed(next);
  }
  if (event.key === "ArrowRight") {
    const step = Number(speedInput.step) || 0.1;
    const max = Number(speedInput.max) || 1.5;
    const next = Math.min(max, Number(speedInput.value) + step);
    updateSpeed(next);
  }
  if (event.key === "s" || event.key === "S") {
    soundToggle.checked = !soundToggle.checked;
    soundEnabled = soundToggle.checked;
    soundValue.textContent = soundEnabled ? "On" : "Off";
    if (soundEnabled) {
      unlockAudio();
    }
    saveSettings();
  }
  if (event.key === "m" || event.key === "M") {
    bgmToggle.checked = !bgmToggle.checked;
    bgmEnabled = bgmToggle.checked;
    bgmValue.textContent = bgmEnabled ? "On" : "Off";
    if (bgmEnabled) {
      unlockAudio();
      startBgm();
    } else {
      stopBgm();
    }
    saveSettings();
  }
  if (event.key === "r" || event.key === "R") {
    resetHudValues();
    scheduleHudFade();
  }
});

function markInteraction() {
  lastInteraction = performance.now();
  controls.autoRotate = false;
  idleRotation.active = false;
  scheduleHudFade();
}

window.addEventListener("pointerdown", markInteraction);
window.addEventListener("pointermove", markInteraction);
window.addEventListener("wheel", markInteraction, { passive: true });
window.addEventListener("keydown", markInteraction);
window.addEventListener("touchstart", markInteraction, { passive: true });

scheduleHudFade();
loadSettings();

const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0xe0f2ff, 0x1b2a41, 0.55);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
keyLight.position.set(6, 8, 6);
scene.add(keyLight);

const fillLight = new THREE.PointLight(0xfff1d6, 0.5, 20);
fillLight.position.set(-6, -4, 6);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x8cc8ff, 0.35);
rimLight.position.set(-6, 4, -6);
scene.add(rimLight);

const cubeGroup = new THREE.Group();
scene.add(cubeGroup);
cubeGroup.visible = true;
const floatSettings = {
  amplitude: 0.12,
  speed: 0.00075,
  offset: Math.random() * Math.PI * 2
};

const fractalState = {
  current: 0,
  fadeStart: 0,
  fadeDuration: 2200,
  fadingIn: false,
  fadingOut: false,
  cycleCounter: 0,
  nextCycle: 0,
  active: false
};

function getNextFractalCycleCount() {
  return 5 + Math.floor(Math.random() * 6);
}

fractalState.nextCycle = getNextFractalCycleCount();

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}


const cubeState = new Cube();
Cube.initSolver();
const cubieSize = 0.98;
const gap = 0.03;
const { cubies, fractalFace, fractalMaterial } = createSolvedCube({
  cubeGroup,
  cubieSize,
  gap,
  useFractalFace: true
});
const cubeMaterials = new Set();
const cubeMaterialDefaults = new Map();
cubies.forEach(cubie => {
  if (!cubie.isMesh) {
    return;
  }
  const mats = Array.isArray(cubie.material) ? cubie.material : [cubie.material];
  mats.forEach(material => {
    if (!material || cubeMaterials.has(material)) {
      return;
    }
    cubeMaterials.add(material);
    cubeMaterialDefaults.set(material, {
      opacity: typeof material.opacity === "number" ? material.opacity : 1,
      transparent: material.transparent === true
    });
  });
});

const mobileFitRatio = 0.85;
let cubeFitWidth = 0;

function updateCubeFitWidth() {
  const bounds = new THREE.Box3().setFromObject(cubeGroup);
  const sphere = new THREE.Sphere();
  bounds.getBoundingSphere(sphere);
  cubeFitWidth = sphere.radius * 2;
}

function updateCameraForViewport() {
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;
  const aspect = width / height;
  const isMobile = width <= 900;
  if (isMobile && cubeFitWidth > 0) {
    const fovRad = THREE.MathUtils.degToRad(camera.fov);
    const targetViewWidth = cubeFitWidth / mobileFitRatio;
    const distance = targetViewWidth / (2 * Math.tan(fovRad / 2) * aspect);
    camera.position.copy(baseCameraDir.clone().multiplyScalar(distance));
    controls.minDistance = distance * 0.7;
    controls.maxDistance = distance * 1.4;
    if (scene.fog) {
      const scale = distance / baseCameraDistance;
      scene.fog.near = baseFogNear * scale;
      scene.fog.far = baseFogFar * scale;
    }
  } else {
    camera.position.copy(baseCameraDir.clone().multiplyScalar(baseCameraDistance));
    controls.minDistance = 5;
    controls.maxDistance = 16;
    if (scene.fog) {
      scene.fog.near = baseFogNear;
      scene.fog.far = baseFogFar;
    }
  }
  camera.updateProjectionMatrix();
  controls.update();
}

updateCubeFitWidth();
updateCameraForViewport();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getLayerCubies(axis, layer) {
  return cubies.filter(cubie => Math.round(cubie.userData.coord[axis]) === layer);
}

function mapMove(move) {
  const base = move[0];
  const prime = move.endsWith("'");
  const axisMap = { U: "y", D: "y", R: "x", L: "x", F: "z", B: "z" };
  const layerMap = { U: 1, D: -1, R: 1, L: -1, F: 1, B: -1 };
  const clockwise = {
    U: -1,
    D: 1,
    R: -1,
    L: 1,
    F: -1,
    B: 1
  };
  const axis = axisMap[base];
  const layer = layerMap[base];
  const dir = prime ? -clockwise[base] : clockwise[base];
  return { axis, layer, dir };
}

function updateCubieCoords(cubie, axis, dir) {
  const coord = cubie.userData.coord;
  const x = coord.x;
  const y = coord.y;
  const z = coord.z;

  if (axis === "x") {
    coord.y = dir === 1 ? -z : z;
    coord.z = dir === 1 ? y : -y;
  } else if (axis === "y") {
    coord.x = dir === 1 ? z : -z;
    coord.z = dir === 1 ? -x : x;
  } else if (axis === "z") {
    coord.x = dir === 1 ? -y : y;
    coord.y = dir === 1 ? x : -x;
  }

  coord.x = Math.round(coord.x);
  coord.y = Math.round(coord.y);
  coord.z = Math.round(coord.z);
}

function animateMove(move, duration, playSound = true) {
  const { axis, layer, dir } = mapMove(move);
  const layerCubies = getLayerCubies(axis, layer);
  const pivot = new THREE.Group();
  cubeGroup.add(pivot);
  layerCubies.forEach(cubie => pivot.attach(cubie));

  const start = performance.now();
  const targetRotation = (Math.PI / 2) * dir;
  if (playSound) {
    playRotateSound();
  }

  return new Promise(resolve => {
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      pivot.rotation[axis] = targetRotation * t;
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }

      pivot.updateMatrixWorld();
      layerCubies.forEach(cubie => {
        cubeGroup.attach(cubie);
        updateCubieCoords(cubie, axis, dir);
        cubie.position.set(
          cubie.userData.coord.x * (1 + gap),
          cubie.userData.coord.y * (1 + gap),
          cubie.userData.coord.z * (1 + gap)
        );
        const step = Math.PI / 2;
        cubie.rotation.x = Math.round(cubie.rotation.x / step) * step;
        cubie.rotation.y = Math.round(cubie.rotation.y / step) * step;
        cubie.rotation.z = Math.round(cubie.rotation.z / step) * step;
      });
      cubeGroup.remove(pivot);
      resolve();
    }
    requestAnimationFrame(step);
  });
}

async function playMoves(moves, duration) {
  for (const move of moves) {
    const isDouble = move.endsWith("2");
    const baseMove = isDouble ? move[0] : move;
    cubeState.move(move);
    const turns = isDouble ? 2 : 1;
    for (let i = 0; i < turns; i += 1) {
      await animateMove(baseMove, duration, i === 0);
    }
  }
}

function generateScramble(count) {
  const faces = ["U", "D", "L", "R", "F", "B"];
  const suffixes = ["", "'", "2"];
  const scramble = [];
  let lastFace = "";
  for (let i = 0; i < count; i += 1) {
    let face = faces[Math.floor(Math.random() * faces.length)];
    while (face === lastFace) {
      face = faces[Math.floor(Math.random() * faces.length)];
    }
    lastFace = face;
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    scramble.push(face + suffix);
  }
  return scramble;
}

async function runCycle() {
  while (true) {
    await sleep(10000);
    fractalState.cycleCounter += 1;
    const triggerFractal = fractalState.cycleCounter >= fractalState.nextCycle;
    if (triggerFractal) {
      fractalState.cycleCounter = 0;
      fractalState.nextCycle = getNextFractalCycleCount();
      fractalState.active = true;
      fractalState.fadingIn = true;
      fractalState.fadingOut = false;
      fractalState.fadeStart = performance.now();
    }
    const scramble = generateScramble(20);
    await playMoves(scramble, 380 / speedFactor);
    await sleep(5000);
    isSolving = true;
    controls.autoRotate = false;
    const solution = cubeState.solve().trim();
    const solutionMoves = solution ? solution.split(" ") : [];
    await playMoves(solutionMoves, 320 / speedFactor);
    if (fractalState.active) {
      fractalState.fadingOut = true;
      fractalState.fadingIn = false;
      fractalState.fadeStart = performance.now();
      fractalState.active = false;
    }
    isSolving = false;
    lastInteraction = performance.now();
  }
}

runCycle();

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  updateCameraForViewport();
}
window.addEventListener("resize", onResize);

function updateBlur(now) {
  if (now - blurState.lastSwitch > blurState.interval) {
    const chance = Math.random();
    const baseTarget = chance < 0.12 ? 0 : 0.4 + Math.random() * 0.7;
    blurState.target = Math.round(baseTarget * 2) / 2;
    blurState.interval = 700 + Math.random() * 700;
    blurState.lastSwitch = now;
  }
  blurState.current += (blurState.target - blurState.current) * 0.08;
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;
  hBlurPass.uniforms.h.value = blurState.current / width;
  vBlurPass.uniforms.v.value = blurState.current / height;
}

function updateSaturation(now) {
  const phase = (now / saturationState.cycleMs) * Math.PI * 2;
  const mid = (saturationState.min + saturationState.max) * 0.5;
  const amp = (saturationState.max - saturationState.min) * 0.5;
  saturationPass.uniforms.saturation.value = mid + amp * Math.sin(phase);
}

function render() {
  const now = performance.now();
  if (!bootLogged) {
    if (debugCube) {
      console.log(`Boot time: ${(now - bootStart).toFixed(1)}ms`);
    }
    bootLogged = true;
  }
  cubeGroup.position.y = Math.sin(now * floatSettings.speed + floatSettings.offset) * floatSettings.amplitude;
  const fractalVisible = fractalState.fadingIn || fractalState.fadingOut || fractalState.current > 0.01;
  if (fractalState.fadingIn) {
    const t = clamp01((now - fractalState.fadeStart) / fractalState.fadeDuration);
    fractalState.current = smoothStep(t);
    if (t >= 1) {
      fractalState.fadingIn = false;
    }
  } else if (fractalState.fadingOut) {
    const t = clamp01((now - fractalState.fadeStart) / fractalState.fadeDuration);
    fractalState.current = 1 - smoothStep(t);
    if (t >= 1) {
      fractalState.fadingOut = false;
    }
  }
  if (fractalVisible) {
    fractalFace.update(now);
  }
  if (fractalMaterial.userData.fractalUniforms) {
    fractalMaterial.userData.fractalUniforms.fractalMix.value = fractalState.current;
  }
  updateBlur(now);
  updateSaturation(now);
  if (!isSolving && !controls.autoRotate && now - lastInteraction > idleDelay) {
    controls.autoRotate = true;
    idleRotation.active = true;
    idleRotation.lastTime = now;
    const axisOptions = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1)
    ];
    idleRotation.axis = axisOptions[Math.floor(Math.random() * axisOptions.length)];
    idleRotation.speed = (Math.random() < 0.5 ? -1 : 1) * 0.15;
  }
  if (idleRotation.active && controls.autoRotate && !isSolving) {
    const delta = (now - idleRotation.lastTime) / 1000;
    idleRotation.lastTime = now;
    cubeGroup.rotateOnAxis(idleRotation.axis, idleRotation.speed * delta);
  }
  controls.update();
  composer.render();
  requestAnimationFrame(render);
}
render();
