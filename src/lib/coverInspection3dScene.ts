import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { VehicleLivery } from "./vehicleLivery";
import { applyLiveryPaint, buildLiveryDecals } from "./sedanSnapshot";

export interface CoverInspection3DSceneResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  setCoverTexture: (url: string) => void;
  setVehicleLivery: (livery: VehicleLivery) => void;
  setCameraPreset: (preset: "hero" | "side" | "rear" | "detail") => void;
  dispose: () => void;
}

export function initCoverInspection3D(
  container: HTMLElement,
  _initialCoverUrl: string | null,
  onLoaded?: () => void,
  initialLivery?: VehicleLivery | null,
): CoverInspection3DSceneResult {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  // Premium studio scene with deep asphalt background
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060709);
  scene.fog = new THREE.FogExp2(0x060709, 0.035);

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 80);
  const target = new THREE.Vector3(0, 0.70, 0.20);

  // Curated Camera Presets around vehicle (4.6m sedan: +X is driver side, +Z is front, -Z is rear)
  const presets: Record<"hero" | "side" | "rear" | "detail", { radius: number; theta: number; phi: number }> = {
    // Front 3/4 hero angle (elevated, viewer looking at front-left driver side)
    hero: { radius: 6.8, theta: Math.PI / 4, phi: 1.22 },
    // Side view: directly facing the +X driver door where the door badge is mounted
    side: { radius: 5.6, theta: Math.PI / 2, phi: 1.35 },
    // Rear 3/4 angle: showcasing taillights, roofline, and rear quarter markings
    rear: { radius: 6.8, theta: (3 * Math.PI) / 4, phi: 1.22 },
    // Cover detail view: zoomed in right onto the driver door badge (+X)
    detail: { radius: 2.8, theta: Math.PI / 2, phi: 1.35 },
  };

  const spherical = new THREE.Spherical(presets.hero.radius, presets.hero.phi, presets.hero.theta);
  let desiredRadius = spherical.radius;

  // Clamps: bounded vertical rotation, no camera inversion, bounded zoom
  const minPolarAngle = 0.45;
  const maxPolarAngle = Math.PI / 2 - 0.08; // ~85 deg (never below ground)
  const minDistance = 2.4;
  const maxDistance = 12.0;

  // Renderer: high-performance, ACES tone mapping, soft shadows
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  // --- LIGHTING ---
  // Cool night rim ambient
  const hemi = new THREE.HemisphereLight(0x1E293B, 0x05070A, 0.75);
  scene.add(hemi);

  // Key light: overhead warm spotlight illuminating the vehicle roof and hood
  const keyLight = new THREE.SpotLight(0xFFFBE8, 3.8, 25, Math.PI / 4, 0.4, 1.2);
  keyLight.position.set(4, 9, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.bias = -0.0001;
  scene.add(keyLight);

  // Fill light: soft cool cyan/blue side light illuminating the decal door panel
  const fillLight = new THREE.DirectionalLight(0x38BDF8, 1.4);
  fillLight.position.set(-6, 5, 8);
  scene.add(fillLight);

  // Warm amber sodium accent from garage direction
  const accentLight = new THREE.PointLight(0xF59E0B, 2.5, 16, 1.5);
  accentLight.position.set(-5, 3, -4);
  scene.add(accentLight);

  // --- DARK REFLECTIVE GROUND ---
  const groundGeo = new THREE.CircleGeometry(16, 48);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0A0D12,
    roughness: 0.22,
    metalness: 0.65,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  // Dark contact shadow directly beneath vehicle
  const shadowGeo = new THREE.PlaneGeometry(5.6, 2.8);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x010203,
    transparent: true,
    opacity: 0.82,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.y = 0.01;
  scene.add(contactShadow);

  // --- CAR & REAL FLEET BODY RESPRAY WITH SURFACE DECALS ---
  let currentLivery = initialLivery ?? null;
  const textureLoader = new THREE.TextureLoader();
  let carInstance: THREE.Group | null = null;

  const updateCarLivery = async () => {
    if (!carInstance || !currentLivery) return;

    // 1. Respray the real vehicle body materials (Paint 1, Paint 2, Brake)
    applyLiveryPaint(carInstance, currentLivery);

    // 2. Remove any previous decals
    const oldDecals = carInstance.getObjectByName("livery-decals");
    if (oldDecals) carInstance.remove(oldDecals);

    // 3. Mount surface-conforming decals (emblems, unit numbers, markings)
    const newDecals = await buildLiveryDecals(carInstance, currentLivery, textureLoader);
    carInstance.add(newDecals);
  };

  // Load generic production sedan GLB.
  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    "/models/sedan.glb",
    (gltf) => {
      const car = gltf.scene;
      car.name = "vehicle-sedan";
      car.scale.set(1.15, 1.15, 1.15);
      car.position.set(0, 0, 0);

      car.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            const cloned = mats.map((m) => {
              if (m instanceof THREE.MeshStandardMaterial) {
                const c = m.clone();
                c.envMapIntensity = 1.4;
                return c;
              }
              return m;
            });
            child.material = Array.isArray(child.material) ? cloned : cloned[0];
          }
        }
      });

      carInstance = car;
      scene.add(car);
      updateCarLivery();
      if (onLoaded) onLoaded();
    },
    undefined,
    (err) => {
      console.error("[crewmark] Failed to load /models/sedan.glb:", err);
      if (onLoaded) onLoaded();
    },
  );

  // --- ORBIT & TOUCH CONTROLS ---
  let isDragging = false;
  let prevMouseX = 0;
  let prevMouseY = 0;
  let prevTouchDist = 0;

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    isDragging = true;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - prevMouseX;
    const dy = e.clientY - prevMouseY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    spherical.theta -= dx * 0.007;
    spherical.phi -= dy * 0.007;
    spherical.phi = Math.max(minPolarAngle, Math.min(maxPolarAngle, spherical.phi));
  };

  const onMouseUp = () => {
    isDragging = false;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    desiredRadius += e.deltaY * 0.007;
    desiredRadius = Math.max(minDistance, Math.min(maxDistance, desiredRadius));
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging = true;
      prevMouseX = e.touches[0].clientX;
      prevMouseY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      prevTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - prevMouseX;
      const dy = e.touches[0].clientY - prevMouseY;
      prevMouseX = e.touches[0].clientX;
      prevMouseY = e.touches[0].clientY;

      spherical.theta -= dx * 0.007;
      spherical.phi -= dy * 0.007;
      spherical.phi = Math.max(minPolarAngle, Math.min(maxPolarAngle, spherical.phi));
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const diff = prevTouchDist - dist;
      prevTouchDist = dist;
      desiredRadius += diff * 0.02;
      desiredRadius = Math.max(minDistance, Math.min(maxDistance, desiredRadius));
    }
  };

  const onTouchEnd = () => {
    isDragging = false;
  };

  const dom = renderer.domElement;
  dom.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  dom.addEventListener("wheel", onWheel, { passive: false });
  dom.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: false });

  const onResize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  // Animation Loop
  let animId = 0;
  const animate = () => {
    animId = requestAnimationFrame(animate);

    spherical.radius += (desiredRadius - spherical.radius) * 0.1;

    const offset = new THREE.Vector3().setFromSpherical(spherical);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);

    renderer.render(scene, camera);
  };
  animate();

  return {
    scene,
    camera,
    renderer,
    setCoverTexture: (_url: string) => {
      // Texture is driven by the active VehicleLivery
    },
    setVehicleLivery: (livery) => {
      currentLivery = livery;
      updateCarLivery();
    },
    setCameraPreset: (presetKey) => {
      const p = presets[presetKey];
      if (p) {
        spherical.theta = p.theta;
        spherical.phi = p.phi;
        desiredRadius = p.radius;
      }
    },
    dispose: () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      renderer.dispose();
      if (dom.parentElement) {
        dom.parentElement.removeChild(dom);
      }
    },
  };
}
