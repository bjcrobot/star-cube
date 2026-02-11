import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/controls/OrbitControls.js";
import { createSolvedCube } from "./cube-shared.js";

// DOM refs
const mount = document.getElementById("neonRing");
const warpLayer = document.getElementById("warpLayer");
const title = document.getElementById("warpTitle");
const titleWrap = document.getElementById("warpTitleWrap");
const titleSubtitle = document.getElementById("warpSubtitle");
const introView = document.getElementById("introView");
const cubeView = document.getElementById("cubeView");
const introCubeLabel = document.getElementById("introCubeLabel");
const cubeIntroTag = document.getElementById("cubeIntroTag");
const bgmPanel = document.getElementById("bgmPanel");
const introBgmToggle = document.getElementById("introBgmToggle");
const introBgmValue = document.getElementById("introBgmValue");
const bgmHint = document.getElementById("bgmHint");
const aboutPanel = document.getElementById("aboutPanel");
const aboutToggle = document.getElementById("aboutToggle");
let introControls = null;

const debugIntro = false;
const logIntro = (...args) => {
  if (!debugIntro) {
    return;
  }
  console.log("[intro]", ...args);
};

logIntro("refs", {
  introView: Boolean(introView),
  aboutPanel: Boolean(aboutPanel),
  aboutToggle: Boolean(aboutToggle)
});

if (debugIntro) {
  logIntro("doc listeners ready");
  document.addEventListener("pointerdown", event => {
    const top = document.elementFromPoint(event.clientX, event.clientY);
    logIntro("doc pointerdown", {
      targetId: event.target && "id" in event.target ? event.target.id : null,
      targetClass: event.target && "className" in event.target ? event.target.className : null,
      topId: top && "id" in top ? top.id : null,
      topClass: top && "className" in top ? top.className : null
    });
  }, true);
}

// Audio state
const storageKeys = {
  bgm: "magic-cube.bgm"
};

let bgmEnabled = false;
let bgmSound = null;
const bgmBaseVolume = 0.55;
const bgmFadeInDurationMs = 1200;
let hasUserGesture = false;
let bgmStartTimer = 0;
const introFadeDelay = 5000;
const introHideDelay = 10000;
let introDimTimer = 0;
let introHideTimer = 0;
let warpReturnPending = false;

function ensureBgmSound() {
  if (bgmSound) {
    return bgmSound;
  }
  if (!window.Howl) {
    return null;
  }
  bgmSound = new window.Howl({
    src: ["assets/sounds/galaxy_prologue1.mp3"],
    loop: true,
    volume: bgmBaseVolume
  });
  return bgmSound;
}

function fadeInBgm(durationMs = bgmFadeInDurationMs) {
  if (!bgmSound) {
    return;
  }
  const currentVolume = bgmSound.volume();
  if (currentVolume >= bgmBaseVolume) {
    return;
  }
  bgmSound.fade(currentVolume, bgmBaseVolume, durationMs);
}

function startBgm() {
  if (!bgmEnabled) {
    return;
  }
  const sound = ensureBgmSound();
  if (!sound) {
    return;
  }
  if (!sound.playing()) {
    sound.volume(0);
    sound.play();
    sound.once("play", () => {
      fadeInBgm();
    });
    return;
  }
  fadeInBgm();
}

function scheduleIntroBgmStart() {
  window.clearTimeout(bgmStartTimer);
  if (!bgmEnabled || !hasUserGesture) {
    return;
  }
  if (introView && !introView.classList.contains("is-active")) {
    return;
  }
  bgmStartTimer = window.setTimeout(() => {
    startBgm();
  }, 2000);
}

function stopBgm() {
  window.clearTimeout(bgmStartTimer);
  if (bgmSound && bgmSound.playing()) {
    bgmSound.pause();
  }
}

function restartBgm() {
  if (!bgmSound) {
    return;
  }
  if (typeof bgmSound.seek === "function") {
    bgmSound.seek(0);
  }
  if (bgmSound.playing()) {
    bgmSound.pause();
  }
  scheduleIntroBgmStart();
}

function unlockAudio() {
  if (!hasUserGesture) {
    return;
  }
  if (window.Howler && window.Howler.ctx && window.Howler.ctx.state === "suspended") {
    return window.Howler.ctx.resume().catch(() => {});
  }
}

function handleUserGesture() {
  if (hasUserGesture) {
    return;
  }
  hasUserGesture = true;
  unlockAudio();
  if (bgmEnabled) {
    scheduleIntroBgmStart();
  }
  if (bgmHint) {
    bgmHint.classList.remove("is-visible");
  }
}

function showBgmHint() {
  if (!bgmHint) {
    return;
  }
  bgmHint.classList.add("is-visible");
}

function scheduleIntroPanelFade() {
  window.clearTimeout(introDimTimer);
  window.clearTimeout(introHideTimer);
  if (bgmPanel) {
    bgmPanel.classList.remove("panel-dim", "panel-hidden");
  }
  if (aboutPanel) {
    // Preserve about-open state when resetting fade timers
    const wasOpen = aboutPanel.classList.contains("about-open");
    logIntro("scheduleIntroPanelFade: before remove, wasOpen=", wasOpen, "classes=", aboutPanel.className);
    aboutPanel.classList.remove("about-dim", "about-hidden");
    logIntro("scheduleIntroPanelFade: after remove, classes=", aboutPanel.className);
    if (wasOpen) {
      aboutPanel.classList.add("about-open");
      logIntro("scheduleIntroPanelFade: restored about-open, classes=", aboutPanel.className);
    }
  }
  if (aboutPanel) {
    logIntro("panel reset", aboutPanel.className);
  }
  introDimTimer = window.setTimeout(() => {
    if (bgmPanel) {
      bgmPanel.classList.add("panel-dim");
    }
    if (aboutPanel) {
      aboutPanel.classList.add("about-dim");
    }
  }, introFadeDelay);
  introHideTimer = window.setTimeout(() => {
    if (bgmPanel) {
      bgmPanel.classList.remove("panel-dim");
      bgmPanel.classList.add("panel-hidden");
    }
    if (aboutPanel) {
      aboutPanel.classList.add("about-hidden");
    }
  }, introHideDelay);
}

function loadSettings() {
  const storedBgm = window.localStorage.getItem(storageKeys.bgm);
  if (storedBgm === null) {
    bgmEnabled = true;
    saveSettings();
  } else {
    bgmEnabled = storedBgm === "true";
  }
  if (introBgmToggle) {
    introBgmToggle.checked = bgmEnabled;
  }
  if (introBgmValue) {
    introBgmValue.textContent = bgmEnabled ? "On" : "Off";
  }
}

function saveSettings() {
  window.localStorage.setItem(storageKeys.bgm, bgmEnabled ? "true" : "false");
}

// Lazy script loading
const scriptCache = new Map();
let cubeLoaded = false;

function loadScriptOnce(src) {
  if (scriptCache.has(src)) {
    return scriptCache.get(src);
  }
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
  scriptCache.set(src, promise);
  return promise;
}

async function ensureCubeLoaded() {
  if (cubeLoaded) {
    return;
  }
  await loadScriptOnce("assets/scripts/ufo.js");
  await import("./magic-cube.js");
  cubeLoaded = true;
}

// View routing
function setStarfieldTransparent(isTransparent) {
  if (isTransparent) {
    document.body.dataset.starfield = "transparent";
  } else {
    delete document.body.dataset.starfield;
  }
  if (typeof window.setStarfieldTransparency === "function") {
    window.setStarfieldTransparency(isTransparent);
  }
}

function setView(viewName) {
  if (introView) {
    introView.classList.toggle("is-active", viewName === "intro");
  }
  if (cubeView) {
    cubeView.classList.toggle("is-active", viewName === "cube");
  }
  if (introControls) {
    introControls.enabled = viewName === "intro";
  }
}

function getRouteFromHash() {
  return window.location.hash === "#magic" ? "cube" : "intro";
}

function navigateTo(viewName) {
  const nextHash = viewName === "cube" ? "#magic" : "";
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
    return;
  }
  void applyRoute(getRouteFromHash());
}

function finalizeIntroReturn() {
  setView("intro");
  if (cubeView) {
    cubeView.classList.remove("is-active");
    cubeView.classList.remove("is-warping");
  }
  if (introView) {
    introView.classList.remove("warp-only");
  }
  if (aboutPanel) {
    aboutPanel.classList.remove("about-hidden", "about-dim");
    // Force opacity reset to skip CSS transition
    aboutPanel.style.opacity = "";
  }
  if (bgmPanel) {
    bgmPanel.style.opacity = "";
  }
  setStarfieldTransparent(false);
  resetIntroState();
  loadSettings();
  scheduleIntroPanelFade();
  if (window.magicCubeAudio && typeof window.magicCubeAudio.setViewActive === "function") {
    window.magicCubeAudio.setViewActive(false);
  }
  if (!warpReturnPending) {
    if (window.magicCubeAudio && typeof window.magicCubeAudio.fadeOutBgm === "function") {
      window.magicCubeAudio.fadeOutBgm();
    } else if (window.magicCubeAudio && typeof window.magicCubeAudio.stopBgm === "function") {
      window.magicCubeAudio.stopBgm();
    }
  }
  warpReturnPending = false;
  unlockAudio();
  if (bgmEnabled) {
    scheduleIntroBgmStart();
  }
  if (introView || cubeView) {
    logIntro("finalizeIntroReturn", {
      introView: introView ? introView.className : null,
      cubeView: cubeView ? cubeView.className : null
    });
  }
  if (aboutPanel) {
    const panelStyles = window.getComputedStyle(aboutPanel);
    logIntro("aboutPanel style", {
      display: panelStyles.display,
      visibility: panelStyles.visibility,
      opacity: panelStyles.opacity,
      pointerEvents: panelStyles.pointerEvents,
      zIndex: panelStyles.zIndex
    });
  }
  if (aboutToggle) {
    const toggleStyles = window.getComputedStyle(aboutToggle);
    const rect = aboutToggle.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    logIntro("aboutToggle style", {
      display: toggleStyles.display,
      visibility: toggleStyles.visibility,
      opacity: toggleStyles.opacity,
      pointerEvents: toggleStyles.pointerEvents,
      zIndex: toggleStyles.zIndex,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      hitId: hit && "id" in hit ? hit.id : null,
      hitClass: hit && "className" in hit ? hit.className : null
    });
  }
}

async function applyRoute(route) {
  logIntro("applyRoute", route, "hash=", window.location.hash);
  if (route === "cube") {
    setView("cube");
    window.clearTimeout(bgmStartTimer);
    stopBgm();
    setStarfieldTransparent(true);
    await ensureCubeLoaded();
    resetIntroState();
    if (window.magicCubeAudio && typeof window.magicCubeAudio.setViewActive === "function") {
      window.magicCubeAudio.setViewActive(true);
    }
    if (hasUserGesture && window.magicCubeAudio && typeof window.magicCubeAudio.grantUserGesture === "function") {
      window.magicCubeAudio.grantUserGesture();
    }
    if (window.magicCubeAudio && typeof window.magicCubeAudio.refreshSettings === "function") {
      window.magicCubeAudio.refreshSettings();
    }
    if (cubeIntroTag) {
      cubeIntroTag.classList.remove("is-active");
      void cubeIntroTag.offsetWidth;
      cubeIntroTag.classList.add("is-active");
    }
    return;
  }
  finalizeIntroReturn();
  if (aboutPanel) {
    logIntro("aboutPanel classes", aboutPanel.className);
  }
}

// UI events
if (introBgmToggle) {
  introBgmToggle.addEventListener("change", event => {
    bgmEnabled = event.target.checked;
    if (introBgmValue) {
      introBgmValue.textContent = bgmEnabled ? "On" : "Off";
    }
    handleUserGesture();
    if (bgmEnabled) {
      scheduleIntroBgmStart();
    } else {
      stopBgm();
    }
    saveSettings();
  });
}


if (aboutToggle && aboutPanel) {
  aboutToggle.addEventListener("click", event => {
    event.stopPropagation(); // Stop here to prevent OrbitControls
    logIntro("aboutToggle direct click fired");
    aboutPanel.classList.toggle("about-open");
    const isOpen = aboutPanel.classList.contains("about-open");
    logIntro("aboutToggle click", "open=", isOpen);
    
    // Debug: Check computed styles when opening
    if (isOpen) {
      const panelStyles = window.getComputedStyle(aboutPanel);
      const content = aboutPanel.querySelector(".about-content");
      const contentStyles = content ? window.getComputedStyle(content) : null;
      logIntro("aboutPanel open state:", {
        panelOpacity: panelStyles.opacity,
        panelPointerEvents: panelStyles.pointerEvents,
        panelZIndex: panelStyles.zIndex,
        contentMaxHeight: contentStyles ? contentStyles.maxHeight : "N/A",
        contentOpacity: contentStyles ? contentStyles.opacity : "N/A",
        contentTransform: contentStyles ? contentStyles.transform : "N/A"
      });
    }
    
    // DO NOT call scheduleIntroPanelFade() here - let pointermove handle it
  });
  logIntro("aboutToggle listener ready");
}

// Block OrbitControls from aboutPanel area when not clicking buttons
if (aboutPanel) {
  aboutPanel.addEventListener("pointerdown", event => {
    // Only stop if NOT clicking on interactive elements
    if (!event.target.closest("button, a, input, label")) {
      event.stopPropagation();
      logIntro("aboutPanel pointerdown blocked (non-interactive area)");
    }
  });
}

if (debugIntro) {
  document.addEventListener("click", event => {
    const top = document.elementFromPoint(event.clientX, event.clientY);
    logIntro("doc click", {
      targetId: event.target && "id" in event.target ? event.target.id : null,
      targetClass: event.target && "className" in event.target ? event.target.className : null,
      topId: top && "id" in top ? top.id : null,
      topClass: top && "className" in top ? top.className : null
    });
  }, true);
}

window.addEventListener("pointerdown", handleUserGesture, { once: true });
window.addEventListener("keydown", handleUserGesture, { once: true });

window.addEventListener("keydown", event => {
  if (!aboutPanel || !aboutToggle) {
    return;
  }
  if (event.key === "m" || event.key === "M") {
    if (!introBgmToggle) {
      return;
    }
    introBgmToggle.checked = !introBgmToggle.checked;
    bgmEnabled = introBgmToggle.checked;
    if (introBgmValue) {
      introBgmValue.textContent = bgmEnabled ? "On" : "Off";
    }
    handleUserGesture();
    if (bgmEnabled) {
      scheduleIntroBgmStart();
    } else {
      stopBgm();
    }
    saveSettings();
    return;
  }
  if (event.key !== "a" && event.key !== "A") {
    return;
  }
  if (introView && !introView.classList.contains("is-active")) {
    return;
  }
  aboutPanel.classList.toggle("about-open");
  logIntro("aboutToggle key", "open=", aboutPanel.classList.contains("about-open"));
  // DO NOT call scheduleIntroPanelFade() here - let other events handle it
});

window.addEventListener("pointermove", event => {
  // Don't reset fade timers when moving over UI panels
  if (event.target && event.target.closest && event.target.closest("#aboutPanel, #bgmPanel")) {
    return;
  }
  scheduleIntroPanelFade();
});
window.addEventListener("pointerdown", event => {
  // Don't reset fade timers when clicking UI panels  
  if (event.target && event.target.closest && event.target.closest("#aboutPanel, #bgmPanel")) {
    return;
  }
  scheduleIntroPanelFade();
});
window.addEventListener("keydown", event => {
  // Don't reset fade timers for the 'A' key
  if (event.key === "a" || event.key === "A") {
    return;
  }
  scheduleIntroPanelFade();
});

window.addEventListener("hashchange", () => {
  void applyRoute(getRouteFromHash());
});

// Page visibility
function handleVisibilityChange() {
  if (document.hidden) {
    stopBgm();
    if (window.magicCubeAudio && typeof window.magicCubeAudio.setViewActive === "function") {
      window.magicCubeAudio.setViewActive(false);
    }
    if (window.magicCubeAudio && typeof window.magicCubeAudio.fadeOutBgm === "function") {
      window.magicCubeAudio.fadeOutBgm();
    } else if (window.magicCubeAudio && typeof window.magicCubeAudio.stopBgm === "function") {
      window.magicCubeAudio.stopBgm();
    }
    return;
  }
  const route = getRouteFromHash();
  if (route === "cube") {
    if (window.magicCubeAudio && typeof window.magicCubeAudio.setViewActive === "function") {
      window.magicCubeAudio.setViewActive(true);
    }
    if (hasUserGesture && window.magicCubeAudio && typeof window.magicCubeAudio.grantUserGesture === "function") {
      window.magicCubeAudio.grantUserGesture();
    }
    return;
  }
  // TODO: BGM does not resume after returning from hidden state.
  loadSettings();
  unlockAudio();
}

document.addEventListener("visibilitychange", handleVisibilityChange);

// Intro scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 1.4, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.domElement.style.position = "absolute";
renderer.domElement.style.inset = "0";
renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";
renderer.domElement.style.pointerEvents = "none";
mount.appendChild(renderer.domElement);

// Warp layer setup
const warpScene = new THREE.Scene();
const warpCamera = new THREE.PerspectiveCamera(60, 1, 1, 500);
warpCamera.position.z = 200;

const warpRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
warpRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
warpRenderer.setClearColor(0x000000, 0);
warpRenderer.domElement.style.position = "absolute";
warpRenderer.domElement.style.inset = "0";
warpRenderer.domElement.style.width = "100%";
warpRenderer.domElement.style.height = "100%";
warpRenderer.domElement.style.pointerEvents = "none";
warpLayer.appendChild(warpRenderer.domElement);

// Ring + cube setup
const ringRadius = 5.76;
const ringTube = 0.02;
const ringArc = Math.PI * 1.75;
const baseRingWidth = 1200;
const ringTargetRatio = 0.7;
const ringGeometry = new THREE.TorusGeometry(ringRadius, ringTube, 32, 180, ringArc);
const ringMaterial = new THREE.MeshStandardMaterial({
  color: 0x0e1a2f,
  emissive: 0x000000,
  emissiveIntensity: 0,
  metalness: 0.05,
  roughness: 0.15
});
const ring = new THREE.Mesh(ringGeometry, ringMaterial);

const ringGlowGeometry = new THREE.TorusGeometry(ringRadius, ringTube * 2.1, 24, 120, ringArc);
const ringGlowMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.25,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const ringGlow = new THREE.Mesh(ringGlowGeometry, ringGlowMaterial);

// Warp state
const lineCount = 1800;
const warpGeometry = new THREE.BufferGeometry();
const warpPositions = new Float32Array(6 * lineCount);
const warpVelocities = new Float32Array(2 * lineCount);
warpGeometry.setAttribute("position", new THREE.BufferAttribute(warpPositions, 3));
warpGeometry.setAttribute("velocity", new THREE.BufferAttribute(warpVelocities, 1));

function resetWarpLine(index) {
  const x = Math.random() * 400 - 200;
  const y = Math.random() * 200 - 100;
  const z = Math.random() * 200 - 100;
  const start = 6 * index;
  warpPositions[start] = x;
  warpPositions[start + 1] = y;
  warpPositions[start + 2] = z + 1;
  warpPositions[start + 3] = x;
  warpPositions[start + 4] = y;
  warpPositions[start + 5] = z;
  warpVelocities[2 * index] = 0;
  warpVelocities[2 * index + 1] = 0;
}

for (let i = 0; i < lineCount; i += 1) {
  resetWarpLine(i);
}

const warpMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.85
});
const warpLines = new THREE.LineSegments(warpGeometry, warpMaterial);
warpScene.add(warpLines);

let warpOpacityTarget = 0;
let warpOpacityCurrent = 0;

const warpState = {
  active: false,
  pending: false,
  delayMs: 3000,
  warpDurationMs: 2600,
  timer: 0,
  navTimer: 0
};

const warpSpeed = {
  baseStart: 0.004,
  baseEnd: 0.006,
  warpStart: 0.03,
  warpEnd: 0.1
};

function resetIntroState() {
  warpState.active = false;
  warpState.pending = false;
  cubeSpinBoost = false;
  window.clearTimeout(warpState.timer);
  window.clearTimeout(warpState.navTimer);
  warpOpacityTarget = 0;
  warpOpacityCurrent = 0;
  warpMaterial.opacity = 0;
  for (let i = 0; i < lineCount; i += 1) {
    resetWarpLine(i);
  }
  if (titleWrap) {
    titleWrap.style.transform = "translate(-50%, -50%) scale(1)";
    titleWrap.style.opacity = "1";
  }
  ringGroup.scale.setScalar(ringBaseScale);
}

// Cube glow
const { cubeGroup, cubies, cubieSize, gap } = createSolvedCube({ useFractalFace: false });
cubeGroup.scale.setScalar(0.38);

const glowSize = (1 + gap) * 2 + cubieSize;
const cubeGlowGeometry = new THREE.BoxGeometry(glowSize, glowSize, glowSize);
const cubeGlowMaterial = new THREE.MeshBasicMaterial({
  color: 0x7fb6ff,
  transparent: true,
  opacity: 0.28,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const cubeGlow = new THREE.Mesh(cubeGlowGeometry, cubeGlowMaterial);
cubeGlow.visible = true;
cubeGlow.material.opacity = 0;
cubeGroup.add(cubeGlow);

// Pointer interactions
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let cubeHover = false;
let glowTarget = 0;
let glowCurrent = 0;
let cubeSpinBoost = false;
const cubeSpinBase = { x: 0.002, y: 0.005 };
let ringBaseScale = 1;
const cubeLabelWorld = new THREE.Vector3();
const cubeLabelScreen = new THREE.Vector3();
const cubeLabelOffsetPx = 86;

function setCubeGlow(active) {
  glowTarget = active ? 0.28 : 0;
}

const ringGroup = new THREE.Group();
ringGroup.add(ringGlow, ring, cubeGroup);
ringGroup.rotation.x = -1.396;
ringGroup.rotation.z = 0;
ringGroup.position.y = 1.2;

const gapAngle = ringArc + (Math.PI * 2 - ringArc) * 0.5;
cubeGroup.position.set(
  Math.cos(gapAngle) * (ringRadius + ringTube * 0.6),
  Math.sin(gapAngle) * (ringRadius + ringTube * 0.6),
  0
);
scene.add(ringGroup);

// Controls - attach to mount (#neonRing) instead of canvas
introControls = new OrbitControls(camera, mount);
introControls.enableDamping = true;
introControls.dampingFactor = 0.08;
introControls.enablePan = false;
introControls.minDistance = 5;
introControls.maxDistance = 18;
introControls.target.set(0, ringGroup.position.y, 0);
introControls.update();

logIntro("OrbitControls initialized on mount element");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

if (titleSubtitle) {
  window.setTimeout(() => {
    titleSubtitle.classList.add("is-fading");
  }, 3500);
}

scheduleIntroPanelFade();

loadSettings();
void applyRoute(getRouteFromHash());
showBgmHint();

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const glowLight = new THREE.PointLight(0xfff0b8, 1.1, 30);
glowLight.position.set(2.5, 2.5, 3);
scene.add(glowLight);
const fillLight = new THREE.PointLight(0xfff7cf, 0.6, 25);
fillLight.position.set(-3, -1.5, 4);
scene.add(fillLight);

// Resize + render loop
function resize() {
  const viewport = window.visualViewport;
  const width = viewport ? viewport.width : window.innerWidth;
  const height = viewport ? viewport.height : window.innerHeight;
  if (width === 0 || height === 0) return;
  if (viewport) {
    mount.style.transform = `translate(${viewport.offsetLeft}px, ${viewport.offsetTop}px)`;
    mount.style.width = `${width}px`;
    mount.style.height = `${height}px`;
    warpLayer.style.transform = `translate(${viewport.offsetLeft}px, ${viewport.offsetTop}px)`;
    warpLayer.style.width = `${width}px`;
    warpLayer.style.height = `${height}px`;
  } else {
    mount.style.transform = "translate(0px, 0px)";
    warpLayer.style.transform = "translate(0px, 0px)";
  }
  warpRenderer.setSize(width, height, true);
  warpCamera.aspect = width / height;
  warpCamera.updateProjectionMatrix();
  renderer.setSize(width, height, true);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  const baseSize = Math.min(width, height);
  const ringScale = (baseSize * ringTargetRatio) / baseRingWidth;
  ringBaseScale = Math.min(ringScale, 1);
  ringGroup.scale.setScalar(ringBaseScale);
}

function updateWarp() {
  if (!warpState.active && !warpState.pending) {
    warpOpacityTarget = 0;
  }
  for (let i = 0; i < lineCount; i += 1) {
    if (!warpState.active && !warpState.pending) {
      continue;
    }
    const speedStart = warpState.active ? warpSpeed.warpStart : warpSpeed.baseStart;
    const speedEnd = warpState.active ? warpSpeed.warpEnd : warpSpeed.baseEnd;
    warpVelocities[2 * i] += speedStart;
    warpVelocities[2 * i + 1] += speedEnd;
    const start = 6 * i;
    warpPositions[start + 2] += warpVelocities[2 * i];
    warpPositions[start + 5] += warpVelocities[2 * i + 1];
    if (warpPositions[start + 2] > 200) {
      resetWarpLine(i);
    }
  }
  if (warpState.active || warpState.pending) {
    warpGeometry.attributes.position.needsUpdate = true;
  }
  warpOpacityCurrent += (warpOpacityTarget - warpOpacityCurrent) * 0.06;
  warpMaterial.opacity = warpOpacityCurrent;
  warpRenderer.render(warpScene, warpCamera);
}

function updateIntroCubeLabel() {
  if (!introCubeLabel || !introView) {
    return;
  }
  const isActive = introView.classList.contains("is-active")
    && !introView.classList.contains("warp-only");
  if (!isActive) {
    introCubeLabel.classList.remove("is-visible");
    return;
  }
  const rect = renderer.domElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return;
  }
  cubeGroup.getWorldPosition(cubeLabelWorld);
  cubeLabelScreen.copy(cubeLabelWorld).project(camera);
  const x = (cubeLabelScreen.x * 0.5 + 0.5) * rect.width + rect.left;
  const y = (-cubeLabelScreen.y * 0.5 + 0.5) * rect.height + rect.top + cubeLabelOffsetPx;
  introCubeLabel.style.left = `${x}px`;
  introCubeLabel.style.top = `${y}px`;
  introCubeLabel.classList.toggle("is-visible", cubeHover);
}

function animate() {
  const isWarpOnly = introView && introView.classList.contains("warp-only");
  if (warpState.active) {
    const now = performance.now();
    const t = Math.min((now - warpState.start) / warpState.warpDurationMs, 1);
    const eased = Math.pow(t, 1.6);
    const scaleBoost = 1 + eased * 5;
    ringGroup.scale.setScalar(ringBaseScale * scaleBoost);
    if (titleWrap) {
      titleWrap.style.transform = `translate(-50%, -50%) scale(${scaleBoost.toFixed(3)})`;
      titleWrap.style.opacity = isWarpOnly ? "0" : `${(1 - eased).toFixed(3)}`;
    }
  } else {
    ringGroup.scale.setScalar(ringBaseScale);
    if (titleWrap) {
      titleWrap.style.transform = "translate(-50%, -50%) scale(1)";
      titleWrap.style.opacity = isWarpOnly ? "0" : "1";
    }
  }
  updateWarp();
  ringGroup.rotation.z += 0.004;
  const spinFactor = cubeSpinBoost ? 8 : 1;
  cubeGroup.rotation.y += cubeSpinBase.y * spinFactor;
  cubeGroup.rotation.x += cubeSpinBase.x * spinFactor;
  glowCurrent += (glowTarget - glowCurrent) * 0.08;
  cubeGlow.material.opacity = glowCurrent;
  introControls.update();
  updateIntroCubeLabel();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updatePointer(event) {
  if (!event || typeof event.clientX !== "number") {
    return;
  }
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(cubies, true);
  const isHover = hits.length > 0;
  if (isHover !== cubeHover) {
    cubeHover = isHover;
    setCubeGlow(cubeHover);
  }
}

function clearPointer() {
  if (!cubeHover) return;
  cubeHover = false;
  setCubeGlow(false);
}

function isUiTarget(event) {
  if (!event || !event.target || typeof event.target.closest !== "function") {
    return false;
  }
  return Boolean(event.target.closest("#aboutPanel, #bgmPanel"));
}

function handleClick(event) {
  if (isUiTarget(event)) {
    return;
  }
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(cubies, true);
  if (hits.length > 0) {
    startWarpTransition("cube");
  }
}

function startWarpTransition(targetView) {
  if (warpState.active || warpState.pending) {
    logIntro("warp blocked", { active: warpState.active, pending: warpState.pending });
    return;
  }
  logIntro("startWarpTransition", targetView);
  if (targetView === "intro") {
    warpReturnPending = true;
    if (introView) {
      introView.classList.add("is-active", "warp-only");
    }
    setStarfieldTransparent(false);
    resetIntroState();
    loadSettings();
    if (window.magicCubeAudio && typeof window.magicCubeAudio.setViewActive === "function") {
      window.magicCubeAudio.setViewActive(false);
    }
    if (window.magicCubeAudio && typeof window.magicCubeAudio.fadeOutBgm === "function") {
      window.magicCubeAudio.fadeOutBgm(1200, 5000);
    } else if (window.magicCubeAudio && typeof window.magicCubeAudio.stopBgm === "function") {
      window.magicCubeAudio.stopBgm();
    }
    unlockAudio();
  }
  cubeSpinBoost = true;
  warpState.pending = true;
  warpOpacityTarget = 0.18;
  window.clearTimeout(warpState.timer);
  window.clearTimeout(warpState.navTimer);
  warpState.timer = window.setTimeout(() => {
    warpState.active = true;
    warpState.pending = false;
    warpState.start = performance.now();
    warpOpacityTarget = 0.85;
    warpState.navTimer = window.setTimeout(() => {
      if (targetView === "intro") {
        if (window.location.hash !== "") {
          window.location.hash = "";
        }
        finalizeIntroReturn();
        return;
      }
      navigateTo(targetView);
    }, warpState.warpDurationMs);
  }, warpState.delayMs);
}

window.starCubeWarp = {
  startTransition: startWarpTransition
};

window.addEventListener("resize", resize);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resize);
  window.visualViewport.addEventListener("scroll", resize);
}
window.addEventListener("pointermove", updatePointer);
window.addEventListener("pointerleave", clearPointer);
window.addEventListener("click", handleClick);
resize();
animate();
