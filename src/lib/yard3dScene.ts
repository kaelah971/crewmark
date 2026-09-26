import * as THREE from "three";
import {
  createAsphaltTexture,
  createCorrugatedMetalTexture,
  createTimberCrateTexture,
} from "./yard3dTextures";
import { buildSedanModel } from "./yard3dSedan";

export interface Yard3DSceneResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  updateCoverTexture: (url: string) => void;
  focusTarget: (position: THREE.Vector3, cameraPos: THREE.Vector3) => void;
  resetCamera: () => void;
  dispose: () => void;
}

export function init3DYardScene(
  container: HTMLElement,
  coverDataUrl: string | null,
  onObjectClick: (objectName: "terminal" | "print-bay" | "vehicle" | "crate") => void,
): Yard3DSceneResult {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  // Scene & Fog (humid South Florida industrial night)
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08090C);
  scene.fog = new THREE.FogExp2(0x08090C, 0.032);

  // Camera
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  const defaultCamPos = new THREE.Vector3(7, 5, 9);
  const defaultTarget = new THREE.Vector3(0, 1, 0);
  camera.position.copy(defaultCamPos);
  camera.lookAt(defaultTarget);

  // Renderer with soft shadows and tone mapping
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  // --- LIGHTING ---
  // Ambient moon / night sky light (cool indigo)
  const hemiLight = new THREE.HemisphereLight(0x1E293B, 0x0A0D14, 0.6);
  scene.add(hemiLight);

  // Moon directional light casting soft shadows
  const moonLight = new THREE.DirectionalLight(0x38BDF8, 0.8);
  moonLight.position.set(12, 20, 10);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 1024;
  moonLight.shadow.mapSize.height = 1024;
  moonLight.shadow.camera.near = 0.5;
  moonLight.shadow.camera.far = 40;
  moonLight.shadow.camera.left = -12;
  moonLight.shadow.camera.right = 12;
  moonLight.shadow.camera.top = 12;
  moonLight.shadow.camera.bottom = -12;
  scene.add(moonLight);

  // Sodium industrial floodlight over print bay / garage (warm orange/amber 0xF59E0B)
  const garageLight = new THREE.PointLight(0xF59E0B, 3.5, 18, 1.2);
  garageLight.position.set(-3.5, 4.2, -1.5);
  garageLight.castShadow = true;
  scene.add(garageLight);

  // Kiosk / Terminal terminal glow (cyan/electric blue)
  const terminalLight = new THREE.PointLight(0x06B6D4, 2.2, 8, 1.4);
  terminalLight.position.set(3.2, 1.8, 1.8);
  scene.add(terminalLight);

  // --- ENVIRONMENT MESHES ---
  // Ground: Wet asphalt plane (28m x 28m)
  const asphaltTex = createAsphaltTexture();
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x222630,
    map: asphaltTex,
    roughness: 0.35,
    metalness: 0.2,
  });
  const groundGeo = new THREE.PlaneGeometry(32, 32);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  // Print Shop Garage Building (Massive industrial warehouse on -X/-Z)
  const metalTex = createCorrugatedMetalTexture();
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1E242E,
    map: metalTex,
    roughness: 0.6,
    metalness: 0.3,
  });
  const bldgGeo = new THREE.BoxGeometry(9, 5.5, 8);
  const building = new THREE.Mesh(bldgGeo, wallMat);
  building.name = "print-bay";
  building.position.set(-6.5, 2.75, -4.5);
  building.castShadow = true;
  building.receiveShadow = true;
  scene.add(building);

  // Garage Roll-Up Door
  const doorGeo = new THREE.PlaneGeometry(3.6, 3.4);
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0xD97706,
    roughness: 0.4,
    metalness: 0.5,
  });
  const rollDoor = new THREE.Mesh(doorGeo, doorMat);
  rollDoor.name = "print-bay";
  rollDoor.position.set(-2.0, 1.7, -0.48);
  scene.add(rollDoor);

  // Concrete Jersey Barriers
  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.9,
    metalness: 0.05,
  });
  for (let i = 0; i < 4; i++) {
    const bGeo = new THREE.BoxGeometry(2.2, 0.8, 0.4);
    const barrier = new THREE.Mesh(bGeo, barrierMat);
    barrier.position.set(-1.0 + i * 2.3, 0.4, 5.8);
    barrier.castShadow = true;
    barrier.receiveShadow = true;
    scene.add(barrier);
  }

  // Chainlink perimeter fence posts
  const postMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
  for (let p = -12; p <= 12; p += 4) {
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.2);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(p, 1.6, -9.8);
    scene.add(post);
  }

  // --- INTERACTIVE PROPS ---
  // 1. TERMINAL KIOSK (Interactive work order console at X=3.5, Z=2.0)
  const kioskGroup = new THREE.Group();
  kioskGroup.name = "terminal";

  const standGeo = new THREE.BoxGeometry(0.5, 1.1, 0.4);
  const kioskMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.5, metalness: 0.4 });
  const stand = new THREE.Mesh(standGeo, kioskMat);
  stand.position.y = 0.55;
  stand.castShadow = true;
  kioskGroup.add(stand);

  // Angled terminal screen
  const screenGeo = new THREE.BoxGeometry(0.7, 0.5, 0.1);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x06B6D4 });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 1.25, 0.05);
  screen.rotation.x = -0.35;
  kioskGroup.add(screen);

  kioskGroup.position.set(3.8, 0, 2.2);
  scene.add(kioskGroup);

  // 2. CRATES (Interactive shipping crates with Cover decal label)
  const crateGroup = new THREE.Group();
  crateGroup.name = "crate";

  const timberTex = createTimberCrateTexture();
  const crateMat = new THREE.MeshStandardMaterial({
    map: timberTex,
    roughness: 0.8,
    metalness: 0.1,
  });

  const crateGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const crateMesh = new THREE.Mesh(crateGeo, crateMat);
  crateMesh.position.y = 0.7;
  crateMesh.castShadow = true;
  crateMesh.receiveShadow = true;
  crateGroup.add(crateMesh);

  // Second stacked crate
  const smallCrateGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
  const smallCrate = new THREE.Mesh(smallCrateGeo, crateMat);
  smallCrate.position.set(0.1, 1.95, -0.1);
  smallCrate.rotation.y = 0.15;
  smallCrate.castShadow = true;
  crateGroup.add(smallCrate);

  // Decal label on main crate side (+Z)
  const crateLabelGeo = new THREE.PlaneGeometry(0.95, 0.42);
  const crateLabelMat = new THREE.MeshStandardMaterial({
    roughness: 0.4,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const crateLabel = new THREE.Mesh(crateLabelGeo, crateLabelMat);
  crateLabel.name = "cover-decal-crate";
  crateLabel.position.set(0, 0.75, 0.705);
  crateGroup.add(crateLabel);

  crateGroup.position.set(1.5, 0, -2.8);
  scene.add(crateGroup);

  // 3. VEHICLE SEDAN (Interactive service sedan)
  let coverTexture: THREE.Texture | null = null;
  const loadCoverTex = (url: string) => {
    const loader = new THREE.TextureLoader();
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      coverTexture = tex;

      // Update vehicle decal
      const carDecal = scene.getObjectByName("cover-decal-car") as THREE.Mesh;
      if (carDecal && carDecal.material instanceof THREE.MeshStandardMaterial) {
        carDecal.material.map = tex;
        carDecal.material.needsUpdate = true;
      }
      // Update crate decal
      const crtDecal = scene.getObjectByName("cover-decal-crate") as THREE.Mesh;
      if (crtDecal && crtDecal.material instanceof THREE.MeshStandardMaterial) {
        crtDecal.material.map = tex;
        crtDecal.material.needsUpdate = true;
      }
    });
  };

  if (coverDataUrl) {
    loadCoverTex(coverDataUrl);
  }

  const sedan = buildSedanModel(coverTexture);
  sedan.position.set(-0.6, 0, 0.8);
  sedan.rotation.y = 0.22;
  scene.add(sedan);

  // --- ORBIT CAMERA CONTROLS (Manual Smooth Orbit) ---
  let isDragging = false;
  let prevMouseX = 0;
  let prevMouseY = 0;
  let spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(defaultTarget));

  // Clamps: no upside-down, no below ground
  const minPolarAngle = 0.3;
  const maxPolarAngle = Math.PI / 2 - 0.05; // 87 degrees
  const minDistance = 3.5;
  const maxDistance = 20.0;

  let currentTarget = defaultTarget.clone();
  let desiredTarget = defaultTarget.clone();
  let desiredRadius = spherical.radius;
  let startClickX = 0;
  let startClickY = 0;
  let totalDragDistance = 0;
  let lastDragEndedAt = 0;
  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return; // left click only
    isDragging = true;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
    startClickX = e.clientX;
    startClickY = e.clientY;
    totalDragDistance = 0;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - prevMouseX;
    const dy = e.clientY - prevMouseY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
    totalDragDistance += Math.hypot(dx, dy);

    spherical.theta -= dx * 0.007;
    spherical.phi -= dy * 0.007;
    spherical.phi = Math.max(minPolarAngle, Math.min(maxPolarAngle, spherical.phi));
  };

  const onMouseUp = () => {
    isDragging = false;
    if (totalDragDistance > 6) {
      lastDragEndedAt = performance.now();
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    desiredRadius += e.deltaY * 0.008;
    desiredRadius = Math.max(minDistance, Math.min(maxDistance, desiredRadius));
  };

  // Touch controls for mobile
  let prevTouchDist = 0;
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging = true;
      const t = e.touches[0];
      prevMouseX = t.clientX;
      prevMouseY = t.clientY;
      startClickX = t.clientX;
      startClickY = t.clientY;
      totalDragDistance = 0;
    } else if (e.touches.length === 2) {
      prevTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const t = e.touches[0];
      const dx = t.clientX - prevMouseX;
      const dy = t.clientY - prevMouseY;
      prevMouseX = t.clientX;
      prevMouseY = t.clientY;
      totalDragDistance += Math.hypot(dx, dy);

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

  const onTouchEnd = (e: TouchEvent) => {
    isDragging = false;
    if (totalDragDistance > 6) {
      lastDragEndedAt = performance.now();
    } else if (e.changedTouches.length === 1) {
      // Tap on touch device: dispatch raycast check
      const t = e.changedTouches[0];
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((t.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((t.clientY - rect.top) / rect.height) * 2 + 1;
      raycastObject(mouse);
    }
  };

  // Raycaster for object clicks
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const raycastObject = (coords: THREE.Vector2) => {
    raycaster.setFromCamera(coords, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      for (const hit of intersects) {
        let cur: THREE.Object3D | null = hit.object;
        while (cur && cur !== scene) {
          if (cur.name === "terminal") {
            onObjectClick("terminal");
            return;
          }
          if (cur.name === "print-bay") {
            onObjectClick("print-bay");
            return;
          }
          if (cur.name === "vehicle-sedan" || cur.name === "cover-decal-car") {
            onObjectClick("vehicle");
            return;
          }
          if (cur.name === "crate" || cur.name === "cover-decal-crate") {
            onObjectClick("crate");
            return;
          }
          cur = cur.parent;
        }
      }
    }
  };

  const onClick = (e: MouseEvent) => {
    // Suppress click if pointer moved more than 6 pixels or drag just concluded
    const moved = Math.hypot(e.clientX - startClickX, e.clientY - startClickY);
    const timeSinceDrag = lastDragEndedAt > 0 ? performance.now() - lastDragEndedAt : Infinity;
    if (moved > 6 || totalDragDistance > 6 || timeSinceDrag < 300) {
      return;
    }
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycastObject(mouse);
  };

  const dom = renderer.domElement;
  dom.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  dom.addEventListener("wheel", onWheel, { passive: false });
  dom.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: false });
  dom.addEventListener("click", onClick);

  // Resize handler
  const onResize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  // Animation Loop with smooth lerp
  let animId = 0;
  const clock = new THREE.Clock();

  const animate = () => {
    animId = requestAnimationFrame(animate);
    clock.getDelta();
    // Smooth radius & target lerp
    spherical.radius += (desiredRadius - spherical.radius) * 0.1;
    currentTarget.lerp(desiredTarget, 0.08);

    // Compute camera position from spherical coordinates around target
    const offset = new THREE.Vector3().setFromSpherical(spherical);
    camera.position.copy(currentTarget).add(offset);
    camera.lookAt(currentTarget);

    renderer.render(scene, camera);
  };
  animate();

  return {
    scene,
    camera,
    renderer,
    updateCoverTexture: loadCoverTex,
    focusTarget: (targetPos: THREE.Vector3, camOffset: THREE.Vector3) => {
      desiredTarget.copy(targetPos);
      spherical.setFromVector3(camOffset);
      desiredRadius = spherical.radius;
    },
    resetCamera: () => {
      desiredTarget.copy(defaultTarget);
      spherical.setFromVector3(defaultCamPos.clone().sub(defaultTarget));
      desiredRadius = spherical.radius;
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
      dom.removeEventListener("click", onClick);
      renderer.dispose();
      if (dom.parentElement) {
        dom.parentElement.removeChild(dom);
      }
    },
  };
}
