import * as THREE from 'three';
import { Engine, webgl2Available } from './core/Engine.js';
import { TimeEngine } from './core/TimeEngine.js';

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

  // --- M0 placeholder scene (replaced by SystemScene in M1/M2) ---
  const scene = engine.scene;
  scene.background = new THREE.Color(0x04060c);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(4, 48, 24),
    new THREE.MeshStandardMaterial({ color: 0x3b76c4, roughness: 0.6, metalness: 0.05 })
  );
  scene.add(sphere);
  const sun = new THREE.PointLight(0xfff2dd, 3, 0, 0);
  sun.position.set(30, 18, 22);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x223044, 0.6));
  engine.onFrame((dt) => { sphere.rotation.y += dt * 0.3; });

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
