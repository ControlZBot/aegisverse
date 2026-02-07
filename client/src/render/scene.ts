import * as THREE from 'three';
import type { DebugState, SimState } from '@client/sim/types';
import { getElementById } from '@client/elements/registry';
import { QUALITY_PRESETS } from '@shared/constants';

export type RenderHandles = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  farPoints: THREE.Points;
  nearInstances: THREE.InstancedMesh;
  rigidMeshes: Map<string, THREE.Mesh>;
  colliderHelpers: THREE.Group;
  velocityLines: THREE.LineSegments;
  positions: Float32Array;
  colors: Float32Array;
};

const MAX_RENDER_PARTICLES = 32000;

export function createRenderer(host: HTMLElement): RenderHandles {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0f1318');
  scene.fog = new THREE.Fog('#0f1318', 35, 220);

  const camera = new THREE.PerspectiveCamera(58, host.clientWidth / host.clientHeight, 0.1, 1200);
  camera.position.set(0, 14, 28);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.append(renderer.domElement);

  scene.add(new THREE.HemisphereLight('#a4adb6', '#0a0d10', 0.7));
  const dir = new THREE.DirectionalLight('#f0efe9', 0.9);
  dir.position.set(14, 24, 6);
  scene.add(dir);

  const farGeometry = new THREE.BufferGeometry();
  farGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_RENDER_PARTICLES * 3), 3));
  farGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_RENDER_PARTICLES * 3), 3));
  farGeometry.setDrawRange(0, 0);
  const farPoints = new THREE.Points(farGeometry, new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0.8 }));
  scene.add(farPoints);

  const nearInstances = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.04, color: '#8f9daa' }),
    4000
  );
  nearInstances.count = 0;
  scene.add(nearInstances);

  const rigidMeshes = new Map<string, THREE.Mesh>();
  const colliderHelpers = new THREE.Group();
  scene.add(colliderHelpers);

  const velocityLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#7f90a2', transparent: true, opacity: 0.35 }));
  scene.add(velocityLines);

  const stars = new THREE.Points(starFieldGeometry(1200), new THREE.PointsMaterial({ color: '#7c8b97', size: 0.22, transparent: true, opacity: 0.6 }));
  scene.add(stars);

  window.addEventListener('resize', () => {
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
  });

  return {
    scene,
    camera,
    renderer,
    farPoints,
    nearInstances,
    rigidMeshes,
    colliderHelpers,
    velocityLines,
    positions: farGeometry.attributes.position.array as Float32Array,
    colors: farGeometry.attributes.color.array as Float32Array
  };
}

export function drawState(handles: RenderHandles, state: SimState, debug: DebugState): void {
  const lod = QUALITY_PRESETS[state.quality];
  let farCount = 0;
  let nearCount = 0;
  const dummy = new THREE.Object3D();

  for (let i = 0; i < state.particles.length && i < MAX_RENDER_PARTICLES; i += 1) {
    const p = state.particles[i];
    const dist = Math.hypot(p.x - handles.camera.position.x, p.y - handles.camera.position.y, p.z - handles.camera.position.z);
    if (dist < lod.lodNear && nearCount < 4000) {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(phaseScale(p.phase));
      dummy.updateMatrix();
      handles.nearInstances.setMatrixAt(nearCount, dummy.matrix);
      nearCount += 1;
    }
    if (dist < lod.lodFar && farCount < MAX_RENDER_PARTICLES) {
      const idx = farCount * 3;
      handles.positions[idx] = p.x;
      handles.positions[idx + 1] = p.y;
      handles.positions[idx + 2] = p.z;

      const c = debug.thermal ? thermalColor(p.t) : new THREE.Color(getElementById(p.e).color);
      handles.colors[idx] = c.r;
      handles.colors[idx + 1] = c.g;
      handles.colors[idx + 2] = c.b;
      farCount += 1;
    }
  }

  handles.nearInstances.count = nearCount;
  handles.nearInstances.instanceMatrix.needsUpdate = true;

  const farGeometry = handles.farPoints.geometry as THREE.BufferGeometry;
  farGeometry.setDrawRange(0, farCount);
  farGeometry.attributes.position.needsUpdate = true;
  farGeometry.attributes.color.needsUpdate = true;

  syncRigidMeshes(handles, state, debug.colliders);
  updateVelocityLines(handles, state, debug.velocity);
  handles.colliderHelpers.visible = debug.colliders;
  handles.renderer.render(handles.scene, handles.camera);
}

function phaseScale(phase: number): number {
  return phase === 2 ? 0.65 : phase === 1 ? 0.9 : 1;
}

function syncRigidMeshes(handles: RenderHandles, state: SimState, showColliders: boolean): void {
  const texture = getProceduralTexture();
  for (const body of state.rigidBodies) {
    let mesh = handles.rigidMeshes.get(body.id);
    if (!mesh) {
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: body.kind === 'star' ? 0.25 : body.kind === 'ship' ? 0.4 : 0.85,
        metalness: body.kind === 'ship' ? 0.6 : 0.1,
        emissive: body.kind === 'star' ? '#f4bf8f' : '#000000',
        emissiveIntensity: body.kind === 'star' ? 0.55 : 0
      });
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), mat);
      handles.scene.add(mesh);
      handles.rigidMeshes.set(body.id, mesh);
    }
    mesh.position.set(body.x, body.y, body.z);
    mesh.scale.setScalar(body.radius);
  }

  handles.colliderHelpers.clear();
  if (showColliders) {
    for (const body of state.rigidBodies) {
      const helper = new THREE.Mesh(new THREE.SphereGeometry(body.radius, 16, 16), new THREE.MeshBasicMaterial({ color: '#8998a7', wireframe: true, transparent: true, opacity: 0.2 }));
      helper.position.set(body.x, body.y, body.z);
      handles.colliderHelpers.add(helper);
    }
  }
}

function updateVelocityLines(handles: RenderHandles, state: SimState, show: boolean): void {
  if (!show) {
    handles.velocityLines.visible = false;
    return;
  }
  handles.velocityLines.visible = true;
  const stride = Math.max(1, Math.floor(state.particles.length / 260));
  const verts: number[] = [];
  for (let i = 0; i < state.particles.length; i += stride) {
    const p = state.particles[i];
    verts.push(p.x, p.y, p.z, p.x + p.vx * 0.06, p.y + p.vy * 0.06, p.z + p.vz * 0.06);
  }
  handles.velocityLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
}

function thermalColor(kelvin: number): THREE.Color {
  const t = Math.max(150, Math.min(1800, kelvin));
  const n = (t - 150) / 1650;
  return new THREE.Color().setHSL(0.6 - n * 0.58, 0.5, 0.5);
}

function starFieldGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  let seed = 345678901;
  const rand = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i += 1) {
    const r = 220 + rand() * 300;
    const a = rand() * Math.PI * 2;
    const y = (rand() - 0.5) * 220;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geom;
}

let cachedProceduralTexture: THREE.CanvasTexture | null = null;
function getProceduralTexture(): THREE.CanvasTexture {
  if (!cachedProceduralTexture) cachedProceduralTexture = createProceduralTexture();
  return cachedProceduralTexture;
}

function createProceduralTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.fillStyle = '#646f79';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      const shade = 90 + ((x + y) % 16);
      ctx.fillStyle = `rgb(${shade},${shade},${shade + 4})`;
      ctx.fillRect(x, y, 8, 8);
    }
  }
  return new THREE.CanvasTexture(canvas);
}
