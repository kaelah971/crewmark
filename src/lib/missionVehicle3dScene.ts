import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { VehicleLivery } from "./vehicleLivery";
import { applyLiveryPaint, buildLiveryDecals, SEDAN_GROUND_Y } from "./sedanSnapshot";
import { sampleMissionRoute, type VehicleState } from "../world/vehicle";

export interface MissionVehicle3DSceneResult {
  renderer: THREE.WebGLRenderer;
  updateVehicle: (state: VehicleState) => void;
  setVehicleLivery: (livery: VehicleLivery) => void;
  dispose: () => void;
}

let sedanModelPromise: Promise<THREE.Group> | null = null;

function loadSedanModel(): Promise<THREE.Group> {
  if (sedanModelPromise) return sedanModelPromise;
  sedanModelPromise = new Promise((resolve, reject) => {
    new GLTFLoader().load(
      "/models/sedan.glb",
      (gltf) => resolve(gltf.scene),
      undefined,
      reject,
    );
  });
  return sedanModelPromise;
}

function cloneMaterials(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    child.material = Array.isArray(child.material)
      ? child.material.map((material) => material.clone())
      : child.material.clone();
  });
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(128, 64, 5, 128, 64, 124);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.68)");
    gradient.addColorStop(0.4, "rgba(6, 8, 12, 0.42)");
    gradient.addColorStop(0.78, "rgba(6, 8, 12, 0.08)");
    gradient.addColorStop(1, "rgba(6, 8, 12, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function disposeVehicleMaterials(root: THREE.Object3D, disposeMaps = false): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      // GLTF material clones share the cached model's texture maps. Decal
      // maps are instance-owned and may be released when their group goes.
      if (disposeMaps && material.map) material.map.dispose();
      material.dispose();
    });
  });
}

/**
 * Transparent fixed-camera vehicle layer for the Port Vice photograph.
 * The photograph remains the environment; this scene only renders the real
 * GLB sedan, its livery, lighting, and ground contact shadow.
 */
export function initMissionVehicle3D(
  container: HTMLElement,
  initialLivery: VehicleLivery,
  initialState: VehicleState,
  onLoaded?: () => void,
): MissionVehicle3DSceneResult {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);

  // Camera is deliberately fixed: it behaves like a security/scene camera,
  // not a chase camera. The route is authored to this perspective and plate.
  camera.position.set(4, 2.5, -10);
  camera.lookAt(new THREE.Vector3(0.8, 1.5, 7));

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = false;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.pointerEvents = "none";
  container.appendChild(renderer.domElement);

  // Night security lighting: warm sodium key, cool city fill, restrained rim.
  scene.add(new THREE.HemisphereLight(0x415878, 0x241b17, 1.0));
  const sodium = new THREE.DirectionalLight(0xffbd76, 2.4);
  sodium.position.set(-5, 8, -5);
  scene.add(sodium);
  const cityFill = new THREE.DirectionalLight(0x7da8d8, 1.25);
  cityFill.position.set(7, 5, 10);
  scene.add(cityFill);
  const rearRim = new THREE.PointLight(0xa8c7ff, 1.0, 24, 2);
  rearRim.position.set(4, 3, -7);
  scene.add(rearRim);
  const amberPractical = new THREE.PointLight(0xff9f4a, 0.8, 14, 2);
  amberPractical.position.set(-4, 1.6, 1);
  scene.add(amberPractical);

  const shadowGeometry = new THREE.PlaneGeometry(4.9, 2.1);
  shadowGeometry.rotateX(-Math.PI / 2);
  const shadowTexture = createContactShadowTexture();
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.82,
  });
  const contactShadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  contactShadow.position.y = 0.008;
  scene.add(contactShadow);

  let currentState = initialState;
  let currentLivery = initialLivery;
  let car: THREE.Group | null = null;
  let liveryRevision = 0;
  let disposed = false;

  const applyCurrentLivery = async (revision: number) => {
    if (!car || disposed) return;
    applyLiveryPaint(car, currentLivery);
    const oldDecals = car.getObjectByName("livery-decals");
    if (oldDecals) {
      car.remove(oldDecals);
      disposeVehicleMaterials(oldDecals, true);
    }
    car.updateMatrixWorld(true);
    const decals = await buildLiveryDecals(car, currentLivery);
    if (disposed || revision !== liveryRevision || !car) {
      disposeVehicleMaterials(decals, true);
      return;
    }
    car.add(decals);
  };

  void loadSedanModel()
    .then((source) => {
      if (disposed) return;
      car = source.clone(true);
      car.name = "mission-sedan-glb";
      car.scale.setScalar(1.15);
      car.position.y = SEDAN_GROUND_Y;
      cloneMaterials(car);
      car.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = false;
          child.receiveShadow = false;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.envMapIntensity = 0.9;
              material.roughness = Math.max(0.22, material.roughness);
            }
          });
        }
      });
      scene.add(car);
      updateVehicleTransform();
      liveryRevision += 1;
      void applyCurrentLivery(liveryRevision);
      onLoaded?.();
    })
    .catch((error) => {
      console.error("[crewmark] Failed to load the Port Vice sedan GLB:", error);
      onLoaded?.();
    });

  const updateVehicleTransform = () => {
    const sample = sampleMissionRoute(currentState.routeProgress, currentState.lateralOffset);
    contactShadow.position.set(sample.x, 0.01, sample.z);
    contactShadow.rotation.y = currentState.heading;
    if (!car) return;
    car.position.set(sample.x, SEDAN_GROUND_Y, sample.z);
    car.rotation.y = currentState.heading;
  };

  const updateVehicle = (state: VehicleState) => {
    currentState = state;
    updateVehicleTransform();
  };

  const setVehicleLivery = (livery: VehicleLivery) => {
    currentLivery = livery;
    liveryRevision += 1;
    void applyCurrentLivery(liveryRevision);
  };

  let animationFrame = 0;
  const animate = () => {
    if (disposed) return;
    animationFrame = window.requestAnimationFrame(animate);
    renderer.render(scene, camera);
  };
  animate();

  const onResize = () => {
    const nextWidth = container.clientWidth || window.innerWidth;
    const nextHeight = container.clientHeight || window.innerHeight;
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight, false);
  };
  window.addEventListener("resize", onResize);

  return {
    renderer,
    updateVehicle,
    setVehicleLivery,
    dispose: () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", onResize);
      if (car) {
        const decals = car.getObjectByName("livery-decals");
        if (decals) disposeVehicleMaterials(decals, true);
        disposeVehicleMaterials(car);
      }
      shadowTexture.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
    },
  };
}