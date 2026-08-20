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
import { t, onLang } from './ui/i18n.js';
import { UI } from './ui/UI.js';
import { InfoPanel } from './ui/InfoPanel.js';
import { NavTree } from './ui/NavTree.js';
import { TimeControls } from './ui/TimeControls.js';
import { HashRouter } from './ui/HashRouter.js';

const canvas = document.getElementById('scene');
const loadingEl = document.getElementById('loading');

function fatal() {
  document.getElementById('fatal').hidden = false;
  loadingEl.classList.add('done');
}

const OVERVIEW_POS = new THREE.Vector3(0, 300, 560);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);

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
  engine.camera.position.copy(OVERVIEW_POS);
  rig.controls.target.copy(OVERVIEW_TARGET);

  const nameOf = (ctl) => t(`${ctl.def.i18n ?? `body.${ctl.id}`}.name`);

  const labels = new LabelManager(
    engine,
    document.getElementById('labels'),
    nameOf,
    (id) => app.select(id)
  );
  labels.attach([...system.controllers.values()]);

  new Picker(engine, canvas, () => system.controllers.values(), (id) => app.select(id));

  const flare = new FlareOverlay(engine);

  // ---------- App state / debug API ----------
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
    qualityTier: 'high',
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
      if (app.selected == null) return;
      app.selected = null;
      rig.stop();
      for (const fn of selectListeners) fn(null, null);
    },
    overview: () => {
      app.deselect();
      rig.flyToPose(OVERVIEW_POS, OVERVIEW_TARGET, 1.8);
    },
    applyQuality: (tier) => {
      app.qualityTier = tier;
      const dpr = window.devicePixelRatio || 1;
      if (tier === 'high') {
        engine.setMaxDPR(Math.min(dpr, 2));
        engine.bloomPass.enabled = true;
        for (const b of system.belts) b.setDensity(1);
      } else if (tier === 'medium') {
        engine.setMaxDPR(Math.min(dpr, 1.5));
        engine.bloomPass.enabled = true;
        for (const b of system.belts) b.setDensity(0.5);
      } else {
        engine.setMaxDPR(1);
        engine.bloomPass.enabled = false;
        for (const b of system.belts) b.setDensity(0.25);
      }
      try { localStorage.setItem('primacy.quality', tier); } catch { /* ignore */ }
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
      lang: document.documentElement.lang,
      fps: engine.fps,
      system: system.def.id,
      ...engine.rendererInfo(),
    }),
  };
  window.__APP__ = app;

  // ---------- UI ----------
  document.getElementById('ui').hidden = false;
  const ui = new UI(app, { onOverview: () => app.overview() });
  const infoPanel = new InfoPanel(document.getElementById('info-panel'), {
    onClose: () => app.deselect(),
  });
  const navTree = new NavTree(document.getElementById('nav-tree'), {
    onPick: (id) => app.select(id),
    onOverview: () => app.overview(),
  });
  navTree.setSystem(system.def);
  const timeControls = new TimeControls(document.getElementById('time-bar'), { time, scale });
  const router = new HashRouter(app);

  app.onSelect((id, ctl) => {
    if (id) {
      infoPanel.show(ctl);
    } else {
      infoPanel.hide();
    }
    navTree.setSelected(id);
    ui.setBreadcrumbs(`system.${system.def.id}`, ctl);
    router.write();
  });
  ui.setBreadcrumbs(`system.${system.def.id}`, null);

  onLang(() => {
    labels.refreshNames();
    navTree.render();
    navTree.setSelected(app.selected);
    infoPanel.render();
    timeControls.refreshStatics();
    ui.renderStatics();
    ui.setBreadcrumbs(`system.${system.def.id}`, app.selected ? system.controllers.get(app.selected) : null);
    router.write();
  });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'Escape') {
      const settings = document.getElementById('settings');
      if (!settings.hidden) settings.hidden = true;
      else if (app.selected) app.deselect();
      else app.overview();
    }
    if (e.key === ' ') {
      e.preventDefault();
      time.setPaused(!time.paused);
      timeControls.refreshStatics();
    }
  });

  // ---------- Frame loop ----------
  engine.onFrame((dt) => {
    time.tick(dt);
    system.update(dt);
    rig.update(dt);
    labels.update();
    timeControls.update();
    flare.track(system.star.worldPos);
  });

  engine.start();

  try {
    const savedQ = localStorage.getItem('primacy.quality');
    if (savedQ) app.applyQuality(savedQ);
  } catch { /* ignore */ }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    loadingEl.classList.add('done');
    app.ready = true;
    router.apply();
  }));
}

boot().catch((err) => {
  console.error('boot failed', err);
  fatal();
});
