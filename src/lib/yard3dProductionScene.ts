import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAsphaltTexture, createTimberCrateTexture } from "./yard3dTextures";

export interface ProductionYard3DSceneResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  updateCoverTexture: (url: string) => void;
  focusTarget: (position: THREE.Vector3, cameraPos: THREE.Vector3) => void;
  resetCamera: () => void;
  dispose: () => void;
}

export interface ProductionYardLoadingProgress {
  totalItems: number;
  loadedItems: number;
  percent: number;
  item: string;
}

export function initProduction3DYardScene(
  container: HTMLElement,
  coverDataUrl: string | null,
  onObjectClick: (objectName: "terminal" | "print-bay" | "vehicle" | "crate") => void,
  onProgress?: (progress: ProductionYardLoadingProgress) => void,
): ProductionYard3DSceneResult {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  // Scene & Humid Miami night fog
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06080B);
  scene.fog = new THREE.FogExp2(0x06080B, 0.024);

  // Perspective Camera
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 120);
  const defaultCamPos = new THREE.Vector3(6.5, 4.2, 8.5);
  const defaultTarget = new THREE.Vector3(0, 0.8, 0);
  camera.position.copy(defaultCamPos);
  camera.lookAt(defaultTarget);

  // WebGL Renderer with PCFSoft shadows and tone mapping
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  // --- LIGHTING ---
  // Cool night sky ambient illumination
  const hemiLight = new THREE.HemisphereLight(0x1E293B, 0x090D16, 0.7);
  scene.add(hemiLight);

  // Moonlight casting soft realistic shadows
  const moonLight = new THREE.DirectionalLight(0x38BDF8, 1.2);
  moonLight.position.set(14, 22, 12);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 2048;
  moonLight.shadow.mapSize.height = 2048;
  moonLight.shadow.bias = -0.0001;
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 50;
  moonLight.shadow.camera.left = -15;
  moonLight.shadow.camera.right = 15;
  moonLight.shadow.camera.top = 15;
  moonLight.shadow.camera.bottom = -15;
  scene.add(moonLight);

  // Sodium industrial floodlight over the garage workshop (warm amber)
  const garageFlood = new THREE.PointLight(0xF59E0B, 4.2, 22, 1.2);
  garageFlood.position.set(-3.2, 5.0, -1.8);
  garageFlood.castShadow = true;
  garageFlood.shadow.mapSize.width = 1024;
  garageFlood.shadow.mapSize.height = 1024;
  scene.add(garageFlood);

  // Workstation / Kiosk cyan terminal glow
  const kioskGlow = new THREE.PointLight(0x06B6D4, 2.5, 9, 1.3);
  kioskGlow.position.set(3.8, 1.9, 2.2);
  scene.add(kioskGlow);

  // --- ENVIRONMENT GROUND ---
  const asphaltTex = createAsphaltTexture();
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x1E222A,
    map: asphaltTex,
    roughness: 0.32,
    metalness: 0.15,
  });
  const groundGeo = new THREE.PlaneGeometry(36, 36);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  // Ground contact shadow disc under hero vehicle
  const shadowGeo = new THREE.PlaneGeometry(5.4, 2.8);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x030406,
    transparent: true,
    opacity: 0.72,
  });
  const vehicleShadow = new THREE.Mesh(shadowGeo, shadowMat);
  vehicleShadow.position.set(0, 0.02, 0.6);
  scene.add(vehicleShadow);

  // --- DISTANT CITY BACKDROP ---
  // Cylindrical skyline silhouette with subtle window light accents
  const cityCylGeo = new THREE.CylinderGeometry(28, 28, 14, 32, 1, true, 0, Math.PI * 2);
  const cityCanvas = document.createElement("canvas");
  cityCanvas.width = 1024;
  cityCanvas.height = 256;
  const cctx = cityCanvas.getContext("2d");
  if (cctx) {
    cctx.fillStyle = "rgba(4, 6, 9, 0)";
    cctx.fillRect(0, 0, 1024, 256);
    // Dark silhouette towers
    for (let i = 0; i < 60; i++) {
      const bx = i * 17.5;
      const bw = Math.random() * 18 + 12;
      const bh = Math.random() * 140 + 40;
      cctx.fillStyle = "#070A10";
      cctx.fillRect(bx, 256 - bh, bw, bh);

      // Lit office windows
      for (let wy = 256 - bh + 10; wy < 240; wy += 8) {
        if (Math.random() > 0.4) {
          cctx.fillStyle = Math.random() > 0.2 ? "rgba(254, 240, 138, 0.7)" : "rgba(56, 189, 248, 0.6)";
          cctx.fillRect(bx + 3, wy, 2, 3);
        }
        if (Math.random() > 0.5) {
          cctx.fillStyle = "rgba(254, 240, 138, 0.7)";
          cctx.fillRect(bx + 8, wy, 2, 3);
        }
      }
    }
  }
  const cityTex = new THREE.CanvasTexture(cityCanvas);
  cityTex.wrapS = THREE.RepeatWrapping;
  cityTex.wrapT = THREE.ClampToEdgeWrapping;
  const cityMat = new THREE.MeshBasicMaterial({
    map: cityTex,
    transparent: true,
    opacity: 0.85,
    side: THREE.BackSide,
  });
  const cityMesh = new THREE.Mesh(cityCylGeo, cityMat);
  cityMesh.position.set(0, 5.5, 0);
  scene.add(cityMesh);

  // --- EXACT COVER DECAL HOLDERS ---
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

  // --- GLTF LOADING MANAGER ---
  const manager = new THREE.LoadingManager();

  manager.onProgress = (_item, loaded, total) => {
    if (onProgress) {
      onProgress({
        totalItems: total,
        loadedItems: loaded,
        percent: Math.round((loaded / total) * 100),
        item: _item,
      });
    }
  };

  const gltfLoader = new GLTFLoader(manager);

  // 1. LOAD PRODUCTION SEDAN (Generic PBR Sedan model)
  gltfLoader.load(
    "/models/sedan.glb",
    (gltf) => {
      const car = gltf.scene;
      car.name = "vehicle-sedan";

      // Scale and position sedan hero
      car.scale.set(1.15, 1.15, 1.15);
      car.position.set(0, 0, 0.6);
      car.rotation.y = 0.25;

      car.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.envMapIntensity = 1.2;
          }
        }
      });

      // Mount exact 16:7 cover decal on driver/viewer door side (+Z)
      // Exact aspect 16:7 -> 1.40m wide x 0.6125m high
      const decalGeo = new THREE.PlaneGeometry(1.40, 0.6125);
      const decalMat = new THREE.MeshStandardMaterial({
        map: coverTexture,
        roughness: 0.25,
        metalness: 0.05,
        transparent: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const decalMesh = new THREE.Mesh(decalGeo, decalMat);
      decalMesh.name = "cover-decal-car";
      decalMesh.position.set(-0.15, 0.68, 1.055);
      car.add(decalMesh);

      scene.add(car);
    },
    undefined,
    (err) => {
      console.error("[crewmark] Failed to load production sedan.glb:", err);
    },
  );

  // 2. LOAD PRODUCTION WAREHOUSE / PRINT BAY
  gltfLoader.load(
    "/models/warehouse.glb",
    (gltf) => {
      const warehouse = gltf.scene;
      warehouse.name = "print-bay";
      // Position and scale warehouse to realistic building proportions
      // (Bbox is ~12m wide x 3.6m high x 12.4m deep; scale 1.05 gives ~12.6m x 3.8m industrial garage)
      warehouse.scale.set(1.05, 1.05, 1.05);
      warehouse.position.set(-6.5, 0, -4.5);
      warehouse.rotation.y = Math.PI / 2;

      warehouse.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(warehouse);
    },
    undefined,
    (err) => {
      console.error("[crewmark] Failed to load production warehouse.glb:", err);
    },
  );

  // 3. INTERACTIVE CARGO CRATES WITH EXACT COVER DECAL
  const crateGroup = new THREE.Group();
  crateGroup.name = "crate";

  const timberTex = createTimberCrateTexture();
  const crateMat = new THREE.MeshStandardMaterial({
    map: timberTex,
    roughness: 0.75,
    metalness: 0.1,
  });

  const crateGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const crateMesh = new THREE.Mesh(crateGeo, crateMat);
  crateMesh.position.y = 0.75;
  crateMesh.castShadow = true;
  crateMesh.receiveShadow = true;
  crateGroup.add(crateMesh);

  // Stacked secondary crate
  const smallCrateGeo = new THREE.BoxGeometry(1.15, 1.15, 1.15);
  const smallCrate = new THREE.Mesh(smallCrateGeo, crateMat);
  smallCrate.position.set(0.15, 2.05, -0.1);
  smallCrate.rotation.y = 0.2;
  smallCrate.castShadow = true;
  crateGroup.add(smallCrate);

  // Decal label on main crate side (+Z)
  // Exact 16:7 aspect ratio (0.96m x 0.42m)
  const crateLabelGeo = new THREE.PlaneGeometry(0.96, 0.42);
  const crateLabelMat = new THREE.MeshStandardMaterial({
    map: coverTexture,
    roughness: 0.4,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const crateLabel = new THREE.Mesh(crateLabelGeo, crateLabelMat);
  crateLabel.name = "cover-decal-crate";
  crateLabel.position.set(0, 0.8, 0.755);
  crateGroup.add(crateLabel);

  crateGroup.position.set(2.4, 0, -2.5);
  scene.add(crateGroup);

  // 4. INTERACTIVE TERMINAL KIOSK
  const kioskGroup = new THREE.Group();
  kioskGroup.name = "terminal";

  const standGeo = new THREE.BoxGeometry(0.55, 1.1, 0.45);
  const kioskMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.4, metalness: 0.5 });
  const stand = new THREE.Mesh(standGeo, kioskMat);
  stand.position.y = 0.55;
  stand.castShadow = true;
  kioskGroup.add(stand);

  // Glowing terminal screen
  const screenGeo = new THREE.BoxGeometry(0.72, 0.52, 0.08);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x06B6D4 });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 1.25, 0.05);
  screen.rotation.x = -0.32;
  kioskGroup.add(screen);

  kioskGroup.position.set(4.2, 0, 1.8);
  scene.add(kioskGroup);

  // Concrete security barriers along yard perimeter
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
  for (let i = 0; i < 4; i++) {
    const bGeo = new THREE.BoxGeometry(2.4, 0.8, 0.4);
    const barrier = new THREE.Mesh(bGeo, barrierMat);
    barrier.position.set(-1.0 + i * 2.5, 0.4, 6.2);
    barrier.castShadow = true;
    barrier.receiveShadow = true;
    scene.add(barrier);
  }

  // --- ORBIT CONTROLS & CAMERA INTERACTION ---
  let isDragging = false;
  let prevMouseX = 0;
  let prevMouseY = 0;
  let startClickX = 0;
  let startClickY = 0;
  let totalDragDistance = 0;
  let lastDragEndedAt = 0;

  const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(defaultTarget));
  const minPolarAngle = 0.35;
  const maxPolarAngle = Math.PI / 2 - 0.05; // ~87 degrees
  const minDistance = 3.5;
  const maxDistance = 18.0;

  let currentTarget = defaultTarget.clone();
  let desiredTarget = defaultTarget.clone();
  let desiredRadius = spherical.radius;

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
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
    currentTarget.lerp(desiredTarget, 0.08);

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
