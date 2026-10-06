// Turns an authored region map into a template for world generation (docs/decisions.md D13, docs/content.md):
// each generated rectangle is cleared to its biome's first floor tile, and the template's own spots, habitat zones and
// area zones are removed; `generated` rectangles (biome, area, species) and their connectors are added; and the
// authored rest keeps the habitat and area zones listed in the config, which must stay outside the rectangles.
//
//   node scripts/make-template.mjs <config.json>
//
// The config: { "map": "kocevje_forest",
//   "generated": [{ "rect": [x, y, w, h], "biome": "...", "areaId": "...", "underground": false, "species": [...],
//     "connectors": [[x, y], ...], "floor": 14, "nearSpawn": [...], "barrier": "north", "gateFlag": "..." }],
//   "stripZones": [{ "habitatId": "...", "rect": [x, y, w, h] }],
//   "stripAreas": [{ "areaId": "...", "rect": [x, y, w, h], "underground": false }],
//   "stripFloor": [[x, y, tile], ...] }
// An authored gate inside a rectangle is dropped: a barrier there places its own (design §4a).
// stripFloor lists authored tiles to turn into plain floor without decoration or collision (e.g. the end of a stream
// that now continues nowhere, or a plant whose spot is now generated).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'maps');
const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const file = join(root, `${config.map}.json`);
const map = JSON.parse(readFileSync(file, 'utf8'));
const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && x < rx + rw && y >= ry && y < ry + rh;
const layer = (name) => map.layers.find((l) => l.name === name);
const setFloor = (x, y, tile) => {
  const i = y * map.width + x;
  layer('ground').data[i] = tile + 1;
  layer('decor').data[i] = 0;
  layer('collision').data[i] = 0;
};

for (const area of config.generated) {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (inRect(area.rect, x, y)) setFloor(x, y, area.floor);
    }
  }
}

for (const [x, y, tile] of config.stripFloor ?? []) setFloor(x, y, tile);

const species = config.generated.flatMap((area) => area.species);
const objects = map.layers.find((l) => l.type === 'objectgroup').objects;
const tileOf = (o) => [Math.floor(o.x / 16), Math.floor(o.y / 16)];
const tileObjectTile = (o) => [
  Math.floor((o.x + o.width / 2) / 16),
  Math.floor((o.y - o.height / 2) / 16),
];
const kept = objects.filter((o) => {
  if (['habitat', 'area', 'generated', 'connector'].includes(o.type)) return false;
  if (o.type === 'gate' && config.generated.some((area) => inRect(area.rect, ...tileObjectTile(o))))
    return false;
  if (o.type === 'spot')
    return (
      !config.generated.some((area) => inRect(area.rect, ...tileOf(o))) &&
      !species.includes(o.properties.find((p) => p.name === 'speciesId').value)
    );
  return true;
});

let nextId = Math.max(0, ...objects.map((o) => o.id)) + 1;
const string = (name, value) => ({ name, type: 'string', value });
const bool = (name, value) => ({ name, type: 'bool', value });
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
for (const area of config.stripAreas)
  kept.push(
    rect('area', `area_${area.areaId}_${area.rect.join('_')}`, area.rect, [
      string('areaId', area.areaId),
      ...(area.underground ? [bool('underground', true)] : []),
    ]),
  );
for (const area of config.generated) {
  kept.push(
    rect('generated', `generated_${area.biome}`, area.rect, [
      string('areaId', area.areaId),
      string('biome', area.biome),
      string('species', area.species.join(',')),
      ...(area.underground ? [bool('underground', true)] : []),
      ...(area.nearSpawn ? [string('nearSpawn', area.nearSpawn.join(','))] : []),
      ...(area.barrier ? [string('barrier', area.barrier), string('gateFlag', area.gateFlag)] : []),
    ]),
  );
  for (const [x, y] of area.connectors) {
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
}

map.layers.find((l) => l.type === 'objectgroup').objects = kept;
map.nextobjectid = nextId;
writeFileSync(file, JSON.stringify(map, null, 1) + '\n');
console.log(
  `${config.map}: template with ${config.generated.length} generated area(s), ${species.length} species`,
);
