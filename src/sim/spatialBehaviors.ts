// Efficient behaviors using spatial hashing
import { SpatialHash } from './spatialHash';

export function efficientMovement(
  i: number,
  pos: Float32Array,
  vel: Float32Array,
  alive: Uint8Array,
  energy: Float32Array,
  tribeId: Uint16Array,
  genes: Float32Array,
  grid: SpatialHash,
  foodGrid: Float32Array,
  foodCols: number,
  foodRows: number,
  world: { width: number; height: number },
  rand: () => number,
  dt: number
): void {
  const G = 6;
  const base = i * G;
  const px = pos[i * 2], py = pos[i * 2 + 1];
  const speed = genes[base];
  const vision = genes[base + 1];
  const aggression = genes[base + 4];
  const cohesion = genes[base + 5];
  const myTribe = tribeId[i];
  const myEnergy = energy[i];
  
  // Accumulate neighbor influences (limited to spatial cells)
  let alignX = 0, alignY = 0;
  let separateX = 0, separateY = 0; 
  let cohesionX = 0, cohesionY = 0;
  let nearbyAllies = 0;
  let nearbyEnemies = 0;
  let totalNearby = 0;
  let nearestEnemy = -1;
  let nearestEnemyDist = vision * 3;
  let potentialMate = -1;
  let potentialMateDist = vision * 2;
  
  // Use spatial hash to only check nearby entities
  grid.forNeighbors(px, py, vision * 2, (j) => {
    if (j === i || !alive[j]) return;
    
    const dx = pos[j * 2] - px;
    const dy = pos[j * 2 + 1] - py;
    const distSq = dx * dx + dy * dy; // Use squared distance to avoid sqrt
    
    // Skip if too far
    if (distSq > vision * vision * 4) return;
    
    totalNearby++;
    const otherTribe = tribeId[j];
    
    // Universal separation for crowding (stronger when very close)
    if (distSq < 900) { // 30 units squared - personal space
      const dist = Math.sqrt(distSq) || 1;
      const crowdForce = Math.max(0, 1 - dist / 30);
      separateX -= (dx / dist) * crowdForce * 2;
      separateY -= (dy / dist) * crowdForce * 2;
    }
    
    if (otherTribe === myTribe) {
      // Ally behaviors
      nearbyAllies++;
      
      // Alignment - match velocity (only if not too crowded)
      if (totalNearby < 10) {
        alignX += vel[j * 2];
        alignY += vel[j * 2 + 1];
      }
      
      // Cohesion - move toward (but not if overcrowded)
      if (totalNearby < 15) {
        cohesionX += pos[j * 2];
        cohesionY += pos[j * 2 + 1];
      }
    } else {
      // Different tribe - could fight, mate, or ignore
      nearbyEnemies++;
      
      // Track for potential interactions
      if (distSq < nearestEnemyDist * nearestEnemyDist) {
        nearestEnemyDist = Math.sqrt(distSq);
        nearestEnemy = j;
      }
      
      // Also consider as potential mate if healthy
      if (energy[j] > 50 && distSq < potentialMateDist * potentialMateDist) {
        potentialMateDist = Math.sqrt(distSq);
        potentialMate = j;
      }
    }
  });
  
  // Apply flocking forces (but keep it light)
  let vx = vel[i * 2];
  let vy = vel[i * 2 + 1];
  
  if (nearbyAllies > 0) {
    // Normalize and apply forces with cohesion factor
    const cohesionFactor = cohesion * 0.1;
    
    // Alignment
    if (nearbyAllies > 1) {
      vx += (alignX / nearbyAllies - vx) * cohesionFactor;
      vy += (alignY / nearbyAllies - vy) * cohesionFactor;
    }
    
    // Cohesion (move toward center of mass)
    if (nearbyAllies > 2) {
      const centerX = cohesionX / nearbyAllies;
      const centerY = cohesionY / nearbyAllies;
      const dx = centerX - px;
      const dy = centerY - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      vx += (dx / dist) * speed * cohesionFactor * 0.5;
      vy += (dy / dist) * speed * cohesionFactor * 0.5;
    }
  }
  
  // Always apply separation (stronger force)
  vx += separateX * speed * 0.2;
  vy += separateY * speed * 0.2;
  
  // Inter-tribe interactions: Fight, Mate, or Ignore
  if (nearestEnemy >= 0 && nearestEnemyDist < vision * 1.5) {
    const interactionRoll = rand();
    const target = nearestEnemy;
    
    // Context affects interaction chances
    const stressFactor = (100 - myEnergy) / 100; // More stressed = more aggressive
    const crowdStress = Math.min(1, totalNearby / 20); // Crowding increases aggression
    const groupSupport = nearbyAllies / Math.max(1, nearbyEnemies); // Safety in numbers
    
    // Calculate interaction probabilities
    const fightChance = aggression * (0.5 + stressFactor * 0.3 + crowdStress * 0.2) * (1 + groupSupport * 0.2);
    const mateChance = (1 - aggression) * 0.15 * (myEnergy / 100); // Only mate when healthy
    const totalChance = fightChance + mateChance;
    
    if (interactionRoll < fightChance) {
      // FIGHT - most common with different tribes
      const targetEnergy = energy[target];
      
      // Damage based on aggression and group support
      const damage = (8 + nearbyAllies * 1.5) * aggression;
      energy[target] -= damage;
      
      // Steal energy
      const stolen = Math.min(damage * 0.5, targetEnergy * 0.3);
      energy[i] += stolen;
      
      // Kill if target is weakened
      if (energy[target] <= 0) {
        alive[target] = 0;
        energy[i] += Math.max(0, energy[target] + 10);
      }
    } else if (interactionRoll < totalChance && potentialMate >= 0 && energy[i] > 60) {
      // MATE - rare but creates hybrid offspring
      if (rand() < 0.3) { // 30% success rate for cross-tribe mating
        // Find a free slot for hybrid baby
        for (let k = 0; k < 100; k++) { // Limited search
          const j = Math.floor(rand() * grid.buckets.length);
          if (j < alive.length && !alive[j]) {
            // Create hybrid with mixed genes
            const mateBase = potentialMate * G;
            const hybridGenes = {
              speed: (genes[base] + genes[mateBase]) / 2,
              vision: (genes[base + 1] + genes[mateBase + 1]) / 2,
              metabolism: (genes[base + 2] + genes[mateBase + 2]) / 2,
              reproChance: (genes[base + 3] + genes[mateBase + 3]) / 2,
              aggression: (genes[base + 4] + genes[mateBase + 4]) / 2 * 0.8, // Hybrids less aggressive
              cohesion: (genes[base + 5] + genes[mateBase + 5]) / 2,
              colorHue: (rand() < 0.5) ? tribeId[i] * 120 : tribeId[potentialMate] * 120
            };
            
            // Spawn hybrid (inherits random parent's tribe)
            const hybridTribe = rand() < 0.5 ? myTribe : tribeId[potentialMate];
            // Note: would need to expose spawnEntity or inline it here
            // For now, just reduce energy cost
            energy[i] -= 20;
            energy[potentialMate] -= 20;
            break;
          }
        }
      }
    }
    // else IGNORE - no interaction
  }
  
  // Food seeking - gravitate to central lush area when hungry
  if (myEnergy < 70) {
    const cellX = Math.floor((px / world.width) * foodCols);
    const cellY = Math.floor((py / world.height) * foodRows); 
    
    // Quick check nearby food cells
    let foundFood = false;
    let foodDx = 0, foodDy = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const fx = cellX + dx;
        const fy = cellY + dy;
        if (fx >= 0 && fx < foodCols && fy >= 0 && fy < foodRows) {
          const foodIdx = fy * foodCols + fx;
          if (foodGrid[foodIdx] > 0.2) {
            foodDx += dx;
            foodDy += dy;
            foundFood = true;
          }
        }
      }
    }
    
    const hungerFactor = Math.max(0.3, 1 - myEnergy / 100);
    
    if (foundFood) {
      // Move toward local food
      vx += foodDx * speed * hungerFactor * 0.4;
      vy += foodDy * speed * hungerFactor * 0.4;
    } else if (myEnergy < 40) {
      // Desperate - head toward central lush area
      const centerX = world.width / 2;
      const centerY = world.height / 2;
      const toCenterX = centerX - px;
      const toCenterY = centerY - py;
      const dist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY) || 1;
      
      // Strong pull to center when starving
      vx += (toCenterX / dist) * speed * hungerFactor * 0.5;
      vy += (toCenterY / dist) * speed * hungerFactor * 0.5;
    }
  }
  
  // Crowd avoidance - flee if way too crowded
  if (totalNearby > 20) {
    // Panic mode - get away from crowds
    vx += separateX * speed * 0.5;
    vy += separateY * speed * 0.5;
  }
  
  // Random wander component (reduced when in optimal group size)
  const optimalGroup = 5;
  const groupDeviation = Math.abs(nearbyAllies - optimalGroup) / optimalGroup;
  const wanderFactor = Math.max(0.1, Math.min(1, groupDeviation * 0.3));
  vx += (rand() * 2 - 1) * speed * 0.2 * wanderFactor;
  vy += (rand() * 2 - 1) * speed * 0.2 * wanderFactor;
  
  // Update velocity with damping
  vel[i * 2] = vx * 0.95;
  vel[i * 2 + 1] = vy * 0.95;
}