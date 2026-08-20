import * as THREE from 'three';
import { eqToVec, eqDirToScene, bvColor, SkyDome } from './SkyDome.js';
import { SYSTEM_POS_PC } from '../data/systems.js';
import { makeDotTexture, makeGlowTexture } from '../procgen/FlareSprites.js';

const PC_TO_UNITS = 100; // 1 unit = 0.01 pc
const LY_TO_PC = 1 / 3.26156;

/**
 * 3D map of the solar neighborhood: HYG stars at their true positions,
 * beacons for the three visitable systems, light-year rings. Exposes the
 * same minimal interface as SystemScene (controllers/worldPosOf/update)
 * so labels and picking work unchanged; selecting a beacon warps there.
 */
export class InterstellarScene {
  constructor({ engine, catalog }) {
    this.engine = engine;
    this.def = { id: 'map', star: null, bodies: [], belts: [] };
    this.star = null;
    this.belts = [];
    this.trailsEnabled = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x010207);

    this.sky = new SkyDome({ seed: 7, catalog: null });
    this.sky.points.visible = false; // pano only; real stars are 3D points
    this.scene.add(this.sky.group);

    // --- Neighborhood stars at true 3D positions ---
    if (catalog) {
      const keep = [];
      const p = new THREE.Vector3();
      for (let i = 0; i < catalog.n; i++) {
        if (catalog.d[i] > 8.5) continue; // ~28 ly bubble
        eqToVec(catalog.ra[i], catalog.dec[i], catalog.d[i], p);
        keep.push({ p: eqDirToScene(p.clone().multiplyScalar(PC_TO_UNITS)), absmag: catalog.absmag[i], ci: catalog.ci[i], name: catalog.names[i] });
      }
      const n = keep.length;
      const positions = new Float32Array(n * 3);
      const colors = new Float32Array(n * 3);
      const sizes = new Float32Array(n);
      const c = new THREE.Color();
      keep.forEach((s, i) => {
        positions[i * 3] = s.p.x;
        positions[i * 3 + 1] = s.p.y;
        positions[i * 3 + 2] = s.p.z;
        const b = THREE.MathUtils.clamp(Math.pow(10, -0.25 * (s.absmag - 6)), 0.15, 2.2);
        bvColor(s.ci, c);
        colors[i * 3] = c.r * b;
        colors[i * 3 + 1] = c.g * b;
        colors[i * 3 + 2] = c.b * b;
        sizes[i] = THREE.MathUtils.clamp(4.4 - s.absmag * 0.24, 1.6, 5);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uDPR: { value: Math.min(window.devicePixelRatio || 1, 2) } },
        vertexShader: /* glsl */ `
          #include <common>
          #include <logdepthbuf_pars_vertex>
          attribute float aSize;
          varying vec3 vColor;
          uniform float uDPR;
          void main() {
            vColor = color;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uDPR;
            #include <logdepthbuf_vertex>
          }
        `,
        fragmentShader: /* glsl */ `
          #include <common>
          #include <logdepthbuf_pars_fragment>
          varying vec3 vColor;
          void main() {
            #include <logdepthbuf_fragment>
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv) * 2.0;
            float a = smoothstep(1.0, 0.1, d);
            if (a < 0.02) discard;
            gl_FragColor = vec4(vColor, a);
          }
        `,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.points = new THREE.Points(geo, mat);
      this.points.frustumCulled = false;
      this.scene.add(this.points);
    }

    // --- Light-year rings around Sol ---
    for (const ly of [5, 10, 15, 20]) {
      const r = ly * LY_TO_PC * PC_TO_UNITS;
      const segs = 128;
      const pts = [];
      for (let s = 0; s <= segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x3a4a66, transparent: true, opacity: 0.28 })
      );
      this.scene.add(line);
    }

    // --- Beacons for the three visitable systems ---
    this.controllers = new Map();
    const beacons = [
      { id: 'sol', i18n: 'system.sol', tint: '255,220,150', teint: 0xffd894 },
      { id: 'proxima', i18n: 'system.proxima', tint: '255,140,100', teint: 0xff8c64 },
      { id: 'ross128', i18n: 'system.ross128', tint: '255,170,110', teint: 0xffaa6e },
    ];
    for (const b of beacons) {
      const group = new THREE.Group();
      const pos = eqDirToScene(SYSTEM_POS_PC[b.id].clone().multiplyScalar(PC_TO_UNITS));
      group.position.copy(pos);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture({ inner: `rgba(${b.tint},1)`, mid: `rgba(${b.tint},0.3)`, rays: false }),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      glow.scale.setScalar(16);
      group.add(glow);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeDotTexture(b.tint),
        transparent: true,
        depthWrite: false,
      }));
      core.scale.setScalar(4);
      group.add(core);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(6.4, 7.0, 48),
        new THREE.MeshBasicMaterial({ color: b.teint, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);
      this.scene.add(group);
      this.controllers.set(b.id, {
        id: b.id,
        def: { i18n: b.i18n, type: 'system', labelRank: 1 },
        kind: 'system',
        body: { displayRadius: 5 },
        group,
        worldPos: pos.clone(),
        parent: null,
        _pulse: { glow, ring, phase: Math.random() * Math.PI * 2 },
      });
    }
    // Breakthrough Starshot concept line Sol -> Proxima with a 0.2c pulse.
    const solPos = this.controllers.get('sol').worldPos;
    const proxPos = this.controllers.get('proxima').worldPos;
    const shotLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([solPos.clone(), proxPos.clone()]),
      new THREE.LineDashedMaterial({ color: 0x6ac8ff, dashSize: 3, gapSize: 2.4, transparent: true, opacity: 0.55 })
    );
    shotLine.computeLineDistances();
    this.scene.add(shotLine);
    this.pulse = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeDotTexture('140,210,255'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this.pulse.scale.setScalar(5);
    this.scene.add(this.pulse);
    this._shotEnds = [solPos.clone(), proxPos.clone()];

    this._t = 0;
  }

  update(dt) {
    this._t += dt;
    for (const ctl of this.controllers.values()) {
      const s = 1 + 0.12 * Math.sin(this._t * 2 + ctl._pulse.phase);
      ctl._pulse.glow.scale.setScalar(16 * s);
      ctl._pulse.ring.rotation.z = this._t * 0.4 + ctl._pulse.phase;
    }
    // Starshot pulse: one Sol->Proxima run every ~9 s (21.7 years at 0.2c).
    const f = (this._t % 9) / 9;
    this.pulse.position.lerpVectors(this._shotEnds[0], this._shotEnds[1], f);
    this.pulse.material.opacity = Math.sin(f * Math.PI) * 0.9;
  }

  worldPosOf(id, target = new THREE.Vector3()) {
    const ctl = this.controllers.get(id);
    return ctl ? target.copy(ctl.worldPos) : null;
  }

  setHZVisible() {}
  setTrailsVisible() {}

  dispose() {
    this.sky.dispose();
    this.points?.geometry.dispose();
    this.points?.material.dispose();
  }
}
