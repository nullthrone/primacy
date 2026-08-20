import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Engine, webgl2Available } from './core/Engine.js';
import { TimeEngine } from './core/TimeEngine.js';
import { ScaleManager } from './core/ScaleManager.js';
import { Materials } from './core/Materials.js';
import { SystemScene } from './scenes/SystemScene.js';
import { sol } from './data/sol.js';

const canvas = document.getElementById('scene');
const loadingEl = document.getElementById('loading');

function fatal() {
  document.getElementById('fatal').hidden = false;
  loadingEl.classList.add('done');
}

async function boot() {
  if (!webgl2Available()) {
    fatal();
    return;
  }

  const engine = new Engine(canvas);
  const time = new TimeEngine();
  const scale = new ScaleManager();
  time.setSpeed(250000); // ~2.9 simulated days per second at boot

  const materials = new Materials();
  const progressEl = document.getElementById('loading-progress');
  await materials.init((f) => {
    progressEl.style.width = `${Math.round(f * 100)}%`;
  });

  const system = new SystemScene({ def: sol, engine, time, scale, materials });
  engine.setScene(system.scene);

  engine.onFrame((dt) => {
    time.tick(dt);
    system.update(dt);
  });

  engine.camera.position.set(0, 300, 560);
  engine.camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(engine.camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxDistance = 20000;
  engine.onFrame(() => controls.update());

  engine.start();

  const _pos = new THREE.Vector3();
  const app = {
    controls,
    ready: false,
    version: '1.0.0',
    engine,
    time,
    scale,
    system,
    materials,
    fps: () => engine.fps,
    setJD: (jd) => time.setJD(jd),
    setSpeed: (s) => time.setSpeed(s),
    setPaused: (p) => time.setPaused(p),
    setScaleMode: (m) => scale.setMode(m),
    listBodies: () => [system.def.star.id, ...system.def.bodies.map((b) => b.id)],
    bodyPos: (id) => {
      const p = system.worldPosOf(id, _pos);
      return p ? [p.x, p.y, p.z] : null;
    },
    probe: (x, y, w, h) => engine.probe(x, y, w, h),
    info: () => ({
      jd: time.jd,
      speed: time.speed,
      paused: time.paused,
      scaleMode: scale.mode,
      fps: engine.fps,
      system: system.def.id,
      ...engine.rendererInfo(),
    }),
  };
  window.__APP__ = app;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    loadingEl.classList.add('done');
    app.ready = true;
  }));
}

boot().catch((err) => {
  console.error('boot failed', err);
  fatal();
});
