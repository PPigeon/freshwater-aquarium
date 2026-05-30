// Simulation clock — biological events driven by real elapsed time
// All state persisted to localStorage

const SAVE_KEY = 'aquarium_v3';

const DEFAULT_STATE = {
  lastSave: Date.now(),
  tankAgeMs: 0,
  plantGrowthStages: [0, 0, 0, 0, 0],
  plantOffsets: [2, 0, 1, 2, 1],   // per-plant starting maturity (in grow-interval units)
  shrimpPopulation: [],
  moltEvents: [],
  berriedUntil: {},
  nextMoltAt: 0,
  dayCounter: 1,
};

const PLANT_GROW_INTERVAL  = 6 * 60 * 60 * 1000;  // 6 real hours
const BERRIED_DURATION     = 4 * 7 * 24 * 60 * 60 * 1000; // 4 weeks
const MOLT_INTERVAL_MIN    = 2 * 60 * 60 * 1000;
const MOLT_INTERVAL_MAX    = 4 * 60 * 60 * 1000;
const MOLT_FADE_DURATION   = 20 * 60 * 1000;       // 20 min
const MAX_SHRIMP           = 20;

const VARIANTS = ['red_cherry'];

export class Simulation {
  constructor() {
    this.state = this._load();
    this._ensurePopulation();
  }

  _load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return { ...DEFAULT_STATE, ...s };
      }
    } catch(e) {}
    return { ...DEFAULT_STATE, nextMoltAt: Date.now() + this._randMoltInterval() };
  }

  save() {
    this.state.lastSave = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch(e) {}
  }

  _randMoltInterval() {
    return MOLT_INTERVAL_MIN + Math.random() * (MOLT_INTERVAL_MAX - MOLT_INTERVAL_MIN);
  }

  _ensurePopulation() {
    // Seed initial shrimp if none exist
    if (!this.state.shrimpPopulation.length) {
      const initial = [
        'red_cherry','red_cherry','red_cherry','red_cherry',
        'red_cherry','red_cherry','red_cherry','red_cherry',
      ];
      this.state.shrimpPopulation = initial.map((v, i) => this._createShrimp(v, i));
      return;
    }
    this.state.shrimpPopulation = this.state.shrimpPopulation.map((s) => ({
      ...s,
      variant: 'red_cherry',
      sex: Math.random() < 0.48 ? 'male' : 'female',
    }));
  }

  _createShrimp(variant, id) {
    return {
      id: id ?? Date.now() + Math.random(),
      variant,
      sex: Math.random() < 0.48 ? 'male' : 'female',
      isBerried: false,
      isMolt: false,
      isJuvenile: Math.random() < 0.15,
      spawnedAt: Date.now(),
    };
  }

  // Call once per frame with real delta ms
  tick(nowMs) {
    const s = this.state;
    const elapsed = nowMs - (s.lastTickAt || nowMs);
    s.lastTickAt = nowMs;
    s.tankAgeMs += elapsed;

    // Day counter
    s.dayCounter = Math.max(1, Math.floor(s.tankAgeMs / (24 * 60 * 60 * 1000)) + 1);

    // Plant growth — per-plant offset gives variety from day 1
    for (let i = 0; i < s.plantGrowthStages.length; i++) {
      const offset = (s.plantOffsets?.[i] ?? DEFAULT_STATE.plantOffsets[i] ?? 0) * PLANT_GROW_INTERVAL;
      const stage = Math.min(2, Math.floor((s.tankAgeMs + offset) / PLANT_GROW_INTERVAL));
      s.plantGrowthStages[i] = stage;
    }

    // Molt events
    if (nowMs >= s.nextMoltAt && s.shrimpPopulation.length > 0) {
      const idx = Math.floor(Math.random() * s.shrimpPopulation.length);
      const shrimp = s.shrimpPopulation[idx];
      s.moltEvents.push({ shrimpId: shrimp.id, spawnedAt: nowMs, x: -1, y: -1 });
      s.nextMoltAt = nowMs + this._randMoltInterval();
    }

    // Expire molt shells
    s.moltEvents = s.moltEvents.filter(m => nowMs - m.spawnedAt < MOLT_FADE_DURATION);

    // Berried females hatch
    for (const [id, until] of Object.entries(s.berriedUntil)) {
      if (nowMs > until) {
        delete s.berriedUntil[id];
        const shrimp = s.shrimpPopulation.find(sh => sh.id == id);
        if (shrimp) shrimp.isBerried = false;
        // Spawn 1-3 shrimplets
        if (s.shrimpPopulation.length < MAX_SHRIMP) {
          const count = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < count && s.shrimpPopulation.length < MAX_SHRIMP; i++) {
            const parent = s.shrimpPopulation.find(sh => sh.id == id);
            const variant = parent?.variant ?? VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
            const baby = this._createShrimp(variant);
            baby.isJuvenile = true;
            s.shrimpPopulation.push(baby);
          }
        }
      }
    }

    // Occasionally make a female berried
    if (Math.random() < 0.00005 * elapsed / 1000) {
      const females = s.shrimpPopulation.filter(
        sh => sh.sex === 'female' && !sh.isBerried && !sh.isJuvenile && sh.variant === 'red_cherry'
      );
      if (females.length > 0) {
        const f = females[Math.floor(Math.random() * females.length)];
        f.isBerried = true;
        s.berriedUntil[f.id] = nowMs + BERRIED_DURATION;
      }
    }
  }

  get population()      { return this.state.shrimpPopulation; }
  get moltEvents()      { return this.state.moltEvents; }
  get plantStages()     { return this.state.plantGrowthStages; }
  get dayCounter()      { return this.state.dayCounter; }
  get tankAgeMs()       { return this.state.tankAgeMs; }

  setMoltPosition(shrimpId, x, y) {
    const m = this.state.moltEvents.find(e => e.shrimpId === shrimpId && e.x === -1);
    if (m) { m.x = x; m.y = y; }
  }
}
