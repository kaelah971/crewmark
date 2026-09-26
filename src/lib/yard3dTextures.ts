// Procedural asphalt, metal, and concrete textures for P7A diorama
import * as THREE from "three";

/** Create procedural asphalt texture with roughness, damp sheen, and subtle noise */
export function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Dark asphalt base
  ctx.fillStyle = "#121418";
  ctx.fillRect(0, 0, 512, 512);

  // Gravel/grime noise
  for (let i = 0; i < 40000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = Math.floor(Math.random() * 30 + 15);
    ctx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 5})`;
    ctx.fillRect(x, y, Math.random() > 0.8 ? 2 : 1, Math.random() > 0.8 ? 2 : 1);
  }

  // Wet puddle patches / oil slicks
  for (let p = 0; p < 8; p++) {
    const cx = Math.random() * 512;
    const cy = Math.random() * 512;
    const r = Math.random() * 60 + 20;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    grad.addColorStop(0, "rgba(5, 7, 10, 0.65)");
    grad.addColorStop(0.7, "rgba(10, 12, 16, 0.35)");
    grad.addColorStop(1, "rgba(18, 20, 24, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Faint service line markings
  ctx.strokeStyle = "rgba(217, 119, 6, 0.18)";
  ctx.lineWidth = 14;
  ctx.setLineDash([30, 25]);
  ctx.beginPath();
  ctx.moveTo(120, 0);
  ctx.lineTo(120, 512);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

/** Create corrugated industrial metal texture for building siding */
export function createCorrugatedMetalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "#1E2229";
  ctx.fillRect(0, 0, 256, 256);

  // Vertical ridges
  for (let x = 0; x < 256; x += 16) {
    const grad = ctx.createLinearGradient(x, 0, x + 16, 0);
    grad.addColorStop(0, "#2B323D");
    grad.addColorStop(0.5, "#15181E");
    grad.addColorStop(1, "#2B323D");
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 16, 256);
  }

  // Weathering streaks
  for (let s = 0; s < 12; s++) {
    const sx = Math.random() * 256;
    ctx.fillStyle = "rgba(10, 8, 5, 0.35)";
    ctx.fillRect(sx, 0, Math.random() * 8 + 2, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  return texture;
}

/** Create shipping crate stenciled timber texture */
export function createTimberCrateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Wood base
  ctx.fillStyle = "#4A3B2C";
  ctx.fillRect(0, 0, 256, 256);

  // Horizontal wood planks
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = (y / 32) % 2 === 0 ? "#524231" : "#443527";
    ctx.fillRect(0, y, 256, 30);
    ctx.fillStyle = "#221912";
    ctx.fillRect(0, y + 30, 256, 2);
  }

  // Outer border bracing
  ctx.strokeStyle = "#2E2419";
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 246);

  // Cross diagonal brace
  ctx.beginPath();
  ctx.moveTo(10, 10);
  ctx.lineTo(246, 246);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
