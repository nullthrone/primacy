import * as THREE from 'three';
import { Engine, webgl2Available } from './core/Engine.js';
import { TimeEngine } from './core/TimeEngine.js';
import { ScaleManager } from './core/ScaleManager.js';
import { Materials } from './core/Materials.js';
import { FlareOverlay } from './core/FlareOverlay.js';
import { CameraRig } from './core/CameraRig.js';
import { Picker } from './core/Picker.js';
import { SceneRouter } from './core/SceneRouter.js';
import { LabelManager } from './ui/LabelManager.js';
import { SYSTEM_DEFS, VIEW_ORDER, loadStarCatalog } from './data/systems.js';
import { InterstellarScene } from './scenes/InterstellarScene.js';
import { WarpTransition } from './scenes/WarpTransition.js';
import { FlareController } from './sim/FlareController.js';
import { RVDemo } from './sim/RVDemo.js';
import { TourPlayer } from './ui/TourPlayer.js';
import { ComparePanel } from './ui/ComparePanel.js';
import { PhotoMode } from './ui/PhotoMode.js';
import { Trajectories } from './orbits/Trajectories.js';
import { TOURS } from './data/tours.js';
import { t, onLang } from './ui/i18n.js';
import { UI } from './ui/UI.js';
import { InfoPanel } from './ui/InfoPanel.js';
import { NavTree } from './ui/NavTree.js';
import { TimeControls } from './ui/TimeControls.js';
import { HashRouter } from './ui/HashRouter.js';
import { trackChromeMetrics } from './ui/ChromeMetrics.js';

const canvas = document.getElementById('scene');
const loadingEl = document.getElementById('loading');

function fatal() {
  document.getElementById('fatal').hidden = false;
  loadingEl.classList.add('done');
}

const OVERVIEW = {
  sol: { pos: new THREE.Vector3(0, 300, 560), target: new THREE.Vector3(0, 0, 0) },
  proxima: { pos: new THREE.Vector3(0, 55, 105), target: new THREE.Vector3(0, 0, 0) },
  ross128: { pos: new THREE.Vector3(0, 48, 92), target: new THREE.Vector3(0, 0, 0) },
  map: { pos: new THREE.Vector3(0, 300, 520), target: new THREE.Vector3(0, 0, 0) },
};

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
    progressEl.style.width = `${Math.round(f * 80)}%`;
  });
  const catalog = await loadStarCatalog();
  progressEl.style.width = '100%';

  const nameOf = (ctl) => (ctl.def.type === 'system'
    ? t(ctl.def.i18n)
    : t(`${ctl.def.i18n ?? `body.${ctl.id}`}.name`));

  const router = new SceneRouter({
    engine, time, scale, materials, catalog,
    defs: SYSTEM_DEFS,
    custom: {
      map: () => new InterstellarScene({ engine, catalog }),
    },
    makeLabels: (scene) => {
      const lm = new LabelManager(
        engine,
        document.getElementById('labels'),
        nameOf,
        (id) => app.select(id)
      );
      lm.attach([...scene.controllers.values()]);
      return lm;
    },
  });

  const rig = new CameraRig(engine, canvas, scale);

  new Picker(engine, canvas,
    () => (router.active ? router.active.scene.controllers.values() : []),
    (id) => app.select(id));

  const flare = new FlareOverlay(engine);
  const warp = new WarpTransition(engine);

  const toastEl = document.getElementById('toast');
  let toastTimer = null;
  const toast = (text) => {
    toastEl.textContent = text;
    toastEl.hidden = false;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 6000);
  };

  // Flare simulation for flare-star systems, created on first visit.
  const ensureFlareSim = (entry) => {
    if (entry.flareSim !== undefined) return;
    const def = entry.scene.def;
    if (def.star?.star?.flareStar) {
      const target = def.bodies.find((b) => b.material?.aurora);
      entry.flareSim = new FlareController({
        scene: entry.scene,
        starCtl: entry.scene.star,
        targetCtl: target ? entry.scene.controllers.get(target.id) : null,
        onCaption: () => toast(t('ui.cmeCaption')),
      });
    } else {
      entry.flareSim = null;
    }
    // Probe trajectories exist only in Sol.
    if (entry.id === 'sol' && !entry.traj) {
      entry.traj = new Trajectories(entry.scene.def, scale);
      entry.scene.scene.add(entry.traj.group);
    }
  };

  // ---------- App state / debug API ----------
  const _pos = new THREE.Vector3();
  const selectListeners = new Set();
  const systemListeners = new Set();
  const app = {
    engine,
    time,
    scale,
    materials,
    rig,
    controls: rig.controls,
    ready: false,
    version: '1.0.0',
    selected: null,
    qualityTier: 'high',
    hzVisible: true,
    get system() { return router.active?.scene; },
    get labels() { return router.active?.labels; },
    fps: () => engine.fps,
    setJD: (jd) => time.setJD(jd),
    setSpeed: (s) => time.setSpeed(s),
    setPaused: (p) => time.setPaused(p),
    setScaleMode: (m) => scale.setMode(m),
    onSelect: (fn) => { selectListeners.add(fn); return () => selectListeners.delete(fn); },
    onSystem: (fn) => { systemListeners.add(fn); return () => systemListeners.delete(fn); },
    setSystem: (id, { position = true, warp: useWarp = false } = {}) => {
      if (!router.has(id) || router.activeId === id) return false;
      const doSwitch = () => {
        app.selected = null;
        rig.stop();
        const entry = router.switchTo(id);
        ensureFlareSim(entry);
        entry.scene.setHZVisible(app.hzVisible);
        if (position && OVERVIEW[id]) {
          engine.camera.position.copy(OVERVIEW[id].pos);
          rig.controls.target.copy(OVERVIEW[id].target);
        }
        for (const fn of systemListeners) fn(id, entry.scene);
        for (const fn of selectListeners) fn(null, null);
      };
      if (useWarp && app.ready) warp.run(doSwitch);
      else doSwitch();
      return true;
    },
    select: (id) => {
      // On the interstellar map, picking a beacon warps into that system.
      if (router.activeId === 'map' && SYSTEM_DEFS[id]) {
        return app.setSystem(id, { warp: true });
      }
      const ctl = router.active?.scene.controllers.get(id);
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
      const ov = OVERVIEW[router.activeId] ?? OVERVIEW.sol;
      rig.flyToPose(ov.pos, ov.target, 1.8);
    },
    setHZ: (v) => {
      app.hzVisible = v;
      for (const e of router.entries.values()) e.scene.setHZVisible(v);
    },
    knowledgeMode: false,
    setKnowledge: (v) => {
      app.knowledgeMode = v;
      for (const e of router.entries.values()) {
        for (const ctl of e.scene.controllers?.values() ?? []) {
          ctl.body?.setKnowledgeMode?.(v);
        }
      }
    },
    triggerFlare: () => router.active?.flareSim?.trigger() ?? false,
    isFlaring: () => router.active?.flareSim?.flaring ?? false,
    probesVisible: true,
    setProbes: (v) => {
      app.probesVisible = v;
      for (const e of router.entries.values()) e.traj?.setVisible(v);
    },
    applyQuality: (tier, persist = true) => {
      app.qualityTier = tier;
      const dpr = window.devicePixelRatio || 1;
      const belts = router.active?.scene.belts ?? [];
      if (tier === 'high') {
        engine.setMaxDPR(Math.min(dpr, 2));
        engine.bloomPass.enabled = true;
        for (const b of belts) b.setDensity(1);
      } else if (tier === 'medium') {
        engine.setMaxDPR(Math.min(dpr, 1.5));
        engine.bloomPass.enabled = true;
        for (const b of belts) b.setDensity(0.5);
      } else {
        engine.setMaxDPR(1);
        engine.bloomPass.enabled = false;
        for (const b of belts) b.setDensity(0.25);
      }
      if (persist) {
        try { localStorage.setItem('primacy.quality', tier); } catch { /* ignore */ }
      }
    },
    listBodies: () => {
      const def = router.active?.scene.def;
      return def ? [def.star.id, ...def.bodies.map((b) => b.id)] : [];
    },
    bodyPos: (id) => {
      const p = router.active?.scene.worldPosOf(id, _pos);
      return p ? [p.x, p.y, p.z] : null;
    },
    bodyScreen: (id) => {
      const p = router.active?.scene.worldPosOf(id, _pos);
      if (!p) return null;
      p.project(engine.camera);
      return {
        x: (p.x * 0.5 + 0.5) * window.innerWidth,
        y: (-p.y * 0.5 + 0.5) * window.innerHeight,
        z: p.z,
      };
    },
    debugMarkers: () => router.active?.labels.markersVisible() ?? [],
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
      system: router.activeId,
      ...engine.rendererInfo(),
    }),
  };
  window.__APP__ = app;

  // Boot into Sol.
  router.switchTo('sol');
  ensureFlareSim(router.active);
  engine.camera.position.copy(OVERVIEW.sol.pos);
  rig.controls.target.copy(OVERVIEW.sol.target);
  router.active.scene.setHZVisible(app.hzVisible);

  // ---------- UI ----------
  document.getElementById('ui').hidden = false;
  const tourPlayer = new TourPlayer(document.getElementById('tour-card'), app);
  const comparePanel = new ComparePanel(engine, materials, document.getElementById('compare-labels'));
  const photoMode = new PhotoMode(engine, document.getElementById('photo-hint'));
  const ui = new UI(app, {
    onOverview: () => app.overview(),
    systems: VIEW_ORDER,
    onSystem: (id) => app.setSystem(id, { warp: id !== 'map' && router.activeId !== 'map' }),
    tours: TOURS.map((x) => x.id),
    onTour: (id) => tourPlayer.start(id),
    onCompare: () => comparePanel.toggle(),
    onPhoto: () => photoMode.toggle(),
  });
  const rv = new RVDemo(document.getElementById('rv-panel'), { time });
  const infoPanel = new InfoPanel(document.getElementById('info-panel'), {
    onClose: () => app.deselect(),
    knowledgeActive: () => app.knowledgeMode,
    onAction: (act, ctl) => {
      if (act === 'flare') {
        app.triggerFlare();
      } else if (act === 'rv') {
        rv.show({
          name: nameOf(ctl),
          periodD: ctl.def.elements?.periodD ?? 10,
          kMS: ctl.def.knowledge?.kMS ?? 1,
          epoch: ctl.def.elements?.epoch ?? 2451545.0,
        });
      } else if (act === 'knowledge') {
        app.setKnowledge(!app.knowledgeMode);
        infoPanel.render();
      }
    },
  });
  const navTree = new NavTree(document.getElementById('nav-tree'), {
    onPick: (id) => app.select(id),
    onOverview: () => app.overview(),
  });
  navTree.setSystem(router.active.scene.def);
  const timeControls = new TimeControls(document.getElementById('time-bar'), { time, scale });
  trackChromeMetrics({
    '--topbar-h': document.getElementById('topbar'),
    '--timebar-h': document.getElementById('time-bar'),
  });
  const hashRouter = new HashRouter(app);

  const refreshBreadcrumbs = () => {
    const ctl = app.selected ? router.active.scene.controllers.get(app.selected) : null;
    ui.setBreadcrumbs(`system.${router.activeId}`, ctl);
  };

  app.onSelect((id, ctl) => {
    if (id) infoPanel.show(ctl);
    else infoPanel.hide();
    navTree.setSelected(id);
    refreshBreadcrumbs();
    hashRouter.write();
  });
  app.onSystem((id, scene) => {
    navTree.setSystem(scene.def);
    ui.setActiveSystem(id);
    refreshBreadcrumbs();
    hashRouter.write();
  });
  refreshBreadcrumbs();
  ui.setActiveSystem('sol');

  onLang(() => {
    for (const e of router.entries.values()) e.labels.refreshNames();
    navTree.render();
    navTree.setSelected(app.selected);
    infoPanel.render();
    timeControls.refreshStatics();
    ui.renderStatics();
    ui.setActiveSystem(router.activeId);
    refreshBreadcrumbs();
    hashRouter.write();
  });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'Escape') {
      const settings = document.getElementById('settings');
      if (photoMode.active) photoMode.exit();
      else if (comparePanel.enabled) comparePanel.hide();
      else if (tourPlayer.running) tourPlayer.stop();
      else if (!settings.hidden) settings.hidden = true;
      else if (app.selected) app.deselect();
      else app.overview();
    }
    if (e.key === ' ') {
      e.preventDefault();
      time.setPaused(!time.paused);
      timeControls.refreshStatics();
    }
    if (e.key === 'p' || e.key === 'P') {
      photoMode.toggle();
    }
  });

  // ---------- Frame loop ----------
  engine.onFrame((dt) => {
    time.tick(dt);
    const active = router.active;
    if (!active) return;
    active.scene.update(dt);
    active.flareSim?.update(dt);
    if (scale.transitioning) active.traj?.rebuild();
    rig.update(dt);
    warp.update(dt);
    tourPlayer.update(dt);
    active.labels.update();
    timeControls.update();
    rv.update();
    flare.track(active.scene.star?.worldPos ?? null);
    // After every camera mutation this frame: keep the sky glued to the
    // camera so the background exists at any camera position.
    router.active?.scene.sky?.track(engine.camera);
  });

  engine.start();

  let savedQ = null;
  try { savedQ = localStorage.getItem('primacy.quality'); } catch { /* ignore */ }
  if (savedQ) {
    app.applyQuality(savedQ);
  } else {
    // Phones and tablets start one tier down: the full pipeline (DPR 2 +
    // multisampled HDR composer + bloom) can blow a mobile GPU's frame
    // budget, which on iOS Safari shows up as partially presented frames
    // (a hard-edged black region) rather than merely low fps.
    if (window.matchMedia?.('(pointer: coarse)').matches) {
      app.applyQuality('medium', false);
    }
    // Watchdog: while the user has not chosen a tier, step down whenever
    // the frame rate stays far under target. Never persisted, never up.
    // Skipped under the ?q=low profile (headless verification runs).
    const TIERS = engine.quality === 'low' ? [] : ['high', 'medium', 'low'];
    let slowFor = 0;
    let lastStep = 0;
    engine.onFrame((dt) => {
      slowFor = engine.fps < 24 ? slowFor + dt : 0;
      if (slowFor < 4) return;
      slowFor = 0;
      const now = performance.now();
      let chosen = null;
      try { chosen = localStorage.getItem('primacy.quality'); } catch { /* ignore */ }
      if (chosen || now - lastStep < 8000) return;
      const i = TIERS.indexOf(app.qualityTier);
      if (i >= 0 && i < TIERS.length - 1) {
        app.applyQuality(TIERS[i + 1], false);
        lastStep = now;
      }
    });
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    loadingEl.classList.add('done');
    app.ready = true;
    hashRouter.apply();
  }));
}

boot().catch((err) => {
  console.error('boot failed', err);
  fatal();
});
