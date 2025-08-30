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
  _dt: number,
  killsByTribe?: Uint32Array,
  deathsByTribe?: Uint32Array,
  color?: Uint8Array,
  birthsByTribe?: Uint32Array,
  allowHybrids?: boolean,
  orientation?: Float32Array,
  age?: Float32Array
): void {
  const G = 9; // Now includes foodStandards, diet, and viewAngle genes
  const base = i * G;
  const px = pos[i * 2], py = pos[i * 2 + 1];
  const rawSpeed = genes[base];
  const vision = genes[base + 1];
  const metabolism = genes[base + 2];
  const aggression = genes[base + 4];
  const cohesion = genes[base + 5];
  const foodStandards = genes[base + 6] || 0.3; // How picky about food density
  const diet = genes[base + 7] || -0.5; // -1=herbivore, 0=omnivore, 1=carnivore
  const viewAngle = (genes[base + 8] || 120) * Math.PI / 180; // Convert to radians
  
  // Calculate effective speed based on metabolism
  // Low metabolism can't support high speeds effectively
  // Use square root for gentler scaling: 0.05 -> 58%, 0.1 -> 82%, 0.15+ -> 100%
  const metabolismEfficiency = Math.min(1, Math.sqrt(metabolism / 0.15));
  const speed = rawSpeed * metabolismEfficiency;
  
  const myTribe = tribeId[i];
  const myEnergy = energy[i];
  
  // CARNIVORE HUNTING: Calculate diet-based variables early
  const carnivoreLevel = Math.max(0, diet); // 0-1 for carnivorous tendency
  const isHunter = carnivoreLevel > 0.2; // Even slightly carnivorous = hunter

  // Hunt proactively unless satiated - INCREASED thresholds for more aggressive hunting
  // Pure carnivores (1.0) hunt until 95% full, omnivores until ~60%
  const huntingThreshold = 95 - (carnivoreLevel * 35); // 95 to 60 based on carnivore level
  const shouldHunt = isHunter && myEnergy < huntingThreshold;

  // Desperation factor - hungrier carnivores become more aggressive
  const hungerDesperation = isHunter ? Math.max(0, (huntingThreshold - myEnergy) / huntingThreshold) : 0;

  // Use actual position for lookup
  
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
  
  // Use spatial hash to check entities within vision
  const visionSq = vision * vision;
  
  // Adaptive limit based on entity count but maintaining fidelity
  const maxChecks = Math.max(25, Math.min(40, 600000 / alive.length)); // 25-40 checks adaptive
  
  // Get entity orientation for view angle calculation
  // Use stored orientation if available, otherwise calculate from velocity
  const myOrientation = orientation ? orientation[i] : (_dt > 0 ? Math.atan2(vel[i * 2 + 1], vel[i * 2]) : 0);
  
  // Use optimized neighbor search with early exit
  grid.forNeighborsWithLimit(px, py, vision, maxChecks, (j) => {
    if (j === i || !alive[j]) return false; // Don't count self or dead
    
    const dx = pos[j * 2] - px;
    const dy = pos[j * 2 + 1] - py;
    const distSq = dx * dx + dy * dy;
    
    // Skip if too far
    if (distSq > visionSq) return false;
    
    // Check if entity is within view angle
    const angleToTarget = Math.atan2(dy, dx);
    let angleDiff = angleToTarget - myOrientation;
    // Normalize angle difference to [-π, π]
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Skip if outside view angle (viewAngle is full FOV, so half on each side)
    if (Math.abs(angleDiff) > viewAngle / 2) return false;
    
    totalNearby++;
    const otherTribe = tribeId[j];
    
    // Universal separation for crowding (stronger when very close)
    if (distSq < 900) { // 30 units squared - personal space
      const dist = Math.sqrt(distSq) + 1; // Avoid division by zero
      const crowdForce = (30 - dist) / 30; // Simplified calculation
      if (crowdForce > 0) {
        const factor = crowdForce * 2 / dist;
        separateX -= dx * factor;
        separateY -= dy * factor;
      }
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
      
      // Track for potential interactions (use squared distances to avoid sqrt)
      const nearestEnemyDistSq = nearestEnemyDist * nearestEnemyDist;
      if (distSq < nearestEnemyDistSq) {
        nearestEnemyDist = Math.sqrt(distSq);
        nearestEnemy = j;
      }
      
      // Also consider as potential mate if healthy
      const potentialMateDistSq = potentialMateDist * potentialMateDist;
      if (energy[j] > 50 && distSq < potentialMateDistSq) {
        potentialMateDist = Math.sqrt(distSq);
        potentialMate = j;
      }
    }
    
    return true; // Count this as a valid neighbor check
  });
  
  // Apply flocking forces (but keep it light)
  let vx = vel[i * 2];
  let vy = vel[i * 2 + 1];
  
  // PACK HUNTING: Carnivores with high cohesion hunt together
  let packHuntBonus = 0;
  if (nearbyAllies > 0 && isHunter && cohesion > 0.4) {
    // Check if allies are also hunting
    let huntingAllies = 0;
    grid.forNeighborsWithLimit(px, py, vision, 10, (j) => {
      if (j !== i && alive[j] && tribeId[j] === myTribe) {
        const allyEnergy = energy[j];
        const allyBase = j * G;
        const allyDiet = genes[allyBase + 7] || -0.5;
        const allyCarnivore = Math.max(0, allyDiet);

        // Count ally as hunting if carnivorous and hungry
        if (allyCarnivore > 0.2 && allyEnergy < 70) {
          huntingAllies++;
        }
      }
      return true;
    });

    // Pack hunting bonus - more effective with more hunters
    packHuntBonus = Math.min(1, huntingAllies * 0.2) * cohesion;
  }

  if (nearbyAllies > 0) {
    // Normalize and apply forces with cohesion factor
    const cohesionFactor = cohesion * 0.1 * (1 + packHuntBonus); // Stronger cohesion when pack hunting
    
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
  
  // Calculate crowd stress for use in multiple behaviors
  const crowdStress = Math.min(1, totalNearby / 15); // Crowding stress (15 is optimal max)
  const reproductiveCrowdLimit = 0.7; // Above this crowd level, no reproduction

  // Conservation instinct: Check if neighbors are well-fed to prevent overhunting
  let neighborhoodSatiation = 0;
  let satiatedNeighbors = 0;
  if (shouldHunt && nearbyAllies > 0) {
    grid.forNeighborsWithLimit(px, py, vision, 15, (j) => {
      if (j !== i && alive[j] && tribeId[j] === myTribe) {
        if (energy[j] > 70) satiatedNeighbors++;
      }
      return true;
    });
    neighborhoodSatiation = nearbyAllies > 0 ? satiatedNeighbors / nearbyAllies : 0;
  }
  
  // Don't hunt if tribe is well-fed (prevents extinction of prey)
  const conservationMode = neighborhoodSatiation > 0.7 && myEnergy > 40;
  
  if (shouldHunt && !conservationMode) {
    // Actively seek best prey target - EXPANDED vision when hungry
    let bestPrey = -1;
    let bestPreyScore = -1;
    
    // Hungry carnivores can see further (adrenaline boost)
    const huntVision = vision * (1.5 + hungerDesperation * 0.5); // Up to 2x vision when desperate

    grid.forNeighborsWithLimit(px, py, huntVision, 40, (j) => {
      if (j !== i && alive[j]) {
        const dx = pos[j * 2] - px;
        const dy = pos[j * 2 + 1] - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < huntVision) {
          const targetEnergy = energy[j];
          const isAlly = tribeId[j] === myTribe;
          
          // Score prey: prefer enemies, weak targets, close targets
          let preyScore = (100 - targetEnergy) / 100; // Prefer weak
          preyScore += (1 - dist / huntVision) * 0.5; // Prefer close
          preyScore *= (1 + hungerDesperation * 0.5); // Hunger makes less picky
          
          if (!isAlly) {
            preyScore += 1; // Strong preference for other tribes
          } else {
            // Cannibalism only when desperate or pure carnivore
            const cannibalismWillingness = carnivoreLevel * 0.5 + (50 - myEnergy) / 100;
            if (cannibalismWillingness < 0.6) return true; // Skip ally
            preyScore *= 0.3; // Much lower score for cannibalism
          }
          
          if (preyScore > bestPreyScore) {
            bestPrey = j;
            bestPreyScore = preyScore;
          }
        }
      }
      return true;
    });
    
    // Override nearest enemy with best prey
    if (bestPrey >= 0) {
      nearestEnemy = bestPrey;
      nearestEnemyDist = Math.sqrt(
        Math.pow(pos[bestPrey * 2] - px, 2) + 
        Math.pow(pos[bestPrey * 2 + 1] - py, 2)
      );

      // GROUP HUNTING: Signal nearby allies about prey
      // High cohesion carnivores coordinate hunts
      if (cohesion > 0.5 && carnivoreLevel > 0.3) {
        // Move toward prey with pack coordination
        const preyX = pos[bestPrey * 2];
        const preyY = pos[bestPrey * 2 + 1];
        const toPrey = Math.atan2(preyY - py, preyX - px);

        // Pack hunting formation - spread out to surround
        const packAngle = toPrey + (rand() - 0.5) * Math.PI * 0.5; // Spread ±45 degrees
        const packSpeed = speed * (1 + cohesion * 0.3); // Cohesive packs move faster

        vx += Math.cos(packAngle) * packSpeed * 0.4;
        vy += Math.sin(packAngle) * packSpeed * 0.4;
      }
    }
  }
  
  // Inter-tribe interactions with crowd stress
  if (nearestEnemy >= 0 && nearestEnemyDist < vision) {
    const target = nearestEnemy;
    
    // Context affects interaction chances
    const stressFactor = (100 - myEnergy) / 100; // More stressed = more aggressive
    const groupSupport = nearbyAllies / Math.max(1, nearbyEnemies); // Safety in numbers
    
    // Diet influences combat behavior
    // Carnivores (+1) are more likely to hunt, herbivores (-1) avoid combat
    const huntingDrive = Math.max(0, diet); // 0-1 for carnivorous tendency
    const dietFightBonus = huntingDrive * 0.5; // Up to 50% bonus for carnivores
    
    // Calculate fight chance with diet factor - BOOSTED for hungry carnivores
    const hungerAggressionBoost = isHunter ? hungerDesperation * 0.4 : 0;
    // Pack hunting increases success rate
    const packHuntingMultiplier = 1 + packHuntBonus * 0.5;
    const fightChance = (aggression + dietFightBonus + hungerAggressionBoost) * (0.3 + stressFactor * 0.2 + crowdStress * 0.2) * Math.min(2, 1 + groupSupport * 0.2) * packHuntingMultiplier;
    
    if (rand() < fightChance) {
      // PREDATION/FIGHT - carnivores get more energy from kills
      const targetEnergy = energy[target];
      
      // Damage based on aggression, diet, and group support
      const carnivoreBonus = 1 + huntingDrive * 0.5; // Carnivores deal more damage
      // Pack hunting deals more damage
      const packDamageBonus = 1 + packHuntBonus * 0.5;
      const damage = (8 + nearbyAllies * 1.5) * aggression * carnivoreBonus * packDamageBonus;
      energy[target] -= damage;
      
      // Energy absorption based on diet
      // Only carnivores and omnivores can get energy from kills
      // Pure herbivores (diet=-1) get 0%, pure carnivores (diet=1) get 100%
      const carnivoreLevel = Math.max(0, diet); // 0-1 for carnivorous tendency
      if (carnivoreLevel > 0) {
        const absorptionRate = carnivoreLevel; // 0-1 based on how carnivorous
        // INCREASED energy steal to make hunting more rewarding
        const stolen = Math.min(damage * absorptionRate * 1.5, targetEnergy * 0.7); // Increased from 0.5 to 0.7
        energy[i] += stolen;
      }
      
      // Kill if target is weakened
      if (energy[target] <= 0) {
        alive[target] = 0;
        // Only carnivores and omnivores gain energy from kills
        if (carnivoreLevel > 0) {
          // BOOSTED energy from kills to make carnivore lifestyle viable
          const corpseEnergy = Math.max(40, targetEnergy * 0.75); // Increased from 20/0.5 to 40/0.75
          energy[i] += corpseEnergy * carnivoreLevel * 1.5; // Added 1.5x multiplier
        }
        // Track kill stats
        if (killsByTribe && deathsByTribe) {
          killsByTribe[myTribe]++;
          deathsByTribe[tribeId[target]]++;
        }
      }
    } else if (allowHybrids && potentialMate >= 0 && energy[i] > 50 && energy[potentialMate] > 50 && crowdStress < reproductiveCrowdLimit) {
      // Only allow hybrid mating if enabled
      // NO REPRODUCTION if too crowded - prevents population explosions
      // Mate chance affected by health and crowding
      const mateChance = (1 - aggression) * 0.1 * (myEnergy / 100) * (1 - crowdStress);
      if (rand() < mateChance && rand() < 0.2) { // Combined mate and success chance
        // Find a free slot for hybrid baby - search sequentially to avoid index issues
        for (let j = 0; j < alive.length; j++) {
          if (!alive[j]) {
            // Create hybrid with mixed genes
            const mateBase = potentialMate * G;
            
            // Spawn child NEAR parents with small offset, not at random location
            const parentX = (pos[i * 2] + pos[potentialMate * 2]) / 2;
            const parentY = (pos[i * 2 + 1] + pos[potentialMate * 2 + 1]) / 2;
            const spawnOffset = 10 + rand() * 10; // 10-20 units away
            const spawnAngle = rand() * Math.PI * 2;
            pos[j * 2] = parentX + Math.cos(spawnAngle) * spawnOffset;
            pos[j * 2 + 1] = parentY + Math.sin(spawnAngle) * spawnOffset;
            
            const ang = rand() * Math.PI * 2;
            const hybridRawSpeed = (genes[base] + genes[mateBase]) / 2;
            const hybridMetabolism = (genes[base + 2] + genes[mateBase + 2]) / 2;
            const hybridMetabEfficiency = Math.min(1, Math.sqrt(hybridMetabolism / 0.15));
            const hybridSpeed = hybridRawSpeed * hybridMetabEfficiency;
            vel[j * 2] = Math.cos(ang) * hybridSpeed * 0.5;
            vel[j * 2 + 1] = Math.sin(ang) * hybridSpeed * 0.5;
            
            alive[j] = 1;
            energy[j] = 40; // Start with decent energy
            
            // Hybrids get special tribe ID (highest tribe ID + 1 for "Hybrids" tribe)
            // This makes them visually distinct and tracks them separately
            const hybridTribe = 999; // Special ID for hybrids
            tribeId[j] = hybridTribe;
            
            // Set hybrid genes (average with some variation)
            const jBase = j * G;
            genes[jBase] = hybridSpeed * (0.9 + rand() * 0.2);
            genes[jBase + 1] = (genes[base + 1] + genes[mateBase + 1]) / 2 * (0.9 + rand() * 0.2);
            genes[jBase + 2] = (genes[base + 2] + genes[mateBase + 2]) / 2 * (0.9 + rand() * 0.2);
            genes[jBase + 3] = (genes[base + 3] + genes[mateBase + 3]) / 2 * (0.9 + rand() * 0.2);
            genes[jBase + 4] = (genes[base + 4] + genes[mateBase + 4]) / 2 * 0.7; // Hybrids less aggressive
            genes[jBase + 5] = (genes[base + 5] + genes[mateBase + 5]) / 2 * 1.2; // Hybrids more cohesive
            
            // Set hybrid color - distinctive white/silver color for visibility
            if (color) {
              // Make hybrids bright white/silver for clear distinction
              color[j * 3] = 220;     // R: bright
              color[j * 3 + 1] = 220;  // G: bright  
              color[j * 3 + 2] = 255;  // B: slightly more blue for silver tint
            }
            
            // Track birth
            if (birthsByTribe) {
              birthsByTribe[hybridTribe]++;
            }
            
            // Energy cost for parents
            energy[i] -= 25;
            energy[potentialMate] -= 25;
            break;
          }
        }
      }
    }
    // else IGNORE - no interaction
  }
  
  // Food seeking with vision (optimized) - now with survival instinct, standards, and diet
  // Herbivores seek plant food, pure carnivores ignore it completely
  const herbivoreLevel = Math.max(0, -diet); // 0-1 for herbivorous tendency
  const plantFoodInterest = herbivoreLevel; // 0 for pure carnivore, 1 for pure herbivore
  
  // Carnivores need to migrate if no prey available
  if (carnivoreLevel > 0.3 && nearestEnemy < 0) { // Lower threshold for migration
    // Carnivore with no prey nearby - need to migrate!
    const preyMigrationUrge = carnivoreLevel * Math.max(0.3, (80 - myEnergy) / 80);
    
    // EXPLORATORY HUNTING: Maintain direction for better exploration
    // Use entity ID to get consistent migration direction that changes gradually
    const entityAge = age ? age[i] : 0;
    const migrationSeed = i * 0.618033988749895 + Math.floor(entityAge / 30); // Changes every 30 time units
    const baseAngle = (migrationSeed % 1) * Math.PI * 2;
    const migrationAngle = baseAngle + (rand() - 0.5) * Math.PI * 0.3; // Small variation

    // Strong migration pressure with pack coordination
    const migrationSpeed = speed * preyMigrationUrge * (0.8 + cohesion * 0.2); // Packs migrate together
    vx += Math.cos(migrationAngle) * migrationSpeed;
    vy += Math.sin(migrationAngle) * migrationSpeed;

    // If in a pack, influence allies to follow
    if (cohesion > 0.5 && nearbyAllies > 2) {
      // Pack leader effect - stronger influence on movement
      vx *= 1.2;
      vy *= 1.2;
    }
  }
  
  if (myEnergy < 70 && plantFoodInterest > 0.1) {
    const cellX = Math.floor((px / world.width) * foodCols);
    const cellY = Math.floor((py / world.height) * foodRows);
    
    // Adaptive vision based on hunger - more desperate = look further
    const hungerFactor = Math.max(0.3, 1 - myEnergy / 100);
    // Pickier entities look further to find better food areas
    const visionBonus = Math.floor(foodStandards * 2); // 0-2 extra cells for picky eaters
    const visionCells = (myEnergy < 30 ? 2 : 1) + visionBonus;
    
    let bestFoodDx = 0, bestFoodDy = 0;
    let foundFood = false;
    let totalFoodInArea = 0;
    let cellsChecked = 0;
    
    // Check food cells within vision - scan for both food and emptiness
    for (let dy = -visionCells; dy <= visionCells; dy++) {
      for (let dx = -visionCells; dx <= visionCells; dx++) {
        const fx = cellX + dx;
        const fy = cellY + dy;
        if (fx >= 0 && fx < foodCols && fy >= 0 && fy < foodRows) {
          const foodIdx = fy * foodCols + fx;
          const foodAmount = foodGrid[foodIdx];
          totalFoodInArea += foodAmount;
          cellsChecked++;
          
          if (foodAmount > 0.2) {
            // Weight by food amount - prefer richer cells
            bestFoodDx += dx * foodAmount;
            bestFoodDy += dy * foodAmount;
            foundFood = true;
          }
        }
      }
    }
    
    // Calculate local food density
    const localFoodDensity = cellsChecked > 0 ? totalFoodInArea / cellsChecked : 0;
    
    // FOOD STANDARDS: Determine if area is good enough to settle
    // Picky entities (high foodStandards) require higher food density
    const minAcceptableDensity = foodStandards * 0.5; // 0-0.5 range
    const isAreaAcceptable = localFoodDensity >= minAcceptableDensity;
    
    // If area is poor and entity is picky, add urgency to leave
    let migrationUrge = 0;
    if (!isAreaAcceptable && myEnergy > 20) { // Don't migrate if almost dead
      migrationUrge = foodStandards * (1 - localFoodDensity) * 0.8;
    }
    
    if (foundFood && isAreaAcceptable) {
      // Normalize weighted food direction
      const foodNorm = Math.sqrt(bestFoodDx * bestFoodDx + bestFoodDy * bestFoodDy) || 1;
      bestFoodDx /= foodNorm;
      bestFoodDy /= foodNorm;
      
      // Convert grid direction to world coordinates
      const cellWidth = world.width / foodCols;
      const cellHeight = world.height / foodRows;
      const worldDx = bestFoodDx * cellWidth;
      const worldDy = bestFoodDy * cellHeight;
      
      // Move toward food with hunger urgency (reduced if picky and area is marginal)
      const len = Math.sqrt(worldDx * worldDx + worldDy * worldDy) || 1;
      const settlementFactor = isAreaAcceptable ? 0.4 : 0.2; // Less attraction if standards not met
      vx += (worldDx / len) * speed * hungerFactor * settlementFactor;
      vy += (worldDy / len) * speed * hungerFactor * settlementFactor;
    } else if ((localFoodDensity < 0.1 || migrationUrge > 0.3) && myEnergy < 50) {
      // SURVIVAL INSTINCT: Actively leave barren areas when hungry
      // Scan wider area for ANY food to determine escape direction
      const escapeCells = 3;
      const cellWidth = world.width / foodCols;
      const cellHeight = world.height / foodRows;
      let bestFoodX = 0, bestFoodY = 0;
      let bestFoodAmount = 0;
      let foundEscape = false;
      
      for (let dy = -escapeCells; dy <= escapeCells; dy++) {
        for (let dx = -escapeCells; dx <= escapeCells; dx++) {
          // Skip cells we already checked
          if (Math.abs(dx) <= visionCells && Math.abs(dy) <= visionCells) continue;
          
          const fx = cellX + dx;
          const fy = cellY + dy;
          if (fx >= 0 && fx < foodCols && fy >= 0 && fy < foodRows) {
            const foodIdx = fy * foodCols + fx;
            const foodAmount = foodGrid[foodIdx];
            if (foodAmount > bestFoodAmount) {
              // Track the best food source position in world coordinates
              bestFoodX = (fx + 0.5) * cellWidth;
              bestFoodY = (fy + 0.5) * cellHeight;
              bestFoodAmount = foodAmount;
              foundEscape = true;
            }
          }
        }
      }
      
      if (foundEscape && bestFoodAmount > 0.1) {
        // Move toward best detected food source using proper world coordinates
        const dx = bestFoodX - px;
        const dy = bestFoodY - py;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        vx += (dx / dist) * speed * hungerFactor * 0.5;
        vy += (dy / dist) * speed * hungerFactor * 0.5;
      } else {
        // No food detected anywhere - PANIC MODE
        // Move in a consistent direction to escape barren region
        const panicAngle = (i * 0.618033988749895) * Math.PI * 2; // Golden ratio for spread
        vx += Math.cos(panicAngle) * speed * hungerFactor * 0.6;
        vy += Math.sin(panicAngle) * speed * hungerFactor * 0.6;
      }
    } else if (myEnergy < 30) {
      // Desperate wandering with bias away from current position
      const wanderAngle = rand() * Math.PI * 2;
      vx += Math.cos(wanderAngle) * speed * hungerFactor * 0.4;
      vy += Math.sin(wanderAngle) * speed * hungerFactor * 0.4;
    }
  }
  
  // CASCADING CROWD DYNAMICS - Prevent trapped cores
  // Calculate pressure gradient from crowd density
  let pressureX = 0, pressureY = 0;
  if (crowdStress > 0.2) {
    // Entities in crowds create "pressure waves" that propagate outward
    // This helps trapped entities in the core push through outer layers
    
    // Calculate average movement direction of nearby same-tribe members
    let tribeMovementX = 0, tribeMovementY = 0;
    let movingAllies = 0;
    
    grid.forNeighborsWithLimit(px, py, vision * 1.5, 30, (j) => {
      if (j === i || !alive[j] || tribeId[j] !== myTribe) return false;
      
      const vx = vel[j * 2];
      const vy = vel[j * 2 + 1];
      const speed = Math.sqrt(vx * vx + vy * vy);
      
      if (speed > 5) { // Only count moving entities
        tribeMovementX += vx / speed;
        tribeMovementY += vy / speed;
        movingAllies++;
      }
      return true;
    });
    
    // If many allies are trying to move in same direction, join the push
    if (movingAllies > 3) {
      const pushNorm = Math.sqrt(tribeMovementX * tribeMovementX + tribeMovementY * tribeMovementY) || 1;
      pressureX = (tribeMovementX / pushNorm) * crowdStress * speed * 0.4;
      pressureY = (tribeMovementY / pushNorm) * crowdStress * speed * 0.4;
    }
    
    // Strong outward pressure when extremely crowded
    if (crowdStress > 0.6) {
      // Calculate center of mass of crowd
      let crowdCenterX = 0, crowdCenterY = 0;
      let crowdCount = 0;
      
      grid.forNeighborsWithLimit(px, py, vision, 20, (j) => {
        if (j !== i && alive[j]) {
          crowdCenterX += pos[j * 2];
          crowdCenterY += pos[j * 2 + 1];
          crowdCount++;
        }
        return true;
      });
      
      if (crowdCount > 0) {
        crowdCenterX /= crowdCount;
        crowdCenterY /= crowdCount;
        
        // Push away from crowd center with exponential force
        const awayX = px - crowdCenterX;
        const awayY = py - crowdCenterY;
        const awayDist = Math.sqrt(awayX * awayX + awayY * awayY) || 1;
        
        const pushForce = Math.pow(crowdStress, 3) * speed * 0.6; // Cubic for extreme crowds
        pressureX += (awayX / awayDist) * pushForce;
        pressureY += (awayY / awayDist) * pushForce;
      }
    }
  }
  
  // Apply pressure forces
  vx += pressureX;
  vy += pressureY;
  
  // Anti-complacency: Force movement when too stationary
  const currentSpeed = Math.sqrt(vx * vx + vy * vy);
  if (currentSpeed < speed * 0.2 && myEnergy > 30) {
    // Entity is moving too slowly - add restlessness
    // Use entity index and random value for unique movement patterns
    const restlessAngle = (i * 1.618033988749895 + rand() * Math.PI) * 2;
    const restlessForce = speed * 0.3 * (1 + crowdStress);
    vx += Math.cos(restlessAngle) * restlessForce;
    vy += Math.sin(restlessAngle) * restlessForce;
  }
  
  // Crowd avoidance with separation forces
  if (crowdStress > 0.15) {
    // Progressive crowd avoidance that scales with stress
    const crowdAvoidance = Math.pow(crowdStress * 1.5, 2); // Stronger quadratic response
    vx += separateX * speed * crowdAvoidance * 0.8;
    vy += separateY * speed * crowdAvoidance * 0.8;
  }
  
  // Random wander component - INCREASED to prevent stagnation
  const optimalGroup = 4;
  const groupDeviation = Math.abs(nearbyAllies - optimalGroup) / optimalGroup;
  const wanderFactor = Math.max(0.2, Math.min(1, groupDeviation * 0.4 + crowdStress * 0.3));
  vx += (rand() * 2 - 1) * speed * 0.3 * wanderFactor;
  vy += (rand() * 2 - 1) * speed * 0.3 * wanderFactor;
  
  // INTELLIGENT WALL AVOIDANCE: Detect walls early and turn away
  const wallDetectionRange = vision * 0.8; // Use vision range for wall detection
  const wallAvoidanceStrength = speed * 1.5;

  // Calculate distances to all borders
  const distToLeft = px;
  const distToRight = world.width - px;
  const distToTop = py;
  const distToBottom = world.height - py;

  // Check if we're heading toward a wall and need to turn
  let wallAvoidanceX = 0;
  let wallAvoidanceY = 0;
  let nearWall = false;

  // Left wall detection - improved to prevent vacuum effect
  if (distToLeft < wallDetectionRange) {
    nearWall = true;
    // Turn away from wall - stronger the closer we get
    const avoidanceForce = Math.pow((wallDetectionRange - distToLeft) / wallDetectionRange, 2);
    wallAvoidanceX += wallAvoidanceStrength * avoidanceForce * 1.5; // Stronger repulsion

    // Add perpendicular movement to avoid getting stuck
    if (distToLeft < 20) {
      // Very close - strong perpendicular push with randomization
      const perpAngle = (orientation ? orientation[i] : Math.atan2(vy, vx)) + (rand() - 0.5) * Math.PI * 0.5;
      wallAvoidanceY += Math.sin(perpAngle) * speed * 3; // Stronger perpendicular force
      wallAvoidanceX += speed * 2; // Always push away from wall
    }
  }

  // Right wall detection - improved to prevent vacuum effect
  if (distToRight < wallDetectionRange) {
    nearWall = true;
    const avoidanceForce = Math.pow((wallDetectionRange - distToRight) / wallDetectionRange, 2);
    wallAvoidanceX -= wallAvoidanceStrength * avoidanceForce * 1.5; // Stronger repulsion

    if (distToRight < 20) {
      const perpAngle = (orientation ? orientation[i] : Math.atan2(vy, vx)) + (rand() - 0.5) * Math.PI * 0.5;
      wallAvoidanceY += Math.sin(perpAngle) * speed * 3;
      wallAvoidanceX -= speed * 2; // Always push away from wall
    }
  }

  // Top wall detection - improved to prevent vacuum effect
  if (distToTop < wallDetectionRange) {
    nearWall = true;
    const avoidanceForce = Math.pow((wallDetectionRange - distToTop) / wallDetectionRange, 2);
    wallAvoidanceY += wallAvoidanceStrength * avoidanceForce * 1.5; // Stronger repulsion

    if (distToTop < 20) {
      const perpAngle = (orientation ? orientation[i] : Math.atan2(vy, vx)) + (rand() - 0.5) * Math.PI * 0.5;
      wallAvoidanceX += Math.cos(perpAngle) * speed * 3;
      wallAvoidanceY += speed * 2; // Always push away from wall
    }
  }

  // Bottom wall detection - improved to prevent vacuum effect
  if (distToBottom < wallDetectionRange) {
    nearWall = true;
    const avoidanceForce = Math.pow((wallDetectionRange - distToBottom) / wallDetectionRange, 2);
    wallAvoidanceY -= wallAvoidanceStrength * avoidanceForce * 1.5; // Stronger repulsion

    if (distToBottom < 20) {
      const perpAngle = (orientation ? orientation[i] : Math.atan2(vy, vx)) + (rand() - 0.5) * Math.PI * 0.5;
      wallAvoidanceX += Math.cos(perpAngle) * speed * 3;
      wallAvoidanceY -= speed * 2; // Always push away from wall
    }
  }

  // Apply wall avoidance
  if (nearWall) {
    // Override other behaviors when near wall
    vx = vx * 0.3 + wallAvoidanceX; // Reduce original direction, add avoidance
    vy = vy * 0.3 + wallAvoidanceY;

    // Add randomness but only in directions away from walls
    // Calculate the safe angle range based on which walls we're near
    let minSafeAngle = 0;
    let maxSafeAngle = Math.PI * 2;

    // Constrain angle based on nearby walls
    if (distToLeft < wallDetectionRange) {
      // Near left wall - can go from -45° to 45° (pointing right)
      minSafeAngle = -Math.PI / 4;
      maxSafeAngle = Math.PI / 4;
    } else if (distToRight < wallDetectionRange) {
      // Near right wall - can go from 135° to 225° (pointing left)
      minSafeAngle = Math.PI * 0.75;
      maxSafeAngle = Math.PI * 1.25;
    }

    if (distToTop < wallDetectionRange) {
      // Near top wall - limit to downward angles
      if (distToLeft < wallDetectionRange) {
        // Top-left corner: 0° to 90° (right-down quadrant)
        minSafeAngle = 0;
        maxSafeAngle = Math.PI / 2;
      } else if (distToRight < wallDetectionRange) {
        // Top-right corner: 90° to 180° (left-down quadrant)
        minSafeAngle = Math.PI / 2;
        maxSafeAngle = Math.PI;
      } else {
        // Just top wall: 45° to 135° (downward)
        minSafeAngle = Math.PI / 4;
        maxSafeAngle = Math.PI * 0.75;
      }
    } else if (distToBottom < wallDetectionRange) {
      // Near bottom wall - limit to upward angles
      if (distToLeft < wallDetectionRange) {
        // Bottom-left corner: -90° to 0° (right-up quadrant)
        minSafeAngle = -Math.PI / 2;
        maxSafeAngle = 0;
      } else if (distToRight < wallDetectionRange) {
        // Bottom-right corner: 180° to 270° (left-up quadrant)
        minSafeAngle = Math.PI;
        maxSafeAngle = Math.PI * 1.5;
      } else {
        // Just bottom wall: -135° to -45° (upward)
        minSafeAngle = -Math.PI * 0.75;
        maxSafeAngle = -Math.PI / 4;
      }
    }

    // Apply random movement within safe angle range
    const safeRandomAngle = minSafeAngle + rand() * (maxSafeAngle - minSafeAngle);
    vx += Math.cos(safeRandomAngle) * speed * 0.3;
    vy += Math.sin(safeRandomAngle) * speed * 0.3;

    // If stuck in corner (near two walls), use the calculated safe angle
    const nearCorner =
      (distToLeft < 30 || distToRight < 30) && 
      (distToTop < 30 || distToBottom < 30);

    if (nearCorner) {
      // Use a much stronger push in the safe direction to escape corner
      const escapeAngle = minSafeAngle + rand() * (maxSafeAngle - minSafeAngle);
      vx = Math.cos(escapeAngle) * speed * 3; // Doubled escape force
      vy = Math.sin(escapeAngle) * speed * 3; // Doubled escape force

      // Add extra random turbulence to break out of corner traps
      vx += (rand() - 0.5) * speed;
      vy += (rand() - 0.5) * speed;
    }
  }

  // Update velocity with less damping for more dynamic movement
  vel[i * 2] = vx * 0.92; // Reduced damping from 0.95
  vel[i * 2 + 1] = vy * 0.92;
}