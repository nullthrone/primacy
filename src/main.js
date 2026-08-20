import * as THREE from 'three';
import { Engine, webgl2Available } from './core/Engine.js';
import { TimeEngine } from './core/TimeEngine.js';
import { ScaleManager } from './core/ScaleManager.js';
import { Materials } from './core/Materials.js';
import { FlareOverlay } from './core/FlareOverlay.js';
import { CameraRig } from './core/CameraRig.js';
import { Picker } from './core/Picker.js';
import { LabelManager } from './ui/LabelManager.js';
import { SystemScene } from './scenes/SystemScene.js';
import { sol } from './data/sol.js';

const canvas = document.getElementById('scene');
const loadingEl = document.getElementById('loading');

function fatal() {
  document.getElementById('fatal').hidden = false;
  loadingEl.classList.add('done');
}

function fallbackName(ctl) {
  return ctl.id.charAt(0).toUpperCase() + ctl.id.slice(1);
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

  const rig = new CameraRig(engine, canvas);
  engine.camera.position.set(0, 300, 560);
  rig.controls.target.set(0, 0, 0);

  const labels = new LabelManager(
    engine,
    document.getElementById('labels'),
    (ctl) => fallbackName(ctl),
    (id) => app.select(id)
  );
  labels.attach([...system.controllers.values()]);

  new Picker(engine, canvas, () => system.controllers.values(), (id) => app.select(id));

  const flare = new FlareOverlay(engine);

  engine.onFrame((dt) => {
    time.tick(dt);
    system.update(dt);
    rig.update(dt);
    labels.update();
    flare.track(system.star.worldPos);
  });

  engine.start();

  const _pos = new THREE.Vector3();
  const selectListeners = new Set();
  const app = {
    engine,
    time,
    scale,
    system,
    materials,
    rig,
    labels,
    controls: rig.controls,
    ready: false,
    version: '1.0.0',
    selected: null,
    fps: () => engine.fps,
    setJD: (jd) => time.setJD(jd),
    setSpeed: (s) => time.setSpeed(s),
    setPaused: (p) => time.setPaused(p),
    setScaleMode: (m) => scale.setMode(m),
    onSelect: (fn) => { selectListeners.add(fn); return () => selectListeners.delete(fn); },
    select: (id) => {
      const ctl = system.controllers.get(id);
      if (!ctl) return false;
      app.selected = id;
      rig.flyTo(ctl);
      for (const fn of selectListeners) fn(id, ctl);
      return true;
    },
    deselect: () => {
      app.selected = null;
      rig.stop();
      for (const fn of selectListeners) fn(null, null);
    },
    listBodies: () => [system.def.star.id, ...system.def.bodies.map((b) => b.id)],
    bodyPos: (id) => {
      const p = system.worldPosOf(id, _pos);
      return p ? [p.x, p.y, p.z] : null;
    },
    bodyScreen: (id) => {
      const p = system.worldPosOf(id, _pos);
      if (!p) return null;
      p.project(engine.camera);
      return {
        x: (p.x * 0.5 + 0.5) * window.innerWidth,
        y: (-p.y * 0.5 + 0.5) * window.innerHeight,
        z: p.z,
      };
    },
    debugMarkers: () => labels.markersVisible(),
    probe: (x, y, w, h) => engine.probe(x, y, w, h),
    info: () => ({
      jd: time.jd,
      speed: time.speed,
      paused: time.paused,
      scaleMode: scale.mode,
      scaleBlend: scale.blend,
      selected: app.selected,
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
