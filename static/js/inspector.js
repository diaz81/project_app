import * as THREE from "three";
import { createVehicle, suggestLocation, createSceneBundle, createMarker } from "./vehicle.js";

const container = document.getElementById("canvas-container");
const { scene, camera, renderer } = createSceneBundle(container);

const vehicle = createVehicle();
scene.add(vehicle);

const markersGroup = new THREE.Group();
vehicle.add(markersGroup);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pointsCache = new Map();

const formModal = document.getElementById("point-form-modal");
const formEl = document.getElementById("point-form");
const locationInput = document.getElementById("field-location");
const cancelBtn = document.getElementById("form-cancel");

const detailModal = document.getElementById("point-detail-modal");
const detailCloseBtn = document.getElementById("detail-close");
const detailDeleteBtn = document.getElementById("detail-delete");

let pendingPoint = null; // { x, y, z } waiting to be saved via the form

async function loadPoints() {
  const res = await fetch("/api/points");
  const data = await res.json();
  data.forEach(addMarkerFromData);
}

function addMarkerFromData(pointData) {
  pointsCache.set(pointData.id, pointData);
  const marker = createMarker(
    new THREE.Vector3(pointData.x, pointData.y, pointData.z),
    pointData.id
  );
  markersGroup.add(marker);
}

function removeMarker(id) {
  const marker = markersGroup.children.find((m) => m.userData.pointId === id);
  if (marker) markersGroup.remove(marker);
  pointsCache.delete(id);
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
    return;
  }

  const bodyParts = vehicle.children.filter((c) => c !== markersGroup);
  const bodyHits = raycaster.intersectObjects(bodyParts, false);
  if (bodyHits.length > 0) {
    const hit = bodyHits[0];
    const worldNormal = hit.face.normal
      .clone()
      .transformDirection(hit.object.matrixWorld)
      .normalize();
    const suggestion = suggestLocation(hit.object, worldNormal);
    openCreateModal(hit.point.clone(), suggestion);
  }
}

function openCreateModal(point, suggestion) {
  pendingPoint = point;
  formEl.reset();
  locationInput.value = suggestion;
  formModal.classList.remove("hidden");
}

cancelBtn.addEventListener("click", () => {
  formModal.classList.add("hidden");
  pendingPoint = null;
});

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pendingPoint) return;

  const fd = new FormData(formEl);
  fd.set("x", pendingPoint.x);
  fd.set("y", pendingPoint.y);
  fd.set("z", pendingPoint.z);

  const submitBtn = formEl.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const res = await fetch("/api/points", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "No se pudo guardar el punto.");
      return;
    }
    const created = await res.json();
    addMarkerFromData(created);
    formModal.classList.add("hidden");
    pendingPoint = null;
  } catch (err) {
    alert("Error de red al guardar el punto.");
  } finally {
    submitBtn.disabled = false;
  }
});

function openDetailModal(point) {
  document.getElementById("detail-location").textContent = point.location;
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

  detailModal.dataset.pointId = point.id;
  detailModal.classList.remove("hidden");
}

detailCloseBtn.addEventListener("click", () => detailModal.classList.add("hidden"));

detailDeleteBtn.addEventListener("click", async () => {
  const id = Number(detailModal.dataset.pointId);
  if (!confirm("¿Eliminar este punto de inspección?")) return;
  const res = await fetch(`/api/points/${id}`, { method: "DELETE" });
  if (res.ok) {
    removeMarker(id);
    detailModal.classList.add("hidden");
  } else {
    alert("No se pudo eliminar el punto.");
  }
});

loadPoints();
