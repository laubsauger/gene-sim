// Complex behaviors for entities
import type { GeneSpec } from './types';

export function calculateGroupBehavior(
  i: number,
  pos: Float32Array,
  vel: Float32Array,
  alive: Uint8Array,
  energy: Float32Array,
  tribeId: Uint16Array,
  genes: Float32Array,
  count: number,
  world: { width: number; height: number },
  rand: () => number,
  dt: number
): { vx: number; vy: number; fight: number | null; switchTribe: boolean } {
  const G = 6;
  const base = i * G;
  const px = pos[i * 2], py = pos[i * 2 + 1];
  const vision = genes[base + 1];
  const aggression = genes[base + 4];
  const cohesion = genes[base + 5];
  const speed = genes[base];
  const myTribe = tribeId[i];
  const myEnergy = energy[i];
  
  // Accumulate forces
  let separationX = 0, separationY = 0;
  let alignmentX = 0, alignmentY = 0;
  let cohesionX = 0, cohesionY = 0;
  let avoidX = 0, avoidY = 0;
  
  let nearbyAllies = 0;
  let nearbyEnemies = 0;
  let nearestEnemy = -1;
  let nearestEnemyDist = vision * 10;
  let dominantTribe = myTribe;
  let tribeCounts = new Map<number, number>();
  tribeCounts.set(myTribe, 1);
  
  const visionDist = vision * 8;
  
  // Check nearby entities
  for (let j = 0; j < count; j++) {
    if (j === i || !alive[j]) continue;
    
    const dx = pos[j * 2] - px;
    const dy = pos[j * 2 + 1] - py;
    const dist = Math.hypot(dx, dy);
    
    if (dist > visionDist) continue;
    
    const otherTribe = tribeId[j];
    const isAlly = otherTribe === myTribe;
    
    // Track tribe counts for switching
    tribeCounts.set(otherTribe, (tribeCounts.get(otherTribe) || 0) + 1);
    
    if (isAlly) {
      nearbyAllies++;
      
      // Flocking behaviors for allies
      if (dist < vision * 2) {
        // Separation - avoid crowding
        const force = Math.max(0, 1 - dist / (vision * 2));
        separationX -= (dx / dist) * force;
        separationY -= (dy / dist) * force;
      }
      
      if (dist < vision * 5) {
        // Alignment - match velocity
        alignmentX += vel[j * 2];
        alignmentY += vel[j * 2 + 1];
        
        // Cohesion - move towards group center
        cohesionX += pos[j * 2];
        cohesionY += pos[j * 2 + 1];
      }
    } else {
      nearbyEnemies++;
      
      // Track nearest enemy for fighting
      if (dist < nearestEnemyDist && energy[j] > 10) {
        nearestEnemy = j;
        nearestEnemyDist = dist;
      }
      
      // Avoid strong enemies
      const enemyBase = j * G;
      const enemyAggression = genes[enemyBase + 4];
      const threat = enemyAggression * (energy[j] / 100);
      
      if (threat > aggression * 0.7 || myEnergy < 30) {
        // Run away from threats
        const force = Math.max(0, 1 - dist / visionDist);
        avoidX -= (dx / dist) * force * 2;
        avoidY -= (dy / dist) * force * 2;
      }
    }
  }
  
  // Calculate final velocity
  let vx = vel[i * 2];
  let vy = vel[i * 2 + 1];
  
  // Apply flocking forces for allies
  if (nearbyAllies > 0) {
    // Normalize and weight forces
    if (alignmentX !== 0 || alignmentY !== 0) {
      const alignLen = Math.hypot(alignmentX, alignmentY);
      vx += (alignmentX / alignLen) * speed * 0.1 * cohesion;
      vy += (alignmentY / alignLen) * speed * 0.1 * cohesion;
    }
    
    if (cohesionX !== 0 || cohesionY !== 0) {
      cohesionX /= nearbyAllies;
      cohesionY /= nearbyAllies;
      const dx = cohesionX - px;
      const dy = cohesionY - py;
      const dist = Math.hypot(dx, dy) || 1;
      vx += (dx / dist) * speed * 0.15 * cohesion;
      vy += (dy / dist) * speed * 0.15 * cohesion;
    }
  }
  
  // Apply separation (always active)
  if (separationX !== 0 || separationY !== 0) {
    vx += separationX * speed * 0.3;
    vy += separationY * speed * 0.3;
  }
  
  // Apply avoidance (stronger than cohesion)
  if (avoidX !== 0 || avoidY !== 0) {
    vx += avoidX * speed * 0.5;
    vy += avoidY * speed * 0.5;
  }
  
  // Add some randomness for breakouts (reduced when in group)
  const randomFactor = Math.max(0.1, 1 - nearbyAllies * 0.1);
  vx += (rand() * 2 - 1) * speed * 0.2 * randomFactor;
  vy += (rand() * 2 - 1) * speed * 0.2 * randomFactor;
  
  // Decide on fighting
  let fightTarget: number | null = null;
  if (nearestEnemy >= 0 && nearestEnemyDist < vision * 2) {
    // Fight if aggressive, have energy, and close enough
    const fightChance = aggression * (myEnergy / 100) * (nearbyAllies / Math.max(1, nearbyEnemies));
    if (rand() < fightChance * dt) {
      fightTarget = nearestEnemy;
    }
  }
  
  // Decide on tribe switching
  let switchTribe = false;
  if (nearbyEnemies > nearbyAllies * 2 && myEnergy < 40) {
    // Consider switching to dominant local tribe when outnumbered and weak
    let maxCount = 1;
    for (const [tribe, count] of tribeCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantTribe = tribe;
      }
    }
    
    if (dominantTribe !== myTribe && rand() < 0.01 * dt) {
      switchTribe = true;
    }
  }
  
  return { vx, vy, fight: fightTarget, switchTribe };
}