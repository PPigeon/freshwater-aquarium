// Sprite loader — call loadAssets() once, returns a map of name→HTMLImageElement
// Falls back gracefully if a sprite file is missing

const SPRITE_PATHS = {
  // shrimp variants
  red_cherry_male:         'assets/sprites/red_cherry_male.png',
  red_cherry_female:       'assets/sprites/red_cherry_female.png',
  rili_male:               'assets/sprites/rili_male.png',
  rili_female:             'assets/sprites/rili_female.png',
  blue_dream_male:         'assets/sprites/blue_dream_male.png',
  blue_dream_female:       'assets/sprites/blue_dream_female.png',
  blue_rili_male:          'assets/sprites/blue_rili_male.png',
  blue_rili_female:        'assets/sprites/blue_rili_female.png',
  yellow_fire_male:        'assets/sprites/yellow_fire_male.png',
  yellow_fire_female:      'assets/sprites/yellow_fire_female.png',
  orange_pumpkin_male:     'assets/sprites/orange_pumpkin_male.png',
  orange_pumpkin_female:   'assets/sprites/orange_pumpkin_female.png',
  snowball_male:           'assets/sprites/snowball_male.png',
  snowball_female:         'assets/sprites/snowball_female.png',
  black_rose_male:         'assets/sprites/black_rose_male.png',
  black_rose_female:       'assets/sprites/black_rose_female.png',
  green_jade_male:         'assets/sprites/green_jade_male.png',
  green_jade_female:       'assets/sprites/green_jade_female.png',
  carbon_rili_male:        'assets/sprites/carbon_rili_male.png',
  carbon_rili_female:      'assets/sprites/carbon_rili_female.png',
  red_cherry_berried: 'assets/sprites/red_cherry_berried.png',
  molt:               'assets/sprites/molt.png',
  // plants
  rotala:    'assets/sprites/plants/rotala.png',
  java_fern: 'assets/sprites/plants/java_fern.png',
  anubias:   'assets/sprites/plants/anubias.png',
  crypt:      'assets/sprites/plants/crypt.png',
  vallisneria:'assets/sprites/plants/vallisneria.png',
  moss:       'assets/sprites/plants/moss.png',
  buce:       'assets/sprites/plants/buce.png',
  floating_salvinia: 'assets/sprites/plants/floating_salvinia.png',
  floating_redroot: 'assets/sprites/plants/floating_redroot.png',
  // hardscape — 5 driftwood + 5 rock species
  wood_spider:     'assets/sprites/hardscape/wood_spider.png',
  wood_manzanita:  'assets/sprites/hardscape/wood_manzanita.png',
  wood_malaysian:  'assets/sprites/hardscape/wood_malaysian.png',
  wood_mopani:     'assets/sprites/hardscape/wood_mopani.png',
  wood_redmoor:    'assets/sprites/hardscape/wood_redmoor.png',
  stone_seiryu_lg: 'assets/sprites/hardscape/stone_seiryu_lg.png',
  stone_seiryu_sm: 'assets/sprites/hardscape/stone_seiryu_sm.png',
  stone_dragon:    'assets/sprites/hardscape/stone_dragon.png',
  stone_lava:      'assets/sprites/hardscape/stone_lava.png',
  stone_frodo:     'assets/sprites/hardscape/stone_frodo.png',
  stone_pagoda:    'assets/sprites/hardscape/stone_pagoda.png',
  // background
  water_tile:  'assets/sprites/background/water_tile.png',
  background_films: 'assets/sprites/background/background_films.png',
  substrate:   'assets/sprites/background/substrate.png',
  food_wafer:  'assets/sprites/background/food_wafer.png',
  bubble:      'assets/sprites/background/bubble.png',
  neon_tetra:  'assets/sprites/background/neon_tetra.png',
  caustics:    'assets/sprites/background/caustics.png',
  led_fixture: 'assets/sprites/background/led_fixture.png',
};

function loadImage(name, path) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve([name, img]);
    img.onerror = () => {
      console.warn(`Sprite missing: ${path} — using fallback`);
      resolve([name, makeFallback(name)]);
    };
    img.src = path;
  });
}

// Tiny colored rectangle as fallback when sprites aren't generated yet
function makeFallback(name) {
  const w = 30, h = 10;
  const c = document.createElement('canvas');
  c.width = w * 6; c.height = h * 4;
  const ctx = c.getContext('2d');
  const colors = {
    red_cherry_male: '#c82820', red_cherry_female: '#c82820',
    rili_male: '#c82820', rili_female: '#c82820',
    blue_dream_male: '#3264c8', blue_dream_female: '#3264c8',
    blue_rili_male: '#3264c8', blue_rili_female: '#3264c8',
    yellow_fire_male: '#dcc81e', yellow_fire_female: '#dcc81e',
    orange_pumpkin_male: '#dc821e', orange_pumpkin_female: '#dc821e',
    snowball_male: '#e6e6f0', snowball_female: '#e6e6f0',
    black_rose_male: '#281923', black_rose_female: '#281923',
    green_jade_male: '#3ca050', green_jade_female: '#3ca050',
    carbon_rili_male: '#281923', carbon_rili_female: '#281923',
  };
  ctx.fillStyle = colors[name] || '#556677';
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      ctx.fillRect(col*w + 1, row*h + 2, w-2, h-4);
      ctx.fillStyle = colors[name] ? darkenHex(colors[name]) : '#334455';
      ctx.fillRect(col*w + 1, row*h + 1, 4, h-3);
      ctx.fillStyle = colors[name] || '#556677';
    }
  }
  const img = new Image();
  img.src = c.toDataURL();
  return img;
}

function darkenHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - 40);
  const g = Math.max(0, ((n >> 8) & 0xff) - 40);
  const b = Math.max(0, (n & 0xff) - 40);
  return `#${[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')}`;
}

export async function loadAssets() {
  const entries = await Promise.all(
    Object.entries(SPRITE_PATHS).map(([name, path]) => loadImage(name, path))
  );
  return Object.fromEntries(entries);
}

export const VARIANT_COLORS = {
  red_cherry:     '#c82820',
  rili:           '#c82820',
  blue_dream:     '#3264c8',
  blue_rili:      '#3264c8',
  yellow_fire:    '#dcc81e',
  orange_pumpkin: '#dc821e',
  snowball:       '#e6e6f0',
  black_rose:     '#281923',
  green_jade:     '#3ca050',
  carbon_rili:    '#281923',
};
