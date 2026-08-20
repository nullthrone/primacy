import * as THREE from 'three';
import { keplerPosition } from './Kepler.js';
import { jdFromDate } from '../core/TimeEngine.js';

const DEG = Math.PI / 180;

/**
 * Spacecraft trajectories, approximated: launch at Earth's real position,
 * gravity-assist waypoints at each planet's real Kepler position on the
 * flyby date, then the published asymptotic escape direction (ecliptic
 * lon/lat) out to today's distance. Clearly labeled an approximation in
 * the encyclopedia — SPICE-grade accuracy is out of scope.
 */
function dirFromLonLat(lonDeg, latDeg) {
  const lon = lonDeg * DEG, lat = latDeg * DEG;
  // Ecliptic frame -> scene mapping (x, z_ecl->y, -y_ecl->z).
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon)
  );
}

function jd(y, m, d) {
  return jdFromDate(new Date(Date.UTC(y, m - 1, d)));
}

/** Build waypoints in AU (scene-oriented) for one probe. */
function buildProbe(sol, spec) {
  const byId = Object.fromEntries(sol.bodies.map((b) => [b.id, b]));
  const pts = [];
  for (const wp of spec.waypoints) {
    if (wp.body) {
      const el = byId[wp.body].elements;
      pts.push(keplerPosition(el, wp.jd, new THREE.Vector3()));
    } else if (wp.escape) {
      const dir = dirFromLonLat(wp.escape.lon, wp.escape.lat);
      for (const au of wp.escape.dists) {
        pts.push(dir.clone().multiplyScalar(au));
      }
    }
  }
  return pts;
}

export const PROBES = [
  {
    id: 'voyager1', color: 0xd8b878,
    waypoints: [
      { body: 'earth', jd: jd(1977, 9, 5) },
      { body: 'jupiter', jd: jd(1979, 3, 5) },
      { body: 'saturn', jd: jd(1980, 11, 12) },
      { escape: { lon: 262, lat: 35, dists: [14, 30, 60, 100, 167] } },
    ],
  },
  {
    id: 'voyager2', color: 0xa8c8e0,
    waypoints: [
      { body: 'earth', jd: jd(1977, 8, 20) },
      { body: 'jupiter', jd: jd(1979, 7, 9) },
      { body: 'saturn', jd: jd(1981, 8, 25) },
      { body: 'uranus', jd: jd(1986, 1, 24) },
      { body: 'neptune', jd: jd(1989, 8, 25) },
      { escape: { lon: 310, lat: -48, dists: [40, 70, 110, 139] } },
    ],
  },
  {
    id: 'newhorizons', color: 0xc8a0e8,
    waypoints: [
      { body: 'earth', jd: jd(2006, 1, 19) },
      { body: 'jupiter', jd: jd(2007, 2, 28) },
      { body: 'pluto', jd: jd(2015, 7, 14) },
      { escape: { lon: 293, lat: 2, dists: [48, 61] } },
    ],
  },
];

export class Trajectories {
  constructor(solDef, scale) {
    this.scale = scale;
    this.group = new THREE.Group();
    this.group.name = 'probes';
    this.lines = [];
    for (const spec of PROBES) {
      const ptsAU = buildProbe(solDef, spec);
      // Smooth with a Catmull-Rom through the waypoints.
      const curve = new THREE.CatmullRomCurve3(ptsAU, false, 'centripetal', 0.4);
      const sampledAU = curve.getPoints(180);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(181 * 3), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: 0.55,
      }));
      line.frustumCulled = false;
      this.group.add(line);

      // Marker dots at the gravity-assist waypoints.
      const markerGeo = new THREE.BufferGeometry();
      markerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ptsAU.length * 3), 3));
      const markers = new THREE.Points(markerGeo, new THREE.PointsMaterial({
        color: spec.color,
        size: 4,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.85,
      }));
      markers.frustumCulled = false;
      this.group.add(markers);

      this.lines.push({ spec, sampledAU, ptsAU, line, markers });
    }
    this.rebuild();
  }

  /** Re-map AU points through the current scale blend. */
  rebuild() {
    const v = new THREE.Vector3();
    for (const entry of this.lines) {
      const pos = entry.line.geometry.getAttribute('position');
      entry.sampledAU.forEach((pAU, i) => {
        this.scale.mapVector(v.copy(pAU), v);
        pos.setXYZ(i, v.x, v.y, v.z);
      });
      pos.needsUpdate = true;
      entry.line.geometry.computeBoundingSphere();
      const mpos = entry.markers.geometry.getAttribute('position');
      entry.ptsAU.forEach((pAU, i) => {
        this.scale.mapVector(v.copy(pAU), v);
        mpos.setXYZ(i, v.x, v.y, v.z);
      });
      mpos.needsUpdate = true;
    }
  }

  setVisible(vis) {
    this.group.visible = vis;
  }

  dispose() {
    for (const e of this.lines) {
      e.line.geometry.dispose();
      e.line.material.dispose();
      e.markers.geometry.dispose();
      e.markers.material.dispose();
    }
  }
}
