// Turns an authored region map into a template for world generation (docs/decisions.md D13, docs/content.md):
// the generated rectangle is cleared to the biome's first floor tile, and the template's own spots, habitat zones and
// area zones inside it are removed; a `generated` rectangle (biome, area, species) and the connectors are added; and
// the left strip keeps its own habitat and area zones, split so they stay outside the rectangle.
//
//   node scripts/make-template.mjs <config.json>
//
// The config: { "map": "kocevje_forest", "rect": [x, y, w, h], "biome": "...", "areaId": "...", "species": [...],
//   "connectors": [[x, y], ...], "floor": 14, "stripZones": [{ "habitatId": "...", "rect": [x, y, w, h] }],
//   "stripArea": [x, y, w, h], "stripFloor": [[x, y], ...] }
// stripFloor lists strip tiles to turn into plain floor (e.g. the end of a stream that now continues nowhere).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'maps');
const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const file = join(root, `${config.map}.json`);
const map = JSON.parse(readFileSync(file, 'utf8'));
const [rx, ry, rw, rh] = config.rect;
const inRect = (x, y) => x >= rx && x < rx + rw && y >= ry && y < ry + rh;
const layer = (name) => map.layers.find((l) => l.name === name);

for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    if (inRect(x, y)) {
      layer('ground').data[i] = config.floor + 1;
      layer('decor').data[i] = 0;
      layer('collision').data[i] = 0;
    }
  }
}

for (const [x, y] of config.stripFloor ?? []) {
  const i = y * map.width + x;
  layer('ground').data[i] = config.floor + 1;
  layer('decor').data[i] = 0;
  layer('collision').data[i] = 0;
}

const objects = map.layers.find((l) => l.type === 'objectgroup').objects;
const tileOf = (o) => [Math.floor(o.x / 16), Math.floor(o.y / 16)];
const kept = objects.filter((o) => {
  if (['habitat', 'area', 'generated', 'connector'].includes(o.type)) return false;
  if (o.type === 'spot')
    return (
      !inRect(...tileOf(o)) &&
      !config.species.includes(o.properties.find((p) => p.name === 'speciesId').value)
    );
  return true;
});

let nextId = Math.max(0, ...objects.map((o) => o.id)) + 1;
const string = (name, value) => ({ name, type: 'string', value });
const rect = (type, name, [x, y, w, h], properties) => ({
  id: nextId++,
  name,
  type,
  x: x * 16,
  y: y * 16,
  width: w * 16,
  height: h * 16,
  rotation: 0,
  visible: true,
  properties,
});
for (const zone of config.stripZones)
  kept.push(
    rect('habitat', `strip_${zone.rect.join('_')}`, zone.rect, [
      string('habitatId', zone.habitatId),
    ]),
  );
kept.push(
  rect('area', `area_${config.areaId}_strip`, config.stripArea, [string('areaId', config.areaId)]),
);
kept.push(
  rect('generated', `generated_${config.biome}`, config.rect, [
    string('areaId', config.areaId),
    string('biome', config.biome),
    string('species', config.species.join(',')),
  ]),
);
for (const [x, y] of config.connectors) {
  kept.push({
    id: nextId++,
    name: `connector_${x}_${y}`,
    type: 'connector',
    point: true,
    x: x * 16 + 8,
    y: y * 16 + 8,
    width: 0,
    height: 0,
    rotation: 0,
    visible: true,
  });
}

map.layers.find((l) => l.type === 'objectgroup').objects = kept;
map.nextobjectid = nextId;
writeFileSync(file, JSON.stringify(map, null, 1) + '\n');
console.log(
  `${config.map}: template with ${config.species.length} species, ${config.connectors.length} connector(s)`,
);
