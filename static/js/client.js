import * as THREE from "three";
import { loadVehicle, frameVehicle, createSceneBundle, createMarker } from "./vehicle.js";
import { CLASSIFICATIONS, classificationColor, classificationLabel } from "./classifications.js";

const inspectionId = new URLSearchParams(window.location.search).get("inspection_id");

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
  if (!inspectionId) return;
  const res = await fetch(`/api/points?inspection_id=${encodeURIComponent(inspectionId)}`);
  const data = await res.json();
  data.forEach((pointData) => {
    pointsCache.set(pointData.id, pointData);
    const [halo, marker] = createMarker(
      new THREE.Vector3(pointData.x, pointData.y, pointData.z),
      pointData.id,
      classificationColor(pointData.classification)
    );
    markersGroup.add(halo);
    markersGroup.add(marker);
  });
  renderSummary(data);
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

// Summary counters + narrative — computed purely from the points already
// fetched for this inspection, no extra API calls.
const SUMMARY_TILES = [
  { key: "registrado", label: "Sin observaciones" },
  { key: "observacion", label: "Observación" },
  { key: "diferencia_significativa", label: "Diferencia significativa" },
  { key: "evaluacion_adicional", label: "Evaluación adicional recomendada" },
  { key: "sin_referencia", label: "Sin referencia" },
];

function countByClassification(points) {
  const counts = { registrado: 0, observacion: 0, diferencia_significativa: 0, evaluacion_adicional: 0, sin_referencia: 0 };
  points.forEach((p) => {
    if (counts[p.classification] !== undefined) counts[p.classification] += 1;
  });
  return counts;
}

function toCssColor(colorHex) {
  return `#${colorHex.toString(16).padStart(6, "0")}`;
}

function renderSummary(points) {
  const grid = document.getElementById("summary-counters");
  if (!grid) return;
  const counts = countByClassification(points);
  const total = points.length;

  grid.innerHTML = "";
  const totalTile = document.createElement("div");
  totalTile.className = "counter-tile counter-total";
  totalTile.innerHTML = `<span class="counter-value">${total}</span><span class="counter-label">Total de puntos</span>`;
  grid.appendChild(totalTile);

  SUMMARY_TILES.forEach(({ key, label }) => {
    const tile = document.createElement("div");
    tile.className = "counter-tile";
    const color = toCssColor(CLASSIFICATIONS[key].color);
    tile.innerHTML = `<span class="counter-value" style="color:${color}">${counts[key]}</span><span class="counter-label">${label}</span>`;
    grid.appendChild(tile);
  });

  const narrativeEl = document.getElementById("narrative-summary");
  if (narrativeEl) narrativeEl.textContent = buildNarrative(total, counts);
}

function pluralPhrase(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function buildNarrative(total, counts) {
  if (total === 0) {
    return "Todavía no se registraron mediciones para esta inspección.";
  }

  const sentences = [
    `Se registraron ${pluralPhrase(total, "medición", "mediciones")} sobre distintas zonas del vehículo.`,
  ];

  const clauses = [];
  if (counts.registrado > 0) {
    clauses.push(`${pluralPhrase(counts.registrado, "punto no presentó", "puntos no presentaron")} observaciones relevantes`);
  }
  if (counts.observacion > 0) {
    clauses.push(`${pluralPhrase(counts.observacion, "punto quedó", "puntos quedaron")} registrado${counts.observacion === 1 ? "" : "s"} con observación`);
  }
  if (counts.diferencia_significativa > 0) {
    clauses.push(`${pluralPhrase(counts.diferencia_significativa, "zona mostró", "zonas mostraron")} una diferencia significativa`);
  }
  if (counts.evaluacion_adicional > 0) {
    clauses.push(`${pluralPhrase(counts.evaluacion_adicional, "zona quedó marcada", "zonas quedaron marcadas")} para evaluación adicional`);
  }
  if (counts.sin_referencia > 0) {
    clauses.push(`${pluralPhrase(counts.sin_referencia, "punto quedó", "puntos quedaron")} sin referencia disponible`);
  }

  if (clauses.length === 1) {
    sentences.push(clauses[0].charAt(0).toUpperCase() + clauses[0].slice(1) + ".");
  } else if (clauses.length > 1) {
    const joined = clauses.slice(0, -1).join(", ") + ", mientras que " + clauses[clauses.length - 1];
    sentences.push(joined.charAt(0).toUpperCase() + joined.slice(1) + ".");
  }

  return sentences.join(" ");
}

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
