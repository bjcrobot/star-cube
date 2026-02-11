import * as THREE from "three";
import { SimplexNoise } from "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/math/SimplexNoise.js";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mixColor(a, b, t) {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t))
  };
}

export function createFractalFace() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.createImageData(size, size);
  const noise = new SimplexNoise();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const palette = [
    { r: 20, g: 10, b: 60 },
    { r: 90, g: 20, b: 160 },
    { r: 200, g: 40, b: 80 },
    { r: 10, g: 180, b: 190 },
    { r: 250, g: 220, b: 40 },
    { r: 255, g: 90, b: 30 }
  ];

  const state = {
    zoomProgress: 0,
    zoomSpeed: 0.00032,
    offsetX: Math.random() * 1000,
    offsetY: Math.random() * 1000,
    offsetSpeed: 0.00012,
    lastUpdate: 0
  };


  function fbm(x, y) {
    let value = 0;
    let amplitude = 0.6;
    let frequency = 1.0;
    for (let i = 0; i < 4; i += 1) {
      value += amplitude * noise.noise(x * frequency, y * frequency);
      frequency *= 2.1;
      amplitude *= 0.5;
    }
    return value;
  }

  function getColor(value) {
    const t = clamp((value + 1) * 0.5, 0, 1);
    const mid = t * (palette.length - 1);
    const index = Math.floor(mid);
    const localT = mid - index;
    const a = palette[index];
    const b = palette[Math.min(index + 1, palette.length - 1)];
    return mixColor(a, b, localT);
  }

  function update(now) {
    if (now - state.lastUpdate < 60) {
      return;
    }
    const delta = now - state.lastUpdate;
    state.lastUpdate = now;

    state.zoomProgress += state.zoomSpeed * delta;
    state.offsetX += delta * state.offsetSpeed;
    state.offsetY += delta * state.offsetSpeed * 0.9;


    const logMax = Math.log(64);
    const blendRange = 0.35;
    const logZoom = state.zoomProgress % logMax;
    const zoomA = Math.exp(logZoom);
    const zoomB = Math.exp(logZoom - logMax);
    const blend = clamp((logZoom - (logMax - blendRange)) / blendRange, 0, 1);


    const time = now * 0.00008;
    const warpScale = 0.9;
    const warpStrength = 0.6;

    const data = imageData.data;
    let index = 0;
    for (let y = 0; y < size; y += 1) {
      const v = (y / size - 0.5);
      for (let x = 0; x < size; x += 1) {
        const u = (x / size - 0.5);
        const baseXA = u * zoomA + state.offsetX;
        const baseYA = v * zoomA + state.offsetY;
        const baseXB = u * zoomB + state.offsetX;
        const baseYB = v * zoomB + state.offsetY;

        const warpXA = noise.noise(baseXA * warpScale + time, baseYA * warpScale) * warpStrength;
        const warpYA = noise.noise(baseXA * warpScale, baseYA * warpScale - time) * warpStrength;
        const warpXB = noise.noise(baseXB * warpScale + time, baseYB * warpScale) * warpStrength;
        const warpYB = noise.noise(baseXB * warpScale, baseYB * warpScale - time) * warpStrength;

        const valueA = fbm(baseXA + warpXA, baseYA + warpYA + time * 0.4);
        const valueB = fbm(baseXB + warpXB, baseYB + warpYB + time * 0.4);
        const value = lerp(valueA, valueB, blend);

        const color = getColor(value);
        data[index] = color.r;
        data[index + 1] = color.g;
        data[index + 2] = color.b;
        data[index + 3] = 255;
        index += 4;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    texture.needsUpdate = true;
  }

  return { texture, update };
}
