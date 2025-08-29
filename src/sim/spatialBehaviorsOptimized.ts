// Optimized spatial behaviors with single-pass neighbor collection
// Maintains exact same behavior but with better performance
import { SpatialHash } from './spatialHash';

// Pre-allocated neighbor cache to avoid allocations - aggressively reduced for performance
const MAX_NEIGHBORS = 20;
interface NeighborCache {
  index: number;
  distSq: number;
  dx: number;
  dy: number;
  tribe: number;
  energy: number;
  isAlly: boolean;
  inView: boolean;
}

// Reusable neighbor array to avoid allocations
const neighborCache: NeighborCache[] = new Array(MAX_NEIGHBORS);
for (let i = 0; i < MAX_NEIGHBORS; i++) {
  neighborCache[i] = {
    index: 0,
    distSq: 0,
    dx: 0,
    dy: 0,
    tribe: 0,
    energy: 0,
    isAlly: false,
    inView: false
  };
}

export function efficientMovementOptimized(
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
  _dt: number,
  killsByTribe?: Uint32Array,
  deathsByTribe?: Uint32Array,
  color?: Uint8Array,
  birthsByTribe?: Uint32Array,
  allowHybrids?: boolean,
  orientation?: Float32Array,
  age?: Float32Array
): void {
  const G = 9;
  const base = i * G;
  const px = pos[i * 2], py = pos[i * 2 + 1];
  
  // Pre-fetch all genes for better cache locality
  const rawSpeed = genes[base];
  const vision = genes[base + 1];
  const metabolism = genes[base + 2];
  // const reproChance = genes[base + 3]; // Not used in movement
  const aggression = genes[base + 4];
  const cohesion = genes[base + 5];
  const foodStandards = genes[base + 6] || 0.3;
  const diet = genes[base + 7] || -0.5;
  const viewAngle = (genes[base + 8] || 120) * Math.PI / 180;
  
  // Pre-calculate frequently used values
  const metabolismEfficiency = Math.min(1, metabolism / 0.15);
  const speed = rawSpeed * metabolismEfficiency;
  const myTribe = tribeId[i];
  const myEnergy = energy[i];
  const carnivoreLevel = Math.max(0, diet);
  const isHunter = carnivoreLevel > 0.2;
  const huntingThreshold = 95 - (carnivoreLevel * 35);
  const shouldHunt = isHunter && myEnergy < huntingThreshold;
  const hungerDesperation = isHunter ? Math.max(0, (huntingThreshold - myEnergy) / huntingThreshold) : 0;
  
  // Pre-calculate view direction for dot product checks
  const myOrientation = orientation ? orientation[i] : Math.atan2(vel[i * 2 + 1], vel[i * 2]);
  const viewDirX = Math.cos(myOrientation);
  const viewDirY = Math.sin(myOrientation);
  const viewCosThreshold = Math.cos(viewAngle / 2);
  
  // Determine max search radius - reduce for performance
  const huntVision = shouldHunt ? vision * Math.min(1.5, 1.2 + hungerDesperation * 0.3) : vision;
  const maxVision = Math.max(vision, huntVision);
  const visionSq = vision * vision;
  const huntVisionSq = huntVision * huntVision;
  
  // SINGLE PASS: Collect ALL neighbor data at once
  let neighborCount = 0;
  let alignX = 0, alignY = 0;
  let separateX = 0, separateY = 0;
  let cohesionX = 0, cohesionY = 0;
  let nearbyAllies = 0;
  let nearbyEnemies = 0;
  let huntingAllies = 0;
  let satiatedAllies = 0;
  
  // Tracking for best targets
  let nearestEnemy = -1;
  let nearestEnemyDistSq = visionSq * 9; // 3x vision squared
  let potentialMate = -1;
  let potentialMateDistSq = visionSq * 4; // 2x vision squared
  let bestPrey = -1;
  let bestPreyScore = -1;
  
  // Single neighbor search - collect everything we need
  grid.forNeighborsWithLimit(px, py, maxVision, MAX_NEIGHBORS, (j) => {
    if (j === i || !alive[j]) return false;
    
    const dx = pos[j * 2] - px;
    const dy = pos[j * 2 + 1] - py;
    const distSq = dx * dx + dy * dy;
    
    // Skip if beyond max vision
    if (distSq > huntVisionSq) return false;
    
    // Simplified view angle check - only check if view angle is restrictive
    let inView = true;
    if (viewAngle < 2.5) { // Only check if FOV < ~143 degrees
      const dist = Math.sqrt(distSq);
      const dirX = dx / dist;
      const dirY = dy / dist;
      const dotProduct = dirX * viewDirX + dirY * viewDirY;
      inView = dotProduct > viewCosThreshold;
      if (!inView) return false;
    }
    
    // Cache neighbor data
    const otherTribe = tribeId[j];
    const otherEnergy = energy[j];
    const isAlly = otherTribe === myTribe;
    
    // Store in cache for reuse
    if (neighborCount < MAX_NEIGHBORS) {
      const cached = neighborCache[neighborCount];
      cached.index = j;
      cached.distSq = distSq;
      cached.dx = dx;
      cached.dy = dy;
      cached.tribe = otherTribe;
      cached.energy = otherEnergy;
      cached.isAlly = isAlly;
      cached.inView = true;
      neighborCount++;
    }
    
    // Process separation (universal crowding) - only for very close entities
    if (distSq < 400) { // Reduced from 900 to 400 (20² instead of 30²)
      const dist = Math.sqrt(distSq);
      const crowdForce = (20 - dist) / 20;
      if (crowdForce > 0) {
        const factor = crowdForce * 3 / dist; // Stronger force to compensate
        separateX -= dx * factor;
        separateY -= dy * factor;
      }
    }
    
    if (isAlly && distSq < visionSq) {
      nearbyAllies++;
      
      // Alignment (only if not overcrowded)
      if (neighborCount < 10) {
        alignX += vel[j * 2];
        alignY += vel[j * 2 + 1];
      }
      
      // Cohesion
      if (neighborCount < 15) {
        cohesionX += pos[j * 2];
        cohesionY += pos[j * 2 + 1];
      }
      
      // Check if ally is hunting (for pack bonus)
      if (isHunter && cohesion > 0.4) {
        const allyBase = j * G;
        const allyDiet = genes[allyBase + 7] || -0.5;
        const allyCarnivore = Math.max(0, allyDiet);
        if (allyCarnivore > 0.2 && otherEnergy < 70) {
          huntingAllies++;
        }
      }
      
      // Check if ally is satiated (for conservation)
      if (otherEnergy > 70) {
        satiatedAllies++;
      }
    } else if (distSq < visionSq) {
      nearbyEnemies++;
      
      // Track nearest enemy
      if (distSq < nearestEnemyDistSq) {
        nearestEnemyDistSq = distSq;
        nearestEnemy = j;
      }
      
      // Track potential mate
      if (otherEnergy > 50 && distSq < potentialMateDistSq) {
        potentialMateDistSq = distSq;
        potentialMate = j;
      }
    }
    
    // Prey evaluation for hunters (within hunt vision)
    if (shouldHunt && distSq < huntVisionSq) {
      // Calculate prey score
      const dist = Math.sqrt(distSq);
      let preyScore = (100 - otherEnergy) / 100; // Prefer weak
      preyScore += (1 - dist / huntVision) * 0.5; // Prefer close
      preyScore *= (1 + hungerDesperation * 0.5); // Hunger factor
      
      if (!isAlly) {
        preyScore += 1; // Prefer other tribes
      } else {
        // Cannibalism check
        const cannibalismWillingness = carnivoreLevel * 0.5 + (50 - myEnergy) / 100;
        if (cannibalismWillingness < 0.6) return true;
        preyScore *= 0.3;
      }
      
      if (preyScore > bestPreyScore) {
        bestPrey = j;
        bestPreyScore = preyScore;
      }
    }
    
    return true;
  });
  
  // Calculate derived values
  const totalNearby = neighborCount;
  const crowdStress = Math.min(1, totalNearby / 15);
  const reproductiveCrowdLimit = 0.7;
  const packHuntBonus = nearbyAllies > 0 && isHunter && cohesion > 0.4 
    ? Math.min(1, huntingAllies * 0.2) * cohesion 
    : 0;
  
  // Conservation check
  const neighborhoodSatiation = nearbyAllies > 0 ? satiatedAllies / nearbyAllies : 0;
  const conservationMode = neighborhoodSatiation > 0.7 && myEnergy > 40;
  
  // Apply movement forces
  let vx = vel[i * 2];
  let vy = vel[i * 2 + 1];
  
  // Flocking forces for allies
  if (nearbyAllies > 0) {
    const cohesionFactor = cohesion * 0.1 * (1 + packHuntBonus);
    
    // Alignment
    if (nearbyAllies > 1) {
      vx += (alignX / nearbyAllies - vx) * cohesionFactor;
      vy += (alignY / nearbyAllies - vy) * cohesionFactor;
    }
    
    // Cohesion
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
  
  // Always apply separation
  vx += separateX * speed * 0.2;
  vy += separateY * speed * 0.2;
  
  // Hunting behavior
  if (shouldHunt && !conservationMode && bestPrey >= 0) {
    nearestEnemy = bestPrey;
    nearestEnemyDistSq = neighborCache.find(n => n.index === bestPrey)?.distSq || nearestEnemyDistSq;
    
    // Pack hunting coordination
    if (cohesion > 0.5 && carnivoreLevel > 0.3) {
      const preyX = pos[bestPrey * 2];
      const preyY = pos[bestPrey * 2 + 1];
      const toPrey = Math.atan2(preyY - py, preyX - px);
      const packAngle = toPrey + (rand() - 0.5) * Math.PI * 0.5;
      const packSpeed = speed * (1 + cohesion * 0.3);
      vx += Math.cos(packAngle) * packSpeed * 0.4;
      vy += Math.sin(packAngle) * packSpeed * 0.4;
    }
  }
  
  // Combat/mating interactions
  if (nearestEnemy >= 0 && nearestEnemyDistSq < visionSq) {
    const target = nearestEnemy;
    const stressFactor = (100 - myEnergy) / 100;
    const groupSupport = nearbyAllies / Math.max(1, nearbyEnemies);
    const huntingDrive = Math.max(0, diet);
    const dietFightBonus = huntingDrive * 0.5;
    const hungerAggressionBoost = isHunter ? hungerDesperation * 0.4 : 0;
    const packHuntingMultiplier = 1 + packHuntBonus * 0.5;
    const fightChance = (aggression + dietFightBonus + hungerAggressionBoost) * 
                       (0.3 + stressFactor * 0.2 + crowdStress * 0.2) * 
                       Math.min(2, 1 + groupSupport * 0.2) * 
                       packHuntingMultiplier;
    
    if (rand() < fightChance) {
      // Combat logic (same as original)
      const targetEnergy = energy[target];
      const carnivoreBonus = 1 + huntingDrive * 0.5;
      const packDamageBonus = 1 + packHuntBonus * 0.5;
      const damage = (8 + nearbyAllies * 1.5) * aggression * carnivoreBonus * packDamageBonus;
      energy[target] -= damage;
      
      if (carnivoreLevel > 0) {
        const absorptionRate = carnivoreLevel;
        const stolen = Math.min(damage * absorptionRate * 1.5, targetEnergy * 0.7);
        energy[i] += stolen;
      }
      
      if (energy[target] <= 0) {
        alive[target] = 0;
        if (carnivoreLevel > 0) {
          const corpseEnergy = Math.max(40, targetEnergy * 0.75);
          energy[i] += corpseEnergy * carnivoreLevel * 1.5;
        }
        if (killsByTribe && deathsByTribe) {
          killsByTribe[myTribe]++;
          deathsByTribe[tribeId[target]]++;
        }
      }
    } else if (allowHybrids && potentialMate >= 0 && energy[i] > 50 && 
               energy[potentialMate] > 50 && crowdStress < reproductiveCrowdLimit) {
      // Mating logic (same as original but simplified)
      const mateChance = (1 - aggression) * 0.1 * (myEnergy / 100) * (1 - crowdStress);
      if (rand() < mateChance && rand() < 0.2) {
        // Find free slot for hybrid
        for (let j = 0; j < alive.length; j++) {
          if (!alive[j]) {
            // Create hybrid (keeping exact same logic as original)
            const mateBase = potentialMate * G;
            const parentX = (pos[i * 2] + pos[potentialMate * 2]) / 2;
            const parentY = (pos[i * 2 + 1] + pos[potentialMate * 2 + 1]) / 2;
            const spawnOffset = 10 + rand() * 10;
            const spawnAngle = rand() * Math.PI * 2;
            
            pos[j * 2] = parentX + Math.cos(spawnAngle) * spawnOffset;
            pos[j * 2 + 1] = parentY + Math.sin(spawnAngle) * spawnOffset;
            
            const ang = rand() * Math.PI * 2;
            const hybridRawSpeed = (genes[base] + genes[mateBase]) / 2;
            const hybridMetabolism = (genes[base + 2] + genes[mateBase + 2]) / 2;
            const hybridMetabEfficiency = Math.min(1, hybridMetabolism / 0.15);
            const hybridSpeed = hybridRawSpeed * hybridMetabEfficiency;
            
            vel[j * 2] = Math.cos(ang) * hybridSpeed * 0.5;
            vel[j * 2 + 1] = Math.sin(ang) * hybridSpeed * 0.5;
            
            alive[j] = 1;
            energy[j] = 40;
            tribeId[j] = 999; // Hybrid tribe
            
            // Set hybrid genes
            const jBase = j * G;
            genes[jBase] = hybridSpeed * (0.9 + rand() * 0.2);
            genes[jBase + 1] = (genes[base + 1] + genes[mateBase + 1]) / 2 * (0.9 + rand() * 0.2);
            genes[jBase + 2] = (genes[base + 2] + genes[mateBase + 2]) / 2 * (0.9 + rand() * 0.2);
            genes[jBase + 3] = (genes[base + 3] + genes[mateBase + 3]) / 2 * (0.9 + rand() * 0.2);
            genes[jBase + 4] = (genes[base + 4] + genes[mateBase + 4]) / 2 * 0.7;
            genes[jBase + 5] = (genes[base + 5] + genes[mateBase + 5]) / 2 * 1.2;
            genes[jBase + 6] = (genes[base + 6] + genes[mateBase + 6]) / 2 * (0.9 + rand() * 0.2);
            genes[jBase + 7] = (genes[base + 7] + genes[mateBase + 7]) / 2 * (0.9 + rand() * 0.2);
            genes[jBase + 8] = (genes[base + 8] + genes[mateBase + 8]) / 2 * (0.9 + rand() * 0.2);
            
            // Set hybrid color
            if (color) {
              color[j * 3] = 220;
              color[j * 3 + 1] = 220;
              color[j * 3 + 2] = 255;
            }
            
            // Set age
            if (age) {
              age[j] = 0;
            }
            
            // Track hybrid birth
            if (birthsByTribe) {
              // Hybrids don't have a birth counter, but we can track them
            }
            
            // Parent energy cost
            energy[i] -= 10;
            energy[potentialMate] -= 10;
            
            break;
          }
        }
      }
    }
  }
  
  // Food seeking behavior - simplified for performance
  let foodForceX = 0, foodForceY = 0;
  
  if (myEnergy < 80) {
    const cellWidth = world.width / foodCols;
    const cellHeight = world.height / foodRows;
    const fx = Math.floor((px / world.width) * foodCols);
    const fy = Math.floor((py / world.height) * foodRows);
    
    // Only check current cell and immediate neighbors if very hungry
    if (myEnergy < 40) {
      let bestFood = 0;
      let bestFoodX = 0, bestFoodY = 0;
      
      // Check 3x3 grid
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = fx + dx;
          const ny = fy + dy;
          if (nx >= 0 && nx < foodCols && ny >= 0 && ny < foodRows) {
            const idx = ny * foodCols + nx;
            const food = foodGrid[idx];
            if (food > bestFood && food > foodStandards) {
              bestFood = food;
              bestFoodX = (nx + 0.5) * cellWidth;
              bestFoodY = (ny + 0.5) * cellHeight;
            }
          }
        }
      }
      
      if (bestFood > 0) {
        const dx = bestFoodX - px;
        const dy = bestFoodY - py;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        const hungerUrgency = (40 - myEnergy) / 40;
        const urgency = 0.3 + hungerUrgency * 0.4;
        foodForceX = (dx / dist) * speed * urgency;
        foodForceY = (dy / dist) * speed * urgency;
      }
    } else {
      // Less hungry - just check current cell
      const idx = fy * foodCols + fx;
      if (foodGrid[idx] > foodStandards) {
        const centerX = (fx + 0.5) * cellWidth;
        const centerY = (fy + 0.5) * cellHeight;
        const dx = centerX - px;
        const dy = centerY - py;
        const distSq = dx * dx + dy * dy;
        if (distSq > 100) { // Only if not already at center
          const dist = Math.sqrt(distSq);
          foodForceX = (dx / dist) * speed * 0.2;
          foodForceY = (dy / dist) * speed * 0.2;
        }
      }
    }
  }
  
  // Apply food seeking
  vx += foodForceX;
  vy += foodForceY;
  
  // Add random wander
  vx += (rand() - 0.5) * speed * 0.1;
  vy += (rand() - 0.5) * speed * 0.1;
  
  // Update velocity
  vel[i * 2] = vx;
  vel[i * 2 + 1] = vy;
}