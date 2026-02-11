import * as THREE from "three";
import { createFractalFace } from "./fractale.js";

const defaultColors = {
  U: 0xffffff,
  D: 0xffd400,
  F: 0x00b050,
  B: 0x0066cc,
  R: 0xff3b30,
  L: 0xff9f0a,
  I: 0x2f2f2f
};

function makeMaterial(color, isInner) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.05,
    emissive: isInner ? new THREE.Color(0x1b1b1b) : new THREE.Color(0x000000),
    emissiveIntensity: isInner ? 0.35 : 0.0,
    side: isInner ? THREE.DoubleSide : THREE.FrontSide
  });
}

function applyFaceUv(geometry, faceIndex, tileX, tileY) {
  const uv = geometry.attributes.uv;
  if (!uv) {
    return;
  }
  const start = faceIndex * 4 * 2;
  const tileScale = 1 / 3;
  for (let i = 0; i < 4; i += 1) {
    const index = start + i * 2;
    const u = uv.array[index];
    const v = uv.array[index + 1];
    uv.array[index] = (u + tileX) * tileScale;
    uv.array[index + 1] = (v + tileY) * tileScale;
  }
  uv.needsUpdate = true;
}

export function createSolvedCube({
  cubeGroup = new THREE.Group(),
  cubieSize = 0.98,
  gap = 0.03,
  colors = defaultColors,
  useFractalFace = true
} = {}) {
  const cubies = [];
  const fractalFace = useFractalFace ? createFractalFace() : null;
  const fractalMaterial = useFractalFace
    ? new THREE.MeshStandardMaterial({
        color: colors.B,
        map: fractalFace.texture,
        roughness: 0.4,
        metalness: 0.1,
        emissive: new THREE.Color(0x050a12),
        emissiveIntensity: 0.18
      })
    : null;

  if (fractalMaterial) {
    fractalMaterial.onBeforeCompile = shader => {
      shader.uniforms.fractalMix = { value: 0 };
      shader.uniforms.fractalBaseColor = { value: new THREE.Color(colors.B) };
      fractalMaterial.userData.fractalUniforms = shader.uniforms;
      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        "uniform float fractalMix;\nuniform vec3 fractalBaseColor;\nvoid main() {"
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        "#ifdef USE_MAP\nvec4 texelColor = texture2D(map, vMapUv);\nvec3 texelRgb = texelColor.rgb;\ndiffuseColor.rgb = mix(fractalBaseColor, texelRgb, fractalMix);\n#else\ndiffuseColor.rgb = fractalBaseColor;\n#endif"
      );
    };
  }

  function createCubie(x, y, z) {
    const geometry = new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize);
    if (useFractalFace && z === -1) {
      applyFaceUv(geometry, 5, x + 1, y + 1);
    }
    const backMaterial = useFractalFace
      ? fractalMaterial
      : makeMaterial(z === -1 ? colors.B : colors.I, z !== -1);
    const materials = [
      makeMaterial(x === 1 ? colors.R : colors.I, x !== 1),
      makeMaterial(x === -1 ? colors.L : colors.I, x !== -1),
      makeMaterial(y === 1 ? colors.U : colors.I, y !== 1),
      makeMaterial(y === -1 ? colors.D : colors.I, y !== -1),
      makeMaterial(z === 1 ? colors.F : colors.I, z !== 1),
      backMaterial
    ];
    const mesh = new THREE.Mesh(geometry, materials);
    const innerShell = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: colors.I,
        side: THREE.DoubleSide
      })
    );
    innerShell.scale.set(0.97, 0.97, 0.97);
    mesh.add(innerShell);
    mesh.position.set(x * (1 + gap), y * (1 + gap), z * (1 + gap));
    mesh.userData.coord = new THREE.Vector3(x, y, z);
    cubeGroup.add(mesh);
    cubies.push(mesh);
  }

  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        createCubie(x, y, z);
      }
    }
  }

  return {
    cubeGroup,
    cubies,
    colors,
    fractalFace,
    fractalMaterial,
    cubieSize,
    gap
  };
}
