import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import type { VehicleLivery } from "./vehicleLivery";

export type SedanSnapshotAngle = "yard" | "mission";

// Memory cache for rendered sedan snapshot data URLs
const SNAPSHOT_CACHE = new Map<string, string>();

export function getSedanSnapshotKey(livery: VehicleLivery, angle: SedanSnapshotAngle): string {
  return JSON.stringify({ angle, livery });
}

// The GLB's wheel bottoms sit just below the scene ground plane. Keep the
// canonical car lifted by that measured amount so the wheels, not the sills,
// meet the contact shadow in every 2.5D projection.
export const SEDAN_GROUND_Y = 0.19;

let sharedModelPromise: Promise<THREE.Group> | null = null;

function createSnapshotShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  if (context) {
    const gradient = context.createRadialGradient(128, 64, 8, 128, 64, 124);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.64)");
    gradient.addColorStop(0.45, "rgba(1, 5, 8, 0.34)");
    gradient.addColorStop(1, "rgba(1, 5, 8, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function loadSharedSedanModel(): Promise<THREE.Group> {
  if (sharedModelPromise) return sharedModelPromise;

  let resolveGroup!: (car: THREE.Group) => void;
  let rejectGroup!: (err: unknown) => void;
  const promise = new Promise<THREE.Group>((resolve, reject) => {
    resolveGroup = resolve;
    rejectGroup = reject;
  });
  sharedModelPromise = promise;

  const loader = new GLTFLoader();
  loader.load(
    "/models/sedan.glb",
    (gltf) => {
      const car = gltf.scene;
      car.name = "canonical-sedan-source";
      car.scale.set(1.15, 1.15, 1.15);
      resolveGroup(car);
    },
    undefined,
    (err) => {
      console.error("[crewmark] Failed to load sedan model for snapshot:", err);
      rejectGroup(err);
    },
  );

  return promise;
}

/**
 * Checks if a mesh belongs to the Primary Body Paint group (Paint 1).
 */
export function isPrimaryPaintMesh(mesh: THREE.Mesh): boolean {
  const name = mesh.name.toLowerCase();
  const matName = Array.isArray(mesh.material)
    ? mesh.material.map((m) => m.name.toLowerCase()).join(" ")
    : mesh.material?.name.toLowerCase() ?? "";

  if (/paint 1/i.test(matName)) return true;
  return /body(door[lr]color1|hood|rearpanelscolor1|pillars|door[lr]mirrorcolor1)/i.test(name);
}

/**
 * Checks if a mesh belongs to the Secondary Body Paint group (Paint 2).
 */
export function isSecondaryPaintMesh(mesh: THREE.Mesh): boolean {
  const name = mesh.name.toLowerCase();
  const matName = Array.isArray(mesh.material)
    ? mesh.material.map((m) => m.name.toLowerCase()).join(" ")
    : mesh.material?.name.toLowerCase() ?? "";

  if (/paint 2/i.test(matName)) return true;
  return /body(panelscolor2|roofpanel|hoodtopgrill|door[lr]color2|door[lr]handle02|door[lr]mirrorcolor2)/i.test(name);
}

/**
 * Checks if a mesh is a brake caliper.
 */
export function isBrakeMesh(mesh: THREE.Mesh): boolean {
  const name = mesh.name.toLowerCase();
  const matName = Array.isArray(mesh.material)
    ? mesh.material.map((m) => m.name.toLowerCase()).join(" ")
    : mesh.material?.name.toLowerCase() ?? "";
  return /brakepad/i.test(name) || /brake/i.test(matName);
}

/**
 * Applies the authored livery paints to the car meshes.
 */
export function applyLiveryPaint(car: THREE.Object3D, livery: VehicleLivery): void {
  car.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    if (isPrimaryPaintMesh(child)) {
      if (child.material instanceof THREE.MeshStandardMaterial) {
        child.material.color.set(livery.bodyBaseColor);
        child.material.roughness = 0.28;
        child.material.metalness = 0.42;
        child.material.needsUpdate = true;
      }
    } else if (isSecondaryPaintMesh(child)) {
      if (child.material instanceof THREE.MeshStandardMaterial) {
        child.material.color.set(livery.secondaryColor);
        child.material.roughness = 0.32;
        child.material.metalness = 0.38;
        child.material.needsUpdate = true;
      }
    } else if (isBrakeMesh(child)) {
      if (child.material instanceof THREE.MeshStandardMaterial) {
        child.material.color.set(livery.accentColor);
        child.material.needsUpdate = true;
      }
    }
  });
}

/**
 * Creates a surface-conforming decal on the car using DecalGeometry or clean fallback.
 */
export async function createVehicleDecal(
  targetMesh: THREE.Mesh,
  textureUrl: string,
  position: THREE.Vector3,
  orientation: THREE.Euler,
  size: THREE.Vector3,
  textureLoader: THREE.TextureLoader,
): Promise<THREE.Mesh> {
  const texture = await textureLoader.loadAsync(textureUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  const decalMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    roughness: 0.25,
    metalness: 0.05,
  });

  let geometry: THREE.BufferGeometry;
  try {
    targetMesh.updateMatrixWorld(true);
    const decalGeo = new DecalGeometry(targetMesh, position, orientation, size);
    if (decalGeo.attributes.position && decalGeo.attributes.position.count > 0) {
      geometry = decalGeo;
    } else {
      geometry = new THREE.PlaneGeometry(size.x, size.y);
    }
  } catch {
    geometry = new THREE.PlaneGeometry(size.x, size.y);
  }

  const decalMesh = new THREE.Mesh(geometry, decalMaterial);
  if (!(geometry instanceof DecalGeometry)) {
    decalMesh.position.copy(position);
    decalMesh.rotation.copy(orientation);
    decalMesh.position.x += position.x > 0 ? 0.003 : -0.003;
  }

  decalMesh.name = `decal-${targetMesh.name}`;
  return decalMesh;
}

/**
 * Builds all livery decals for the vehicle.
 */
export async function buildLiveryDecals(
  car: THREE.Object3D,
  livery: VehicleLivery,
  textureLoader = new THREE.TextureLoader(),
): Promise<THREE.Group> {
  const decalGroup = new THREE.Group();
  decalGroup.name = "livery-decals";

  let doorL: THREE.Mesh | null = null;
  let doorR: THREE.Mesh | null = null;
  let hood: THREE.Mesh | null = null;
  let rearPanel: THREE.Mesh | null = null;

  car.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const name = child.name.toLowerCase();
      if (name.includes("doorlcolor1")) doorL = child;
      else if (name.includes("doorrcolor1")) doorR = child;
      else if (name === "bodyhood") hood = child;
      else if (name.includes("rearpanelscolor1")) rearPanel = child;
    }
  });

  const bW = livery.badgeWidth || 0.65;
  const bH = livery.badgeHeight || 0.42;

  // 1. Driver Front Door Badge (+X side, normal facing +X)
  if (doorL && livery.doorGraphicDataUrl) {
    const decal = await createVehicleDecal(
      doorL,
      livery.doorGraphicDataUrl,
      new THREE.Vector3(1.10, 0.73, 0.18),
      new THREE.Euler(0, Math.PI / 2, 0),
      new THREE.Vector3(bW, bH, 0.4),
      textureLoader,
    );
    decalGroup.add(decal);
  }

  // 2. Passenger Front Door Badge (-X side, normal facing -X)
  if (doorR && livery.doorGraphicDataUrl) {
    const decal = await createVehicleDecal(
      doorR,
      livery.doorGraphicDataUrl,
      new THREE.Vector3(-1.10, 0.73, 0.18),
      new THREE.Euler(0, -Math.PI / 2, 0),
      new THREE.Vector3(bW, bH, 0.4),
      textureLoader,
    );
    decalGroup.add(decal);
  }

  // 3. Hood Emblem (+Y/+Z surface)
  if (hood && livery.hoodGraphicDataUrl) {
    const decal = await createVehicleDecal(
      hood,
      livery.hoodGraphicDataUrl,
      new THREE.Vector3(0, 0.75, 1.85),
      new THREE.Euler(-Math.PI / 2 + 0.28, 0, 0),
      new THREE.Vector3(0.40, 0.40, 0.45),
      textureLoader,
    );
    decalGroup.add(decal);
  }

  // 4. Rear Quarter Unit Markings (Driver side +X)
  if (rearPanel && livery.rearGraphicDataUrl) {
    const decalL = await createVehicleDecal(
      rearPanel,
      livery.rearGraphicDataUrl,
      new THREE.Vector3(1.12, 0.82, -0.92),
      new THREE.Euler(0, Math.PI / 2, 0),
      new THREE.Vector3(0.55, 0.22, 0.35),
      textureLoader,
    );
    decalGroup.add(decalL);
  }

  return decalGroup;
}

/**
 * Offscreen renderer singleton to avoid creating multiple WebGL contexts.
 */
class OffscreenSedanRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;

  private init() {
    if (typeof document === "undefined") return;

    const width = 1024;
    const height = 576;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(1.5);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.scene = new THREE.Scene();
    this.scene.background = null; // Clean transparent background

    // Studio lighting
    const hemi = new THREE.HemisphereLight(0x2d3748, 0x111827, 0.85);
    this.scene.add(hemi);

    const key = new THREE.SpotLight(0xffe0ad, 4.0, 25, Math.PI / 4, 0.4, 1.2);
    key.position.set(4, 9, 6);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x38bdf8, 1.55);
    fill.position.set(-6, 5, 8);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 1.1);
    rim.position.set(6, 4, -8);
    this.scene.add(rim);

    const yardAmbient = new THREE.AmbientLight(0xffb875, 0.42);
    this.scene.add(yardAmbient);

    const yardWarmFill = new THREE.DirectionalLight(0xffbf7a, 0.72);
    yardWarmFill.position.set(-4, 6, 6);
    this.scene.add(yardWarmFill);

    // Yard-matched practicals keep the black factory finish dimensional without
    // baking any scene color into the livery itself.
    const yardAmber = new THREE.SpotLight(0xffb45d, 2.8, 22, Math.PI / 4, 0.65, 1.4);
    yardAmber.position.set(3.5, 7.5, 5.5);
    yardAmber.target.position.set(0, 0.65, 0);
    this.scene.add(yardAmber.target, yardAmber);

    const yardPink = new THREE.DirectionalLight(0xf04f8f, 0.42);
    yardPink.position.set(-5, 3, -6);
    this.scene.add(yardPink);

    // A restrained rear-side lift keeps the back quarter readable when the
    // mission camera turns toward the booth without flattening the black paint.
    const rearFill = new THREE.DirectionalLight(0x8ab4ff, 0.68);
    rearFill.position.set(5, 4, -8);
    this.scene.add(rearFill);

    // Soft ground contact shadow beneath the vehicle
    const shadowGeo = new THREE.PlaneGeometry(5.6, 2.6);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createSnapshotShadowTexture(),
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.y = 0.01;
    this.scene.add(shadowMesh);

    this.camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
  }

  public async renderSnapshot(livery: VehicleLivery, angle: SedanSnapshotAngle): Promise<string> {
    const cacheKey = getSedanSnapshotKey(livery, angle);
    if (SNAPSHOT_CACHE.has(cacheKey)) {
      return SNAPSHOT_CACHE.get(cacheKey)!;
    }

    if (!this.renderer) {
      this.init();
    }

    if (!this.renderer || !this.scene || !this.camera) {
      return "";
    }

    const baseCar = await loadSharedSedanModel();
    const car = baseCar.clone(true);

    // Clean any prior decal objects
    const existingDecals = car.getObjectByName("livery-decals");
    if (existingDecals) car.remove(existingDecals);

    // Respray body materials
    applyLiveryPaint(car, livery);

    // Add decals
    const decals = await buildLiveryDecals(car, livery);
    car.add(decals);

    // Add car to scene. The source model's wheel bottoms are at y≈-0.16;
    // lifting it onto y=0 prevents the road shadow from cutting through the
    // tires and keeps the mission car visually planted.
    const oldCar = this.scene.getObjectByName("render-car");
    if (oldCar) this.scene.remove(oldCar);
    car.name = "render-car";
    car.position.y = SEDAN_GROUND_Y;
    this.scene.add(car);

    // Position camera based on angle:
    // "yard": Driver-side view framed for the parked bay's perspective.
    // "mission": Side-front profile driving along Port Vice road lane
    if (angle === "yard") {
      this.camera.position.set(6.2, 0.78, 0.20);
      this.camera.lookAt(0, 0.65, 0.15);
    } else {
      // Leave a little more air around the front 3/4 silhouette than the
      // parked side shot; the mission projection is enlarged by CSS after
      // this transparent render is composited over the road plate.
      this.camera.position.set(6.45, 0.96, 1.42);
      this.camera.lookAt(0, 0.72, 0.20);
    }

    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL("image/png");

    SNAPSHOT_CACHE.set(cacheKey, dataUrl);
    return dataUrl;
  }
}

const offscreenRenderer = new OffscreenSedanRenderer();

/**
 * Returns a transparent PNG data URL of the real 3D liveried sedan from Three.js.
 * This guarantees the exact same car appears across the Yard and Port Vice mission.
 */
export async function getSedanSnapshot(
  livery: VehicleLivery,
  angle: SedanSnapshotAngle = "yard",
): Promise<string> {
  return offscreenRenderer.renderSnapshot(livery, angle);
}
