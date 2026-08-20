import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Engine, webgl2Available } from './core/Engine.js';
import { TimeEngine } from './core/TimeEngine.js';
import { StarBody } from './bodies/StarBody.js';

const canvas = document.getElementById('scene');
const loadingEl = document.getElementById('loading');

function fatal() {
  document.getElementById('fatal').hidden = false;
  loadingEl.classList.add('done');
}

function boot() {
  if (!webgl2Available()) {
    fatal();
    return;
  }

  const engine = new Engine(canvas);
  engine.camera.lookAt(0, 0, 0);
  const time = new TimeEngine();
  engine.onFrame((dt) => time.tick(dt));

  // --- M1 scene: the Sun (SystemScene takes over in M2) ---
  const scene = engine.scene;
  scene.background = new THREE.Color(0x020308);

  const sun = new StarBody({ id: 'sun', teffK: 5772, activity: 0.35, seed: 7 });
  sun.setRadius(9.3);
  scene.add(sun.group);
  engine.onFrame((dt) => sun.update(dt, engine.camera));

  engine.camera.position.set(0, 8, 46);
  engine.camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(engine.camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  engine.onFrame(() => controls.update());

  engine.start();

  // Debug / verification surface. Grows with each milestone.
  const app = {
    ready: false,
    version: '1.0.0',
    engine,
    time,
    fps: () => engine.fps,
    setJD: (jd) => time.setJD(jd),
    setSpeed: (s) => time.setSpeed(s),
    setPaused: (p) => time.setPaused(p),
    probe: (x, y, w, h) => engine.probe(x, y, w, h),
    info: () => ({
      jd: time.jd,
      speed: time.speed,
      paused: time.paused,
      fps: engine.fps,
      ...engine.rendererInfo(),
    }),
  };
  window.__APP__ = app;

  // Mark ready after the first real frame hit the screen.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    loadingEl.classList.add('done');
    app.ready = true;
  }));
}

boot();
