// Optimized spatial behaviors with single-pass neighbor collection
// Maintains exact same behavior but with better performance
import { SpatialHash } from './spatialHash';
import { energyConfig } from './core/constants';
import { BiomeGenerator } from './biomes';

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
  age?: Float32Array,
  // Full arrays for multi-worker neighbor queries
  fullPos?: Float32Array,
  fullAlive?: Uint8Array,
  fullTribeId?: Uint16Array,
  fullGenes?: Float32Array,
  fullEnergy?: Float32Array,
  fullVel?: Float32Array,
  biomeGenerator?: BiomeGenerator
): void {
  const G = 9;
  const base = i * G;
  const px = pos[i * 2], py = pos[i * 2 + 1];
  
  // Use full arrays for neighbor queries if available (multi-worker mode)
  const queryPos = fullPos || pos;
  const queryAlive = fullAlive || alive;
  const queryTribeId = fullTribeId || tribeId;
  const queryGenes = fullGenes || genes;
  const queryEnergy = fullEnergy || energy;
  const queryVel = fullVel || vel;
  
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
  // Reduce metabolism coupling - use square root for gentler scaling
  // This gives: metabolism 0.05 -> 58% speed, 0.1 -> 82% speed, 0.15 -> 100% speed
  const metabolismEfficiency = Math.min(1, Math.sqrt(metabolism / 0.15));
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
    if (j === i || !queryAlive[j]) return false;
    
    if (j >= queryPos.length / 2) {
      return false;
    }
    
    const dx = queryPos[j * 2] - px;
    const dy = queryPos[j * 2 + 1] - py;
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
    const otherTribe = queryTribeId[j];
    const otherEnergy = queryEnergy[j];
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
    
    // Process separation (universal crowding) - entities need physical space
    // Increased personal space to prevent visual overlap
    const personalSpace = 40; // Increased from 25 to prevent overlap
    const personalSpaceSq = personalSpace * personalSpace; // 1600 units²
    if (distSq < personalSpaceSq) {
      const dist = Math.sqrt(distSq) + 0.1; // Avoid division by zero
      const crowdForce = (personalSpace - dist) / personalSpace;
      if (crowdForce > 0) {
        // Stronger exponential repulsion for very close entities
        const factor = Math.pow(crowdForce, 2) * 8 / dist; // Increased power and multiplier
        separateX -= dx * factor;
        separateY -= dy * factor;
      }
    }
    
    if (isAlly && distSq < visionSq) {
      nearbyAllies++;
      
      // Alignment (only if not overcrowded)
      if (neighborCount < 10) {
        alignX += queryVel[j * 2];
        alignY += queryVel[j * 2 + 1];
      }
      
      // Cohesion - store relative positions to avoid wrapping bias
      // (removed - we'll calculate cohesion from cached neighbors instead)
      
      // Check if ally is hunting (for pack bonus)
      if (isHunter && cohesion > 0.4) {
        const allyBase = j * G;
        const allyDiet = queryGenes[allyBase + 7] || -0.5;
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
  // Crowd stress increases more gradually - 20 neighbors is very crowded
  const crowdStress = Math.min(1, totalNearby / 20);
  const reproductiveCrowdLimit = 0.6; // Lower threshold for reproduction
  const packHuntBonus = nearbyAllies > 0 && isHunter && cohesion > 0.4 
    ? Math.min(1, huntingAllies * 0.2) * cohesion 
    : 0;
  
  // Threat assessment for cautious behavior
  const outnumberedRatio = nearbyEnemies > 0 ? nearbyAllies / nearbyEnemies : 1;
  const isOutnumbered = outnumberedRatio < 0.5; // Less than 1:2 ratio
  const isAlone = nearbyAllies < 2;
  const groupSize = nearbyAllies + 1; // Include self
  
  // Predator detection for herbivores
  let nearbyPredators = 0;
  let nearestPredatorDist = Infinity;
  for (let n = 0; n < neighborCount; n++) {
    const neighbor = neighborCache[n];
    if (!neighbor.isAlly && neighbor.inView) {
      const nIdx = neighbor.index;
      const nBase = nIdx * G;
      const nDiet = queryGenes ? queryGenes[nBase + 7] : genes[nBase + 7];
      if (nDiet > 0.3) { // Is a carnivore/strong omnivore
        nearbyPredators++;
        const dist = Math.sqrt(neighbor.distSq);
        if (dist < nearestPredatorDist) {
          nearestPredatorDist = dist;
        }
      }
    }
  }
  
  // Conservation check
  const neighborhoodSatiation = nearbyAllies > 0 ? satiatedAllies / nearbyAllies : 0;
  const conservationMode = neighborhoodSatiation > 0.7 && myEnergy > 40;
  
  // Cautious mode for carnivores/omnivores when outnumbered
  const cautiousMode = (carnivoreLevel > 0 || (diet > -0.3 && diet < 0.3)) && 
                       (isOutnumbered || isAlone) && 
                       aggression < 0.7; // Only if not highly aggressive
  
  // Fear mode for herbivores when predators are near - BUT hunger overrides fear
  const herbivoreLevel = Math.max(0, -diet); // 0 to 1 for herbivore strength
  const desperateForFood = myEnergy < 25; // Below 25 energy = desperate
  const veryHungry = myEnergy < 40; // Below 40 = very hungry
  
  // Fear is suppressed when desperate for food
  const fearMode = herbivoreLevel > 0.3 && // Is significantly herbivorous
                   nearbyPredators > 0 && 
                   groupSize < nearbyPredators * 3 && // Need 3:1 ratio to feel safe
                   !desperateForFood; // Desperation overrides fear completely
  
  // Apply movement forces
  let vx = vel[i * 2];
  let vy = vel[i * 2 + 1];
  
  // Avoidance behavior for fearful herbivores
  if (fearMode) {
    let avoidX = 0, avoidY = 0;
    let predatorCount = 0;
    
    // Calculate avoidance vector from all nearby predators
    for (let n = 0; n < neighborCount; n++) {
      const neighbor = neighborCache[n];
      if (!neighbor.isAlly && neighbor.inView) {
        const nIdx = neighbor.index;
        const nBase = nIdx * G;
        const nDiet = queryGenes ? queryGenes[nBase + 7] : genes[nBase + 7];
        if (nDiet > 0.3) { // Is a predator
          const dist = Math.sqrt(neighbor.distSq) + 0.1;
          const weight = 1 / (dist * dist); // Stronger avoidance for closer predators
          avoidX -= (neighbor.dx / dist) * weight;
          avoidY -= (neighbor.dy / dist) * weight;
          predatorCount++;
        }
      }
    }
    
    if (predatorCount > 0) {
      // Normalize and apply fear-based avoidance
      const avoidMag = Math.sqrt(avoidX * avoidX + avoidY * avoidY) + 0.001;
      avoidX /= avoidMag;
      avoidY /= avoidMag;
      
      // Fear intensity based on group support and predator proximity
      // BUT reduced significantly when hungry
      const baseFearIntensity = (1 - Math.min(1, groupSize / (nearbyPredators * 3))) * 
                                (1 - Math.min(1, nearestPredatorDist / vision));
      
      // Hunger reduces fear response - starvation makes entities brave/desperate
      const hungerBravery = veryHungry ? 0.3 : 1.0; // 70% reduction when very hungry
      const fearIntensity = baseFearIntensity * hungerBravery;
      
      // Apply avoidance force (much weaker when hungry)
      vx += avoidX * speed * (0.4 + fearIntensity * 0.4) * hungerBravery;
      vy += avoidY * speed * (0.4 + fearIntensity * 0.4) * hungerBravery;
    }
  }
  
  // Flocking forces for allies - enhanced for herbivore herding
  if (nearbyAllies > 0) {
    // Herbivores get stronger herding behavior
    const isHerbivore = diet < -0.3;
    const herdingBoost = isHerbivore ? 1.5 : 1.0;
    const cohesionFactor = cohesion * 0.1 * (1 + packHuntBonus) * herdingBoost;
    
    // Alignment - herbivores align more strongly
    if (nearbyAllies > 1) {
      const alignmentStrength = isHerbivore ? 1.2 : 1.0;
      vx += (alignX / nearbyAllies - vx) * cohesionFactor * alignmentStrength;
      vy += (alignY / nearbyAllies - vy) * cohesionFactor * alignmentStrength;
    }
    
    // Cohesion - moderated by hunger to allow food exploration
    // When hungry, drastically reduce cohesion forces
    const hungerModifier = myEnergy < 30 ? 0.1 :  // Starving - almost ignore cohesion
                           myEnergy < 50 ? 0.3 :  // Very hungry - weak cohesion
                           myEnergy < 70 ? 0.6 :  // Hungry - moderate cohesion
                           1.0;                    // Well-fed - normal cohesion
    
    if (nearbyAllies > 2) {
      // Calculate center of mass considering world wrapping
      let centerX = 0;
      let centerY = 0;
      let validCount = 0;
      
      // Recalculate center using cached neighbors with proper wrapping
      for (let n = 0; n < neighborCount; n++) {
        const neighbor = neighborCache[n];
        if (neighbor.isAlly && neighbor.distSq < visionSq) {
          // Use relative positions (dx, dy) to avoid wrapping issues
          centerX += neighbor.dx;
          centerY += neighbor.dy;
          validCount++;
        }
      }
      
      if (validCount > 0) {
        centerX /= validCount;
        centerY /= validCount;
        const dist = Math.sqrt(centerX * centerX + centerY * centerY) || 1;
        
        // Apply hunger modifier to cohesion factor
        const effectiveCohesion = cohesionFactor * hungerModifier;
        
        // Herbivores: maintain optimal herd distance (not too close, not too far)
        if (isHerbivore) {
          const optimalHerdDist = 50 + nearbyAllies * 2; // Larger herds need more space
          if (dist < optimalHerdDist * 0.7) {
            // Too close to center - spread out a bit
            vx -= (centerX / dist) * speed * effectiveCohesion * 0.3;
            vy -= (centerY / dist) * speed * effectiveCohesion * 0.3;
          } else if (dist > optimalHerdDist * 1.5) {
            // Too far - move toward herd (but less when hungry)
            vx += (centerX / dist) * speed * effectiveCohesion * 0.8;
            vy += (centerY / dist) * speed * effectiveCohesion * 0.8;
          } else {
            // Optimal distance - gentle cohesion
            vx += (centerX / dist) * speed * effectiveCohesion * 0.4;
            vy += (centerY / dist) * speed * effectiveCohesion * 0.4;
          }
        } else {
          // Non-herbivores: standard cohesion
          vx += (centerX / dist) * speed * effectiveCohesion * 0.5;
          vy += (centerY / dist) * speed * effectiveCohesion * 0.5;
        }
      }
    }
    
    // Herbivore herd migration: if alone or in small group, seek larger herds
    if (isHerbivore && nearbyAllies < 5) {
      // Look for distant allies to form larger herds
      for (let n = 0; n < neighborCount; n++) {
        const neighbor = neighborCache[n];
        if (neighbor.isAlly && neighbor.distSq > visionSq * 0.5) {
          // Distant ally - move toward them to form herd
          const dist = Math.sqrt(neighbor.distSq) + 0.1;
          vx += (neighbor.dx / dist) * speed * 0.2;
          vy += (neighbor.dy / dist) * speed * 0.2;
          break; // Just move toward one distant group
        }
      }
    }
  }
  
  // Always apply separation with stronger force
  vx += separateX * speed * 0.4; // Increased from 0.2
  vy += separateY * speed * 0.4; // Increased from 0.2
  
  // Hunting behavior (modified for cautious mode)
  if (shouldHunt && !conservationMode && bestPrey >= 0 && !cautiousMode) {
    nearestEnemy = bestPrey;
    nearestEnemyDistSq = neighborCache.find(n => n.index === bestPrey)?.distSq || nearestEnemyDistSq;
    
    // Active hunting when hungry and not cautious
    const preyX = queryPos ? queryPos[bestPrey * 2] : pos[bestPrey * 2];
    const preyY = queryPos ? queryPos[bestPrey * 2 + 1] : pos[bestPrey * 2 + 1];
    const toPrey = Math.atan2(preyY - py, preyX - px);
    
    // Pack hunting coordination
    if (cohesion > 0.5 && carnivoreLevel > 0.3) {
      const packAngle = toPrey + (rand() - 0.5) * Math.PI * 0.5;
      const packSpeed = speed * (1 + cohesion * 0.3);
      vx += Math.cos(packAngle) * packSpeed * 0.4;
      vy += Math.sin(packAngle) * packSpeed * 0.4;
    } else {
      // Direct pursuit when very hungry
      vx += Math.cos(toPrey) * speed * 0.3;
      vy += Math.sin(toPrey) * speed * 0.3;
    }
  } else if (cautiousMode && shouldHunt && bestPrey >= 0) {
    // Cautious hunting - maintain distance, wait for opportunity
    const preyX = queryPos ? queryPos[bestPrey * 2] : pos[bestPrey * 2];
    const preyY = queryPos ? queryPos[bestPrey * 2 + 1] : pos[bestPrey * 2 + 1];
    const dx = preyX - px;
    const dy = preyY - py;
    const distSq = dx * dx + dy * dy;
    
    // Maintain safe stalking distance based on outnumbered ratio
    const safeDistSq = 10000 * (2 - outnumberedRatio); // Further when more outnumbered
    
    if (distSq > safeDistSq * 1.5) {
      // Carefully approach
      const dist = Math.sqrt(distSq);
      vx += (dx / dist) * speed * 0.15; // Slower approach
      vy += (dy / dist) * speed * 0.15;
    } else if (distSq < safeDistSq * 0.5) {
      // Too close for comfort, back off
      const dist = Math.sqrt(distSq) + 0.1;
      vx -= (dx / dist) * speed * 0.2;
      vy -= (dy / dist) * speed * 0.2;
    }
    
    // Only attack if prey is isolated and weak
    const preyEnergy = energy[bestPrey];
    if (distSq < 400 && preyEnergy < 30 && outnumberedRatio > 0.3) {
      // Quick opportunistic strike
      const dist = Math.sqrt(distSq);
      vx += (dx / dist) * speed * 0.5;
      vy += (dy / dist) * speed * 0.5;
    }
  } else if (isHunter && myEnergy > 60 && bestPrey >= 0) {
    // Stalking behavior - well-fed carnivores stay near prey but don't actively hunt
    const preyX = queryPos ? queryPos[bestPrey * 2] : pos[bestPrey * 2];
    const preyY = queryPos ? queryPos[bestPrey * 2 + 1] : pos[bestPrey * 2 + 1];
    const dx = preyX - px;
    const dy = preyY - py;
    const distSq = dx * dx + dy * dy;
    
    // Try to maintain optimal stalking distance (about 50-70 units)
    const optimalDistSq = 3600; // 60² units
    if (distSq > optimalDistSq * 1.5) {
      // Too far, move closer slowly
      const dist = Math.sqrt(distSq);
      vx += (dx / dist) * speed * 0.1;
      vy += (dy / dist) * speed * 0.1;
    } else if (distSq < optimalDistSq * 0.7) {
      // Too close, back off
      const dist = Math.sqrt(distSq) + 0.1;
      vx -= (dx / dist) * speed * 0.1;
      vy -= (dy / dist) * speed * 0.1;
    }
  }
  
  // Combat/mating interactions
  if (nearestEnemy >= 0 && nearestEnemyDistSq < visionSq) {
    const target = nearestEnemy;
    const targetEnergy = energy[target];
    
    // Carnivores should only hunt when hungry, not when well-fed
    const satiation = myEnergy / energyConfig.max; // 0-1, how full we are
    const shouldAttack = isHunter ? (satiation < 0.8) : true; // Carnivores stop at 80% full
    
    if (shouldAttack) {
      const stressFactor = (100 - myEnergy) / 100;
      const groupSupport = nearbyAllies / Math.max(1, nearbyEnemies);
      const huntingDrive = Math.max(0, diet);
      
      // Reduce base aggression for carnivores when not hungry or when cautious
      const cautiousPenalty = cautiousMode ? 0.3 : 1.0; // Much less likely to fight when cautious
      const hungerModifiedAggression = isHunter ? 
        aggression * (1 - satiation * 0.7) * cautiousPenalty : // Carnivores become less aggressive when full or cautious
        aggression * (fearMode ? 0.5 : 1.0); // Herbivores less aggressive when afraid
      
      const dietFightBonus = huntingDrive * 0.3; // Reduced from 0.5
      const hungerAggressionBoost = isHunter ? hungerDesperation * 0.3 : 0; // Reduced from 0.4
      const packHuntingMultiplier = 1 + packHuntBonus * 0.3; // Reduced from 0.5
      
      // Lower overall fight chance
      const fightChance = (hungerModifiedAggression + dietFightBonus + hungerAggressionBoost) * 
                         (0.2 + stressFactor * 0.15 + crowdStress * 0.1) * // Reduced multipliers
                         Math.min(1.5, 1 + groupSupport * 0.15) * // Reduced max
                         packHuntingMultiplier;
      
      if (rand() < fightChance) {
        // Combat logic - more balanced
        const carnivoreBonus = 1 + huntingDrive * 0.3; // Reduced from 0.5
        const packDamageBonus = 1 + packHuntBonus * 0.3; // Reduced from 0.5
        const damage = (5 + nearbyAllies * 1) * hungerModifiedAggression * carnivoreBonus * packDamageBonus; // Reduced base damage
        energy[target] -= damage;
        
        if (carnivoreLevel > 0) {
          // Bite-based energy drain during combat
          const absorptionRate = carnivoreLevel * 0.5; // Reduced efficiency
          const stolen = Math.min(damage * absorptionRate, targetEnergy * 0.3); // Less energy per bite
          energy[i] += stolen;
        }
        
        if (energy[target] <= 0) {
          alive[target] = 0;
          if (carnivoreLevel > 0) {
            // Corpse provides less energy, encouraging sustainable hunting
            const corpseEnergy = Math.min(30, targetEnergy * 0.5); // Much less than before
            const digestibleEnergy = corpseEnergy * carnivoreLevel; // No 1.5x multiplier
            energy[i] += digestibleEnergy;
          }
          if (killsByTribe && deathsByTribe) {
            killsByTribe[myTribe]++;
            deathsByTribe[tribeId[target]]++;
          }
        }
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
            const parentX = (pos[i * 2] + queryPos[potentialMate * 2]) / 2;
            const parentY = (pos[i * 2 + 1] + queryPos[potentialMate * 2 + 1]) / 2;
            const spawnOffset = 10 + rand() * 10;
            const spawnAngle = rand() * Math.PI * 2;
            
            pos[j * 2] = parentX + Math.cos(spawnAngle) * spawnOffset;
            pos[j * 2 + 1] = parentY + Math.sin(spawnAngle) * spawnOffset;
            
            const ang = rand() * Math.PI * 2;
            const hybridRawSpeed = (genes[base] + queryGenes[mateBase]) / 2;
            const hybridMetabolism = (genes[base + 2] + queryGenes[mateBase + 2]) / 2;
            const hybridMetabEfficiency = Math.min(1, Math.sqrt(hybridMetabolism / 0.15));
            const hybridSpeed = hybridRawSpeed * hybridMetabEfficiency;
            
            vel[j * 2] = Math.cos(ang) * hybridSpeed * 0.5;
            vel[j * 2 + 1] = Math.sin(ang) * hybridSpeed * 0.5;
            
            alive[j] = 1;
            energy[j] = 40;
            tribeId[j] = 999; // Hybrid tribe
            
            // Set hybrid genes
            const jBase = j * G;
            genes[jBase] = hybridSpeed * (0.9 + rand() * 0.2);
            genes[jBase + 1] = (genes[base + 1] + queryGenes[mateBase + 1]) / 2 * (0.9 + rand() * 0.2);
            genes[jBase + 2] = (genes[base + 2] + queryGenes[mateBase + 2]) / 2 * (0.9 + rand() * 0.2);
            genes[jBase + 3] = (genes[base + 3] + queryGenes[mateBase + 3]) / 2 * (0.9 + rand() * 0.2);
            genes[jBase + 4] = (genes[base + 4] + queryGenes[mateBase + 4]) / 2 * 0.7;
            genes[jBase + 5] = (genes[base + 5] + queryGenes[mateBase + 5]) / 2 * 1.2;
            genes[jBase + 6] = (genes[base + 6] + queryGenes[mateBase + 6]) / 2 * (0.9 + rand() * 0.2);
            genes[jBase + 7] = (genes[base + 7] + queryGenes[mateBase + 7]) / 2 * (0.9 + rand() * 0.2);
            genes[jBase + 8] = (genes[base + 8] + queryGenes[mateBase + 8]) / 2 * (0.9 + rand() * 0.2);
            
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
  
  // Food seeking behavior - improved with line of sight preference
  let foodForceX = 0, foodForceY = 0;
  let bestFood = 0; // Declare at function scope for dispersal behavior
  
  // Always scan for food if not completely full, but with varying urgency
  const satiation = myEnergy / energyConfig.max; // 0-1, how full we are
  const shouldSeekFood = satiation < 0.95; // Seek food unless nearly full
  
  if (shouldSeekFood) {
    const cellWidth = world.width / foodCols;
    const cellHeight = world.height / foodRows;
    const fx = Math.floor((px / world.width) * foodCols);
    const fy = Math.floor((py / world.height) * foodRows);
    
    // Determine scan radius based on hunger and vision
    // More hungry = wider search, but limited by vision
    const hungerLevel = 1 - satiation;
    const visionCells = Math.ceil(vision / Math.min(cellWidth, cellHeight));
    const scanRadius = Math.min(visionCells, Math.ceil(hungerLevel * 5 + 1));
    
    // Adjust pickiness based on hunger - more hungry = less picky
    const adjustedFoodStandards = foodStandards * (0.3 + satiation * 0.7);
    
    if (myEnergy < 40) {
      let bestFoodX = 0, bestFoodY = 0;
      
      // Desperate mode - scan wider area within vision
      for (let dy = -scanRadius; dy <= scanRadius; dy++) {
        for (let dx = -scanRadius; dx <= scanRadius; dx++) {
          const nx = fx + dx;
          const ny = fy + dy;
          if (nx >= 0 && nx < foodCols && ny >= 0 && ny < foodRows) {
            const idx = ny * foodCols + nx;
            const food = foodGrid[idx];
            if (food > bestFood && food > adjustedFoodStandards) {
              // Check if it's within actual vision range
              const foodX = (nx + 0.5) * cellWidth;
              const foodY = (ny + 0.5) * cellHeight;
              const distToFood = Math.sqrt((foodX - px) * (foodX - px) + (foodY - py) * (foodY - py));
              if (distToFood <= vision) {
                bestFood = food;
                bestFoodX = foodX;
                bestFoodY = foodY;
              }
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
        // DESPERATE mode - maximum urgency when starving
        const urgency = desperateForFood ? 0.9 : (0.3 + hungerUrgency * 0.4);
        foodForceX = (dx / dist) * speed * urgency;
        foodForceY = (dy / dist) * speed * urgency;
      } else {
        // No food found in vision - need to leave this barren area!
        // Pick a random direction and move that way with urgency based on hunger
        const hungerUrgency = (40 - myEnergy) / 40;
        const escapeAngle = rand() * Math.PI * 2;
        const escapeUrgency = 0.4 + hungerUrgency * 0.5; // More desperate when hungrier
        foodForceX = Math.cos(escapeAngle) * speed * escapeUrgency;
        foodForceY = Math.sin(escapeAngle) * speed * escapeUrgency;
      }
    } else {
      // Not desperate - prefer to stay near food or move to visible food
      let bestFoodX = 0, bestFoodY = 0;
      let currentCellFood = foodGrid[fy * foodCols + fx];
      
      // Scan area based on satiation - well-fed entities scan less
      const moderateScanRadius = Math.max(1, Math.floor(scanRadius * 0.6));
      
      for (let dy = -moderateScanRadius; dy <= moderateScanRadius; dy++) {
        for (let dx = -moderateScanRadius; dx <= moderateScanRadius; dx++) {
          const nx = fx + dx;
          const ny = fy + dy;
          if (nx >= 0 && nx < foodCols && ny >= 0 && ny < foodRows) {
            const idx = ny * foodCols + nx;
            const food = foodGrid[idx];
            if (food > bestFood && food > adjustedFoodStandards) {
              const foodX = (nx + 0.5) * cellWidth;
              const foodY = (ny + 0.5) * cellHeight;
              const distToFood = Math.sqrt((foodX - px) * (foodX - px) + (foodY - py) * (foodY - py));
              if (distToFood <= vision) {
                bestFood = food;
                bestFoodX = foodX;
                bestFoodY = foodY;
              }
            }
          }
        }
      }
      
      if (bestFood > 0) {
        // Move toward best food source, but with less urgency when not hungry
        const dx = bestFoodX - px;
        const dy = bestFoodY - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // If we're at a food source and not very hungry, stay put or move slowly
        if (currentCellFood > adjustedFoodStandards && satiation > 0.6) {
          // Just drift slowly around the food area
          foodForceX = (dx / dist) * speed * 0.05;
          foodForceY = (dy / dist) * speed * 0.05;
        } else {
          // Move toward food with urgency based on hunger
          const urgency = 0.1 + hungerLevel * 0.5;
          foodForceX = (dx / dist) * speed * urgency;
          foodForceY = (dy / dist) * speed * urgency;
        }
      } else if (hungerLevel > 0.2) {
        // No food found and getting hungry - explore
        const escapeAngle = rand() * Math.PI * 2;
        const escapeUrgency = 0.2 + hungerLevel * 0.3;
        foodForceX = Math.cos(escapeAngle) * speed * escapeUrgency;
        foodForceY = Math.sin(escapeAngle) * speed * escapeUrgency;
      }
    }
  }
  
  // Apply food seeking
  vx += foodForceX;
  vy += foodForceY;
  
  // DISPERSAL BEHAVIOR: If crowded area with no food, actively disperse
  // Check if we're in a situation where we should actively disperse
  // When desperate, disperse even more aggressively
  if (nearbyAllies > 2 && bestFood === 0 && myEnergy < 70) {
    // High competition, no food, and getting hungry - time to disperse!
    const competitionPressure = Math.min(nearbyAllies / 10, 1.0); // 0-1 based on crowd size
    const hungerPressure = (70 - myEnergy) / 70; // 0-1 based on hunger level
    // Desperate entities disperse with maximum urgency
    const dispersalUrgency = desperateForFood ? 0.9 : (competitionPressure + hungerPressure) * 0.5;
    
    // Calculate dispersal direction away from crowd center
    let dispersalX = 0, dispersalY = 0;
    let crowdCount = 0;
    
    // Find the center of the crowd to move away from it
    for (let n = 0; n < neighborCount; n++) {
      const neighbor = neighborCache[n];
      if (neighbor.isAlly && neighbor.distSq < visionSq * 0.25) { // Close neighbors
        dispersalX += neighbor.dx;
        dispersalY += neighbor.dy;
        crowdCount++;
      }
    }
    
    if (crowdCount > 0) {
      // Move away from the crowd center
      dispersalX /= crowdCount;
      dispersalY /= crowdCount;
      const dispersalDist = Math.sqrt(dispersalX * dispersalX + dispersalY * dispersalY) || 1;
      
      // Apply dispersal force away from crowd center
      const dispersalStrength = speed * dispersalUrgency * 0.7;
      vx -= (dispersalX / dispersalDist) * dispersalStrength;
      vy -= (dispersalY / dispersalDist) * dispersalStrength;
    }
    
    // Add some randomness to prevent getting stuck in local minima
    const randomDispersalAngle = rand() * Math.PI * 2;
    const randomStrength = speed * dispersalUrgency * 0.3;
    vx += Math.cos(randomDispersalAngle) * randomStrength;
    vy += Math.sin(randomDispersalAngle) * randomStrength;
  }
  
  // Add random wander
  vx += (rand() - 0.5) * speed * 0.1;
  vy += (rand() - 0.5) * speed * 0.1;
  
  // Light velocity damping only if speed is excessive
  const velocityMag = Math.sqrt(vx * vx + vy * vy);
  const maxVelocity = speed * 3; // Allow more burst speed
  
  if (velocityMag > maxVelocity) {
    // Scale down excessive velocities
    const scale = maxVelocity / velocityMag;
    vx *= scale;
    vy *= scale;
  }
  
  // Apply crowd dispersal forces when stressed - BUT NOT when desperate for food
  // Desperate entities will push through crowds to reach food
  if (crowdStress > 0.3 && !desperateForFood) {
    // Hunger reduces crowd aversion - desperate entities don't care about personal space
    const hungerReduction = veryHungry ? 0.3 : 1.0; // 70% reduction when very hungry
    
    // Strong separation forces to prevent clumping (unless desperate)
    const dispersalStrength = Math.pow(crowdStress, 2) * speed * 0.5 * hungerReduction;
    vx += separateX * dispersalStrength;
    vy += separateY * dispersalStrength;
    
    // Add some random movement to break up patterns (unless desperate)
    if (crowdStress > 0.5) {
      const jitter = crowdStress * speed * 0.2 * hungerReduction;
      vx += (rand() - 0.5) * jitter;
      vy += (rand() - 0.5) * jitter;
    }
  }
  
  // Check biome traversability before updating velocity
  if (biomeGenerator) {
    // Calculate the next position based on current velocity
    const nextX = px + vx;
    const nextY = py + vy;
    
    // Check if the next position is traversable (flip Y to match texture coordinate system)
    const flippedNextY = world.height - nextY;
    if (!biomeGenerator.isTraversable(nextX, flippedNextY)) {
      // Try to find an alternative direction
      // First, try to slide along the obstacle
      const angles = [Math.PI/4, -Math.PI/4, Math.PI/2, -Math.PI/2, Math.PI*3/4, -Math.PI*3/4, Math.PI];
      const currentAngle = Math.atan2(vy, vx);
      const currentSpeed = Math.sqrt(vx * vx + vy * vy);
      
      let foundAlternative = false;
      for (const angleOffset of angles) {
        const testAngle = currentAngle + angleOffset;
        const testVx = Math.cos(testAngle) * currentSpeed * 0.5;
        const testVy = Math.sin(testAngle) * currentSpeed * 0.5;
        const testX = px + testVx;
        const testY = py + testVy;
        
        const flippedTestY = world.height - testY;
        if (biomeGenerator.isTraversable(testX, flippedTestY)) {
          vx = testVx;
          vy = testVy;
          foundAlternative = true;
          break;
        }
      }
      
      // If no alternative found, stop movement
      if (!foundAlternative) {
        vx *= 0.1;
        vy *= 0.1;
      }
    }
  }
  
  // Update velocity
  vel[i * 2] = vx;
  vel[i * 2 + 1] = vy;
}