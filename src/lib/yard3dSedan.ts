import * as THREE from "three";

/** Create an automotive-proportioned sedan with wheels, windows, headlights, and decal mount */
export function buildSedanModel(coverTexture: THREE.Texture | null): THREE.Group {
  const car = new THREE.Group();
  car.name = "vehicle-sedan";

  // Body paint material (glossy dark metallic graphite with reflection)
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1A1D24,
    metalness: 0.7,
    roughness: 0.25,
  });

  // Darkened glass
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x050709,
    metalness: 0.9,
    roughness: 0.1,
  });

  // Black plastic / trim / tires
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0A0B0E,
    metalness: 0.1,
    roughness: 0.8,
  });

  // Chrome rims
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xC0C8D0,
    metalness: 0.9,
    roughness: 0.2,
  });

  // Lower chassis / main body (Length 4.6, Width 1.9, Height 0.6)
  const lowerGeo = new THREE.BoxGeometry(4.6, 0.65, 1.9);
  const lowerBody = new THREE.Mesh(lowerGeo, bodyMat);
  lowerBody.position.y = 0.55;
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  car.add(lowerBody);

  // Cabin / greenhouse (Length 2.5, Width 1.6, Height 0.6)
  const cabinGeo = new THREE.BoxGeometry(2.5, 0.62, 1.6);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(-0.2, 1.15, 0);
  cabin.castShadow = true;
  car.add(cabin);

  // Roof cap
  const roofGeo = new THREE.BoxGeometry(2.4, 0.08, 1.55);
  const roof = new THREE.Mesh(roofGeo, bodyMat);
  roof.position.set(-0.2, 1.48, 0);
  roof.castShadow = true;
  car.add(roof);

  // Wheels (4 wheels: front left/right, rear left/right)
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 20);
  wheelGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.29, 12);
  rimGeo.rotateX(Math.PI / 2);

  const wheelPositions: [number, number, number][] = [
    [1.4, 0.36, 0.95],
    [1.4, 0.36, -0.95],
    [-1.4, 0.36, 0.95],
    [-1.4, 0.36, -0.95],
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const tire = new THREE.Mesh(wheelGeo, trimMat);
    tire.position.set(x, y, z);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    tire.add(rim);
    car.add(tire);
  });

  // Headlights (warm white xenon)
  const headGeo = new THREE.BoxGeometry(0.1, 0.16, 0.4);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xFFFBE8 });
  const headL = new THREE.Mesh(headGeo, headMat);
  headL.position.set(2.3, 0.65, 0.65);
  const headR = new THREE.Mesh(headGeo, headMat);
  headR.position.set(2.3, 0.65, -0.65);
  car.add(headL, headR);

  // Taillights (ruby red)
  const tailGeo = new THREE.BoxGeometry(0.1, 0.14, 0.42);
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xE11D48 });
  const tailL = new THREE.Mesh(tailGeo, tailMat);
  tailL.position.set(-2.3, 0.68, 0.65);
  const tailR = new THREE.Mesh(tailGeo, tailMat);
  tailR.position.set(-2.3, 0.68, -0.65);
  car.add(tailL, tailR);

  // Exact Cover Decal Mesh on the driver/viewer-facing side (+Z door panel)
  // Proportioned to exact 16:7 aspect ratio (1.37m x 0.60m)
  const decalGeo = new THREE.PlaneGeometry(1.37, 0.60);
  const decalMat = new THREE.MeshStandardMaterial({
    map: coverTexture,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const decalMesh = new THREE.Mesh(decalGeo, decalMat);
  decalMesh.name = "cover-decal-car";
  // Offset slightly forward on door and +Z face
  decalMesh.position.set(-0.1, 0.58, 0.955);
  decalMesh.receiveShadow = true;
  car.add(decalMesh);

  // Ground contact shadow disc
  const shadowGeo = new THREE.PlaneGeometry(5.2, 2.6);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x050709,
    transparent: true,
    opacity: 0.65,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.02;
  car.add(shadowMesh);

  return car;
}
