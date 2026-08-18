// Shared Three.js helpers: builds the procedural vehicle, the base scene
// (camera, lights, ground, orbit controls) and inspection-point markers.
// Kept dependency-free besides three.js so both inspector.js and client.js
// can reuse the exact same 3D setup.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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
  if (part === "Chasis" && worldNormal) {
    const n = worldNormal;
    if (Math.abs(n.y) > 0.7) return n.y > 0 ? "Techo del chasis" : "Parte inferior del chasis";
    if (Math.abs(n.z) > 0.6) return n.z > 0 ? "Lateral derecho" : "Lateral izquierdo";
    if (Math.abs(n.x) > 0.6) return n.x > 0 ? "Frente del vehículo" : "Parte trasera del vehículo";
  }
  return part;
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

export function createMarker(position, id, colorHex = 0xffc107) {
  const geo = new THREE.SphereGeometry(0.06, 16, 16);
  const baseColor = new THREE.Color(colorHex);
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    emissive: baseColor.clone().multiplyScalar(0.35),
    emissiveIntensity: 0.6,
  });
  const marker = new THREE.Mesh(geo, mat);
  marker.position.copy(position);
  marker.userData.pointId = id;
  marker.userData.isMarker = true;
  marker.castShadow = true;
  return marker;
}
