// Shrimp state machine + per-frame update logic

const FRAME_W = 30;
const FRAME_H = 10;
const SURFACE_Y = 15;

const ACTIVITY = {
  rest_idle: 'rest_idle',
  substrate_forage: 'substrate_forage',
  hardscape_graze: 'hardscape_graze',
  glass_graze: 'glass_graze',
  surface_film_graze: 'surface_film_graze',
  slow_swim: 'slow_swim',
  dart_escape: 'dart_escape',
  social_avoid_pass: 'social_avoid_pass',
};

const ACTIVITY_TO_ROW = {
  [ACTIVITY.substrate_forage]: 0,
  [ACTIVITY.social_avoid_pass]: 0,
  [ACTIVITY.rest_idle]: 1,
  [ACTIVITY.hardscape_graze]: 1,
  [ACTIVITY.glass_graze]: 1,
  [ACTIVITY.surface_film_graze]: 1,
  [ACTIVITY.slow_swim]: 3,
  [ACTIVITY.dart_escape]: 3,
};

const ACTIVITY_FRAMES = {
  [ACTIVITY.substrate_forage]: 6,
  [ACTIVITY.social_avoid_pass]: 6,
  [ACTIVITY.rest_idle]: 4,
  [ACTIVITY.hardscape_graze]: 4,
  [ACTIVITY.glass_graze]: 4,
  [ACTIVITY.surface_film_graze]: 4,
  [ACTIVITY.slow_swim]: 4,
  [ACTIVITY.dart_escape]: 4,
};

const FRAME_RATE = {
  [ACTIVITY.rest_idle]: 0.40,
  [ACTIVITY.substrate_forage]: 0.16,
  [ACTIVITY.hardscape_graze]: 0.22,
  [ACTIVITY.glass_graze]: 0.24,
  [ACTIVITY.surface_film_graze]: 0.24,
  [ACTIVITY.slow_swim]: 0.24,
  [ACTIVITY.dart_escape]: 0.09,
  [ACTIVITY.social_avoid_pass]: 0.11,
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export class Shrimp {
  constructor(data, tankW, tankH, substrateY) {
    this.id = data.id;
    this.variant = data.variant;
    this.sex = data.sex === 'male' ? 'male' : 'female';
    this.isBerried = data.isBerried;
    this.isMolt = false;
    this.isJuvenile = data.isJuvenile ?? false;
    this.scale = this.isJuvenile ? 0.24 : (this.sex === 'male' ? 0.34 : 0.38);

    this.tankW = tankW;
    this.tankH = tankH;
    this.subY = substrateY;

    this.x = 20 + Math.random() * (tankW - 40);
    this.y = substrateY - FRAME_H * this.scale;
    this.renderY = this.y;
    this.facing = Math.random() < 0.5 ? 1 : -1;
    this.surface = 'substrate';

    this.activityState = ACTIVITY.rest_idle;
    this.stateTimer = 1.4 + Math.random() * 1.2;
    this.stateCooldowns = {};
    this.desiredSpeed = 0;
    this.turnRate = 120;
    this.behaviorProfile = {
      roamBias: this.sex === 'male' ? 1.25 : 0.85,
      grazeBias: this.sex === 'male' ? 0.9 : 1.25,
    };

    this.vx = 0;
    this.vy = 0;
    this.burstVY = 0;
    this.gravity = 28;

    this.animFrame = 0;
    this.animTimer = 0;
    this.bobY = 0;
    this.bobTimer = 0;
    this.floatPhase = Math.random() * Math.PI * 2;
    this.rotationDeg = 0;
    this.pickTimer = 0;
    this.pickX = 0;
    this.pickY = 0;

    this.targetFood = null;
    this.avoidTimer = 0;
    this.searchSweepTimer = this.sex === 'male' ? (8 + Math.random() * 9) : Infinity;
    this.femaleForageTimer = this.sex === 'female' ? (6 + Math.random() * 6) : Infinity;
    this.socialTargetId = null;
  }

  get spriteKey() {
    if (this.isMolt) return 'molt';
    if (this.isBerried && this.variant === 'red_cherry' && this.sex === 'female') return 'red_cherry_berried';
    return `${this.variant}_${this.sex}`;
  }

  update(dt, _nightFactor, foodParticles, allShrimp = []) {
    this._tickCooldowns(dt);
    this._updateAnimation(dt);
    this._updateActivity(dt, foodParticles, allShrimp);
    this._applyPhysics(dt);
    this._separateFromNeighbors(dt, allShrimp);
    this._clamp();
  }

  _tickCooldowns(dt) {
    for (const k of Object.keys(this.stateCooldowns)) {
      this.stateCooldowns[k] = Math.max(0, this.stateCooldowns[k] - dt);
    }
    if (this.sex === 'male') this.searchSweepTimer -= dt;
    if (this.sex === 'female') this.femaleForageTimer -= dt;
  }

  _updateAnimation(dt) {
    this.animTimer += dt;
    const frameLen = FRAME_RATE[this.activityState] ?? 0.2;
    if (this.animTimer >= frameLen) {
      this.animTimer -= frameLen;
      this.animFrame = (this.animFrame + 1) % (ACTIVITY_FRAMES[this.activityState] ?? 4);
    }
  }

  _updatePickingMotion(dt, intensity = 1) {
    this.pickTimer += dt;
    const pulse = Math.sin(this.pickTimer * 9.0);
    const paw = Math.sin(this.pickTimer * 18.0);
    this.pickX = pulse * 0.06 * intensity + paw * 0.02 * intensity;
    this.pickY = Math.max(0, Math.sin(this.pickTimer * 11.0)) * 0.06 * intensity;
  }

  _setState(next, minT, maxT) {
    this.activityState = next;
    this.stateTimer = minT + Math.random() * (maxT - minT);
    this.animFrame = 0;
    this.animTimer = 0;
    this.stateCooldowns[next] = 0.9 + Math.random() * 0.9;
  }

  _canUse(state) {
    return (this.stateCooldowns[state] ?? 0) <= 0;
  }

  _chooseNextState(allShrimp = []) {
    const states = [
      { key: ACTIVITY.rest_idle, w: 0.9 },
      { key: ACTIVITY.substrate_forage, w: 2.0 * this.behaviorProfile.grazeBias },
      { key: ACTIVITY.hardscape_graze, w: 1.0 * this.behaviorProfile.grazeBias },
      { key: ACTIVITY.glass_graze, w: 0.18 },
      { key: ACTIVITY.surface_film_graze, w: 0.12 },
      { key: ACTIVITY.slow_swim, w: 1.0 * this.behaviorProfile.roamBias },
      { key: ACTIVITY.dart_escape, w: this.sex === 'male' ? 0.2 : 0.12 },
      { key: ACTIVITY.social_avoid_pass, w: 0.35 },
    ].filter(s => this._canUse(s.key));

    if (this.sex === 'male' && this.searchSweepTimer <= 0 && this._canUse(ACTIVITY.slow_swim)) {
      this.searchSweepTimer = 12 + Math.random() * 12;
      return ACTIVITY.slow_swim;
    }
    if (this.sex === 'female' && this.femaleForageTimer <= 0 && this._canUse(ACTIVITY.substrate_forage)) {
      this.femaleForageTimer = 9 + Math.random() * 11;
      return ACTIVITY.substrate_forage;
    }

    const nearby = allShrimp.filter(s => s !== this && this._distTo(s) < 10);
    if (nearby.length >= 2 && this._canUse(ACTIVITY.social_avoid_pass)) return ACTIVITY.social_avoid_pass;

    let total = 0;
    for (const s of states) total += s.w;
    let r = Math.random() * total;
    for (const s of states) {
      r -= s.w;
      if (r <= 0) return s.key;
    }
    return ACTIVITY.rest_idle;
  }

  _updateActivity(dt, foodParticles, allShrimp) {
    this.stateTimer -= dt;

    if (foodParticles && foodParticles.length > 0) {
      const closest = this._closestFood(foodParticles);
      if (closest && this._distTo(closest) < 56) {
        this.targetFood = closest;
        if (this.activityState !== ACTIVITY.substrate_forage) {
          this._setState(ACTIVITY.substrate_forage, 1.5, 2.5);
        }
      }
    } else {
      this.targetFood = null;
    }

    if (this.stateTimer <= 0) {
      let next = this._chooseNextState(allShrimp);
      const wallMargin = FRAME_W * this.scale * 0.9;
      const nearWall = this.x < wallMargin || this.x > (this.tankW - wallMargin);
      const nearSurface = this.y < SURFACE_Y + 9;
      if (next === ACTIVITY.glass_graze && !nearWall) next = ACTIVITY.substrate_forage;
      if (next === ACTIVITY.surface_film_graze && !nearSurface) next = ACTIVITY.slow_swim;
      if (next === ACTIVITY.rest_idle) this._setState(next, 1.1, 2.6);
      else if (next === ACTIVITY.substrate_forage) this._setState(next, 2.0, 4.2);
      else if (next === ACTIVITY.hardscape_graze) this._setState(next, 1.4, 2.8);
      else if (next === ACTIVITY.glass_graze) this._setState(next, 1.2, 2.3);
      else if (next === ACTIVITY.surface_film_graze) this._setState(next, 1.0, 2.1);
      else if (next === ACTIVITY.slow_swim) this._setState(next, 1.8, 3.5);
      else if (next === ACTIVITY.dart_escape) this._setState(next, 0.45, 0.8);
      else if (next === ACTIVITY.social_avoid_pass) this._setState(next, 0.8, 1.6);
    }

    this._executeState(dt, allShrimp);
  }

  _executeState(dt, allShrimp) {
    const restY = this.subY - FRAME_H * this.scale;
    switch (this.activityState) {
      case ACTIVITY.rest_idle:
        this.surface = 'substrate';
        this.desiredSpeed = 0;
        this.vx = this._approach(this.vx, 0, dt * 5.5);
        this.vy = this._approach(this.vy, 0, dt * 5.5);
        this.bobTimer += dt;
        this.bobY = Math.sin(this.bobTimer * 1.3) * 0.08;
        this.pickX = 0;
        this.pickY = 0;
        break;
      case ACTIVITY.substrate_forage: {
        this.surface = 'substrate';
        let dir = this.facing;
        if (this.targetFood) {
          const dx = this.targetFood.x - this.x;
          dir = Math.abs(dx) < 0.2 ? this.facing : Math.sign(dx);
          const dist = Math.abs(dx);
          this.desiredSpeed = 0.45 + Math.min(1.95, dist * 0.09);
        } else {
          if (Math.random() < 0.003) dir = -dir;
          this.desiredSpeed = this.sex === 'male' ? 1.25 : 0.95;
        }
        this.facing = dir || this.facing;
        this.vx = this._approach(this.vx, this.facing * this.desiredSpeed, dt * 4.8);
        this.vy = this._approach(this.vy, 0, dt * 5.2);
        this.y = this._approach(this.y, restY, dt * 10);
        this._updatePickingMotion(dt, this.targetFood ? 1.25 : 0.9);
        this.bobY = this.pickY;
        break;
      }
      case ACTIVITY.hardscape_graze:
        this.surface = 'substrate';
        this.desiredSpeed = this.sex === 'male' ? 0.7 : 0.55;
        this.vx = this._approach(this.vx, this.facing * this.desiredSpeed, dt * 4.0);
        this.vy = this._approach(this.vy, -0.12, dt * 2.2);
        this.y = this._approach(this.y, restY - 1.5, dt * 7.2);
        this._updatePickingMotion(dt, 0.85);
        this.bobY = this.pickY * 0.8;
        break;
      case ACTIVITY.glass_graze: {
        this.surface = 'glass';
        const left = FRAME_W * this.scale * 0.65;
        const right = this.tankW - FRAME_W * this.scale * 0.65;
        const side = this.x < this.tankW / 2 ? left : right;
        this.facing = side === left ? 1 : -1;
        this.x = this._approach(this.x, side, dt * 8.5);
        this.vx = this._approach(this.vx, 0, dt * 6.0);
        this.vy = this._approach(this.vy, Math.sin((this.bobTimer += dt) * 0.8) * 0.32, dt * 1.8);
        this.rotationDeg = this._approachAngle(this.rotationDeg, side === left ? -72 : 72, dt * 120);
        this.pickX = 0;
        this.pickY = 0;
        break;
      }
      case ACTIVITY.surface_film_graze:
        this.surface = 'surface';
        this.floatPhase += dt;
        this.vx = this._approach(this.vx, this.facing * (0.55 + Math.sin(this.floatPhase * 0.5) * 0.12), dt * 2.0);
        this.y = this._approach(this.y, SURFACE_Y + 2, dt * 7.0);
        this.vy = this._approach(this.vy, 0.08, dt * 2.8);
        this.rotationDeg = this._approachAngle(this.rotationDeg, 0, dt * 96);
        this.bobY = Math.sin(this.floatPhase * 2.0) * 0.1;
        this.pickX = 0;
        this.pickY = 0;
        break;
      case ACTIVITY.slow_swim:
        this.surface = 'water';
        if (Math.random() < 0.003 * this.behaviorProfile.roamBias) this.facing = -this.facing;
        this.floatPhase += dt;
        this.desiredSpeed = (this.sex === 'male' ? 1.75 : 1.25) + Math.sin(this.floatPhase * 0.6) * 0.35;
        this.vx = this._approach(this.vx, this.facing * this.desiredSpeed, dt * 2.6);
        this.vy = this._approach(this.vy, Math.sin(this.floatPhase * 1.25 + this.id * 0.1) * 0.7, dt * 1.6);
        this.rotationDeg = this._approachAngle(this.rotationDeg, 0, dt * 120);
        this.pickX = 0;
        this.pickY = 0;
        break;
      case ACTIVITY.dart_escape:
        this.surface = 'water';
        if (Math.abs(this.burstVY) < 0.001) {
          this.burstVY = -(20 + Math.random() * (this.sex === 'male' ? 18 : 12));
          this.vx = this.facing * (3.8 + Math.random() * 2.8);
        }
        this.burstVY += this.gravity * dt;
        this.y += this.burstVY * dt;
        this.rotationDeg = this._approachAngle(this.rotationDeg, this.facing > 0 ? -10 : 10, dt * 90);
        this.pickX = 0;
        this.pickY = 0;
        break;
      case ACTIVITY.social_avoid_pass: {
        this.surface = 'water';
        const nearby = allShrimp.filter(s => s !== this).sort((a, b) => this._distTo(a) - this._distTo(b));
        const target = nearby[0];
        if (target) {
          this.socialTargetId = target.id;
          const dx = this.x - target.x;
          const dy = this.y - target.y;
          const dir = dx >= 0 ? 1 : -1;
          this.facing = dir;
          this.vx = this._approach(this.vx, dir * 1.8, dt * 3.4);
          this.vy = this._approach(this.vy, (dy >= 0 ? 0.8 : -0.8), dt * 3.2);
        }
        this.rotationDeg = this._approachAngle(this.rotationDeg, 0, dt * 110);
        this.pickX = 0;
        this.pickY = 0;
        break;
      }
    }
  }

  _applyPhysics(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const restY = this.subY - FRAME_H * this.scale;
    if (this.activityState === ACTIVITY.slow_swim || this.activityState === ACTIVITY.social_avoid_pass) {
      const minY = SURFACE_Y + 6;
      const maxY = restY - 4;
      if (this.y < minY) { this.y = minY; this.vy = Math.abs(this.vy) * 0.5; }
      if (this.y > maxY) { this.y = maxY; this.vy = -Math.abs(this.vy) * 0.45; }
    } else if (this.activityState === ACTIVITY.dart_escape) {
      if (this.y >= restY - 1.5) {
        this.y = restY - 1.5;
        this.burstVY = 0;
      }
    } else if (this.activityState !== ACTIVITY.glass_graze && this.activityState !== ACTIVITY.surface_film_graze) {
      this.y = this._approach(this.y, restY, dt * 14);
      this.rotationDeg = this._approachAngle(this.rotationDeg, 0, dt * 180);
    }

    // Vector art is resolution-independent — keep sub-pixel motion (no snap).
    this.renderY = this.y + this.bobY;
  }

  _clamp() {
    const margin = FRAME_W * this.scale * 0.58;
    if (this.x < margin) {
      this.x = margin;
      this.vx = Math.abs(this.vx);
      this.facing = 1;
    }
    if (this.x > this.tankW - margin) {
      this.x = this.tankW - margin;
      this.vx = -Math.abs(this.vx);
      this.facing = -1;
    }
  }

  _separateFromNeighbors(dt, allShrimp) {
    if (!allShrimp || allShrimp.length < 2) return;
    const personal = FRAME_W * this.scale * 0.48;
    let pushX = 0;
    let pushY = 0;
    let n = 0;
    for (const other of allShrimp) {
      if (other === this) continue;
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= 0.0001) continue;
      const d = Math.sqrt(d2);
      if (d < personal) {
        const strength = (personal - d) / personal;
        pushX += (dx / d) * strength;
        pushY += (dy / d) * strength * 0.35;
        n++;
      }
    }
    if (n > 0) {
      const avgX = pushX / n;
      const avgY = pushY / n;
      this.x += avgX * dt * 11;
      this.y += avgY * dt * 6;
      this.vx += avgX * dt * 5;
      this.avoidTimer = Math.max(this.avoidTimer, 0.2);
    }
  }

  _closestFood(particles) {
    let best = null;
    let bestD = Infinity;
    for (const f of particles) {
      const d = this._distTo(f);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  _distTo(pt) {
    const dx = pt.x - this.x;
    const dy = pt.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _approach(value, target, maxDelta) {
    if (value < target) return Math.min(target, value + maxDelta);
    if (value > target) return Math.max(target, value - maxDelta);
    return target;
  }

  _approachAngle(value, target, maxDelta) {
    let delta = ((target - value + 540) % 360) - 180;
    if (Math.abs(delta) <= maxDelta) return target;
    return value + Math.sign(delta) * maxDelta;
  }

  get spriteSource() {
    const row = ACTIVITY_TO_ROW[this.activityState] ?? 1;
    const col = this.animFrame % (ACTIVITY_FRAMES[this.activityState] ?? 4);
    return { sx: col * FRAME_W, sy: row * FRAME_H, sw: FRAME_W, sh: FRAME_H };
  }
}

export function initShrimp(population, tankW, tankH, substrateY) {
  return population.map(data => new Shrimp(data, tankW, tankH, substrateY));
}
