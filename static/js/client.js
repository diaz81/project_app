import * as THREE from "three";
import { loadVehicle, frameVehicle, createSceneBundle, createMarker } from "./vehicle.js";
import { classificationColor, classificationLabel } from "./classifications.js";

const container = document.getElementById("canvas-container");
const loadingEl = document.getElementById("model-loading");
const { scene, camera, renderer, controls } = createSceneBundle(container);

// Stable container added to the scene right away; its contents (the
// procedural fallback or the loaded GLB) are swapped in once ready.
const vehicle = new THREE.Group();
scene.add(vehicle);

const markersGroup = new THREE.Group();
vehicle.add(markersGroup);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pointsCache = new Map();

const detailModal = document.getElementById("point-detail-modal");
const detailCloseBtn = document.getElementById("detail-close");

async function loadPoints() {
  const res = await fetch("/api/points");
  const data = await res.json();
  data.forEach((pointData) => {
    pointsCache.set(pointData.id, pointData);
    const marker = createMarker(
      new THREE.Vector3(pointData.x, pointData.y, pointData.z),
      pointData.id,
      classificationColor(pointData.classification)
    );
    markersGroup.add(marker);
  });
}

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

// Distinguish a real click from an orbit-drag by measuring pointer travel.
let downPos = null;
renderer.domElement.addEventListener("pointerdown", (e) => {
  downPos = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  if (moved < 6) handleClick(e);
});

function handleClick(event) {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const markerHits = raycaster.intersectObjects(markersGroup.children, false);
  if (markerHits.length > 0) {
    const id = markerHits[0].object.userData.pointId;
    openDetailModal(pointsCache.get(id));
  }
}

function openDetailModal(point) {
  document.getElementById("detail-location").textContent = point.location;
  document.getElementById("detail-classification").textContent = classificationLabel(
    point.classification
  );
  document.getElementById("detail-thickness").textContent = `${point.thickness_mm} mm`;
  document.getElementById("detail-observation").textContent =
    point.observation || "Sin observaciones";
  document.getElementById(
    "detail-coords"
  ).textContent = `X: ${point.x.toFixed(3)}  Y: ${point.y.toFixed(3)}  Z: ${point.z.toFixed(3)}`;
  document.getElementById("detail-date").textContent = point.created_at
    ? new Date(point.created_at).toLocaleString()
    : "-";

  const img = document.getElementById("detail-photo");
  if (point.photo_url) {
    img.src = point.photo_url;
    img.classList.remove("hidden");
  } else {
    img.classList.add("hidden");
    img.removeAttribute("src");
  }

  detailModal.classList.remove("hidden");
}

detailCloseBtn.addEventListener("click", () => detailModal.classList.add("hidden"));

async function initVehicle() {
  const { model, box, isFallback } = await loadVehicle();
  vehicle.add(model);
  frameVehicle(camera, controls, box);
  if (loadingEl) loadingEl.classList.add("hidden");
  if (isFallback) {
    console.info("Vehículo 3D: usando el modelo procedural (no se encontró static/models/car.glb).");
  }
}

initVehicle();
loadPoints();
