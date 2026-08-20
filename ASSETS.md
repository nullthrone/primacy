# Asset provenance & licenses

The application code is MIT-licensed (see `LICENSE`). Bundled third-party
assets keep their own licenses:

## Libraries

| Path | Source | License |
| --- | --- | --- |
| `vendor/three/` | [three.js](https://github.com/mrdoob/three.js) 0.185.1 via npm | MIT |

## Textures (`assets/textures/`)

Fetched by `tools/fetch-textures.mjs`; `assets/textures/manifest.json`
records the exact source URL per file. Current resolution:

| Files | Source | License |
| --- | --- | --- |
| `earth_day`, `earth_night`, `earth_clouds`, `earth_spec`, `earth_normal`, `moon` | [three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets) | MIT |
| `mercury`, `venus`, `mars`, `jupiter`, `saturn`, `saturn_ring_*`, `uranus`, `neptune`, `pluto` | [threex.planets](https://github.com/jeromeetienne/threex.planets) | MIT |

The manifest lists [Solar System Scope](https://www.solarsystemscope.com/textures/)
2K textures (CC BY 4.0) as preferred candidates; re-running
`npm run fetch-textures` on an unrestricted network upgrades to them
without code changes. All remaining surfaces (Ceres, all small moons, the
exoplanets, the Milky Way panorama) are generated procedurally at runtime.

## Star catalog (`assets/stars/`)

| File | Source | License |
| --- | --- | --- |
| `hyg_subset.json` (8.7k stars) and the embedded `src/data/brightFallback.js` | [HYG Database v4.1](https://github.com/astronexus/HYG-Database) by David Nash | CC BY-SA 4.0 |

The subset files are derivative works of HYG and are themselves licensed
CC BY-SA 4.0 (attribution: David Nash / astronexus.com).

## Scientific data

Planetary mean elements: JPL/Standish "Approximate Positions of the Major
Planets" (1800–2050 table). Exoplanet parameters: published RV solutions
(Anglada-Escudé+ 2016; Faria+ 2022; Damasso+ 2020; Bonfils+ 2017).
Habitable-zone limits: Kopparapu+ 2013/2014. Probe trajectories are
schematic approximations through real flyby dates, not SPICE ephemerides.
