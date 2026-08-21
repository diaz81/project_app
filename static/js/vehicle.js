// Shared Three.js helpers: builds the procedural vehicle, the base scene
// (camera, lights, ground, orbit controls) and inspection-point markers.
// Kept dependency-free besides three.js so both inspector.js and client.js
// can reuse the exact same 3D setup.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const GLB_MODEL_URL = "/static/models/car.glb";

// Generic part labels that should get the click-normal refinement
// (top/bottom/left/right/front/back) in suggestLocation(). "Chasis" is the
// procedural car's main body; the GLTF label is used when a loaded mesh has
// no usable name of its own.
const GLTF_GENERIC_PART_NAME = "Carrocería del vehículo";
const GENERIC_PART_NAMES = new Set(["Chasis", GLTF_GENERIC_PART_NAME]);

export function createVehicle() {
  const group = new THREE.Group();
  group.name = "vehicle";

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc62828, metalness: 0.4, roughness: 0.35 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x8b1e1e, metalness: 0.3, roughness: 0.45 });
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.2, roughness: 0.6 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x88ccee,
    transparent: true,
    opacity: 0.35,
    metalness: 0.1,
    roughness: 0.1,
  });

  // Chassis (main body) — x: front/back, y: up, z: left/right
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 1.9), bodyMat);
  chassis.position.set(0, 0.75, 0);
  chassis.userData.partName = "Chasis";
  group.add(chassis);

  // Cabin / roof
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 1.7), cabinMat);
  cabin.position.set(-0.2, 1.55, 0);
  cabin.userData.partName = "Techo / cabina";
  group.add(cabin);

  // Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.65, 1.6), glassMat);
  windshield.position.set(0.78, 1.5, 0);
  windshield.rotation.z = Math.PI / 10;
  windshield.userData.partName = "Parabrisas";
  group.add(windshield);

  // Bumpers
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 1.85), bumperMat);
  frontBumper.position.set(2.15, 0.55, 0);
  frontBumper.userData.partName = "Parachoques delantero";
  group.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 1.85), bumperMat);
  rearBumper.position.set(-2.15, 0.55, 0);
  rearBumper.userData.partName = "Parachoques trasero";
  group.add(rearBumper);

  // Wheels
  const wheelPositions = [
    { x: 1.4, z: 1.0, name: "Rueda delantera derecha" },
    { x: 1.4, z: -1.0, name: "Rueda delantera izquierda" },
    { x: -1.4, z: 1.0, name: "Rueda trasera derecha" },
    { x: -1.4, z: -1.0, name: "Rueda trasera izquierda" },
  ];
  wheelPositions.forEach((pos) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 24), wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(pos.x, 0.45, pos.z);
    wheel.userData.partName = pos.name;
    group.add(wheel);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.37, 16), hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.copy(wheel.position);
    hub.userData.partName = pos.name;
    group.add(hub);
  });

  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}

// Suggests a human-readable location label from the clicked mesh + world normal.
export function suggestLocation(mesh, worldNormal) {
  const part = mesh.userData.partName || "Vehículo";
  if (GENERIC_PART_NAMES.has(part) && worldNormal) {
    const n = worldNormal;
    if (Math.abs(n.y) > 0.7) return n.y > 0 ? "Techo del chasis" : "Parte inferior del chasis";
    if (Math.abs(n.z) > 0.6) return n.z > 0 ? "Lateral derecho" : "Lateral izquierdo";
    if (Math.abs(n.x) > 0.6) return n.x > 0 ? "Frente del vehículo" : "Parte trasera del vehículo";
  }
  return part;
}

// Turns a raw glTF mesh name into a readable label, or null if it looks like
// an auto-generated id (e.g. "Mesh_0", "Object_12") not worth showing.
function humanizePartName(rawName) {
  if (!rawName) return null;
  const trimmed = rawName.trim();
  if (!trimmed) return null;
  if (/^(mesh|node|object|group|geometry|scene)[\s_.-]*\d*$/i.test(trimmed)) return null;
  return trimmed.replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
}

function tagGLTFParts(model) {
  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.userData.partName = humanizePartName(obj.name) || GLTF_GENERIC_PART_NAME;
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

// The procedural car's own bounding-box size, used as the target size when
// normalizing a loaded GLB so it occupies roughly the same footprint the
// scene/camera defaults were tuned for.
const REFERENCE_SIZE = (() => {
  const box = new THREE.Box3().setFromObject(createVehicle());
  const size = new THREE.Vector3();
  box.getSize(size);
  return Math.max(size.x, size.y, size.z) || 4.2;
})();

// Scales `object3D` so its largest dimension matches targetSize, centers it
// on X/Z and rests it on the ground plane (y = 0). Returns the final
// world-space bounding box.
function normalizeAndCenterModel(object3D, targetSize) {
  const rawBox = new THREE.Box3().setFromObject(object3D);
  const rawSize = new THREE.Vector3();
  rawBox.getSize(rawSize);
  const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1;
  const scale = targetSize / maxDim;
  object3D.scale.setScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(object3D);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  object3D.position.x -= center.x;
  object3D.position.z -= center.z;
  object3D.position.y -= scaledBox.min.y;

  return new THREE.Box3().setFromObject(object3D);
}

// Loads static/models/car.glb via GLTFLoader. If the file is missing or
// fails to parse, falls back to the procedural car so the app keeps working.
export async function loadVehicle() {
  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync(GLB_MODEL_URL);
    const model = gltf.scene || gltf.scenes[0];
    tagGLTFParts(model);
    const box = normalizeAndCenterModel(model, REFERENCE_SIZE);
    return { model, box, isFallback: false };
  } catch (err) {
    console.warn(
      `No se pudo cargar ${GLB_MODEL_URL}; usando el vehículo procedural de respaldo.`,
      err
    );
    const model = createVehicle();
    const box = new THREE.Box3().setFromObject(model);
    return { model, box, isFallback: true };
  }
}

// Points the camera and OrbitControls at `box` so the vehicle is centered
// and fully visible, regardless of the loaded model's own scale/units.
export function frameVehicle(camera, controls, box) {
  const center = new THREE.Vector3();
  box.getCenter(center);
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  const radius = Math.max(sphere.radius, 0.5);

  const distance = radius * 2.4;
  camera.position.set(center.x + distance * 0.55, center.y + distance * 0.42, center.z + distance * 0.55);
  camera.near = Math.max(0.01, radius / 100);
  camera.far = Math.max(100, distance * 6);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.minDistance = radius * 1.1;
  controls.maxDistance = radius * 6;
  controls.update();
}

export function createSceneBundle(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161a);

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(5, 3.5, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2a2a, 1.1);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.4);
  dir.position.set(6, 8, 4);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.left = -6;
  dir.shadow.camera.right = 6;
  dir.shadow.camera.top = 6;
  dir.shadow.camera.bottom = -6;
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 20;
  scene.add(dir);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(8, 48),
    new THREE.MeshStandardMaterial({ color: 0x1e2126, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.target.set(0, 0.8, 0);

  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return { scene, camera, renderer, controls };
}

// Returns [haloMesh, markerMesh] — two siblings meant to be added directly
// to the same flat group (e.g. markersGroup.add(halo); markersGroup.add(marker)).
// Keeping them as flat siblings (not a parent/child Group) means existing
// non-recursive raycasts against the group's children keep working exactly
// as before; both meshes carry the same userData.pointId so either one
// resolves to the same point.
//
// The halo is an inverted-hull outline (slightly larger sphere, back faces
// only, bright neutral white) so the marker stays visible with clear
// contrast regardless of the vehicle's paint color or the scene lighting.
export function createMarker(position, id, colorHex = 0xffc107) {
  const baseColor = new THREE.Color(colorHex);

  const haloGeo = new THREE.SphereGeometry(0.09, 20, 20);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.BackSide,
    toneMapped: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.copy(position);
  halo.userData.pointId = id;
  halo.userData.isMarker = true;
  halo.userData.isMarkerHalo = true;
  halo.renderOrder = 1;

  const geo = new THREE.SphereGeometry(0.065, 20, 20);
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    emissive: baseColor.clone().multiplyScalar(0.5),
    emissiveIntensity: 1,
    roughness: 0.35,
    metalness: 0.05,
  });
  const marker = new THREE.Mesh(geo, mat);
  marker.position.copy(position);
  marker.userData.pointId = id;
  marker.userData.isMarker = true;
  marker.castShadow = true;
  marker.renderOrder = 2;

  return [halo, marker];
}
