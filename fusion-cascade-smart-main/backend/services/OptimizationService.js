const logger = require('../utils/logger');

class OptimizationService {
  constructor() {
    this.algorithms = {
      greedy: this.greedyOptimization.bind(this),
      linear: this.linearProgramming.bind(this),
      genetic: this.geneticAlgorithm.bind(this),
      simulated_annealing: this.simulatedAnnealing.bind(this)
    };
  }

  async optimizeDistribution(locations) {
    try {
      // Run multiple optimization algorithms and compare results
      const results = await Promise.all([
        this.greedyOptimization(locations),
        this.linearProgramming(locations),
        this.geneticAlgorithm(locations)
      ]);

      // Select best result based on efficiency score
      const bestResult = results.reduce((best, current) => 
        current.efficiency > best.efficiency ? current : best
      );

      return {
        ...bestResult,
        alternativeResults: results.filter(r => r !== bestResult),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in optimization:', error);
      return this.fallbackOptimization(locations);
    }
  }

  async greedyOptimization(locations) {
    try {
      const optimized = [...locations];
      const recommendations = [];
      
      // Sort locations by severity score (most critical first)
      const sortedLocations = optimized.sort((a, b) => b.severityScore - a.severityScore);
      
      // Find BESS locations for power redistribution
      const bessLocations = sortedLocations.filter(l => l.type === 'bess');
      const nonBessLocations = sortedLocations.filter(l => l.type !== 'bess');
      
      let totalPowerAvailable = bessLocations.reduce((sum, bess) => {
        // BESS can provide power if not fully loaded
        return sum + Math.max(0, bess.capacity - bess.currentLoad);
      }, 0);

      // Optimize critical and warning locations first
      for (const location of nonBessLocations) {
        if (location.status === 'critical' || location.status === 'warning') {
          const targetReduction = location.status === 'critical' ? 20 : 10;
          const actualReduction = Math.min(targetReduction, location.currentLoad);
          
          if (totalPowerAvailable >= actualReduction) {
            const newLoad = location.currentLoad - actualReduction;
            totalPowerAvailable -= actualReduction;
            
            recommendations.push({
              locationId: location.id,
              currentLoad: location.currentLoad,
              recommendedLoad: newLoad,
              adjustment: -actualReduction,
              reason: `Load reduction for ${location.status} zone`,
              priority: location.status === 'critical' ? 3 : 2,
              powerSource: 'BESS redistribution'
            });
            
            // Update location for further calculations
            location.currentLoad = newLoad;
            location.status = this.calculateStatus(newLoad);
          }
        }
      }

      // Optimize load balancing for normal locations
      const normalLocations = nonBessLocations.filter(l => l.status === 'normal');
      if (normalLocations.length > 1) {
        const avgLoad = normalLocations.reduce((sum, l) => sum + l.currentLoad, 0) / normalLocations.length;
        
        for (const location of normalLocations) {
          const deviation = location.currentLoad - avgLoad;
          
          if (Math.abs(deviation) > 10) { // Only adjust if significant deviation
            const adjustment = -deviation * 0.3; // Gradual adjustment
            const newLoad = Math.max(0, Math.min(100, location.currentLoad + adjustment));
            
            if (Math.abs(adjustment) > 1) { // Only recommend if meaningful change
              recommendations.push({
                locationId: location.id,
                currentLoad: location.currentLoad,
                recommendedLoad: newLoad,
                adjustment,
                reason: 'Load balancing optimization',
                priority: 1,
                powerSource: 'Load redistribution'
              });
            }
          }
        }
      }

      // Calculate efficiency metrics
      const efficiency = this.calculateEfficiency(optimized, recommendations);
      
      return {
        algorithm: 'greedy',
        success: true,
        efficiency: efficiency.overall,
        recommendations,
        metrics: efficiency,
        powerSaved: recommendations.reduce((sum, r) => sum + Math.abs(r.adjustment), 0),
        criticalReduced: recommendations.filter(r => r.priority === 3).length
      };
    } catch (error) {
      logger.error('Error in greedy optimization:', error);
      throw error;
    }
  }

  async linearProgramming(locations) {
    try {
      // Simplified linear programming approach
      const recommendations = [];
      
      // Define objective: minimize total system load variance while respecting constraints
      const totalCapacity = locations.reduce((sum, l) => sum + (l.capacity || 100), 0);
      const totalCurrentLoad = locations.reduce((sum, l) => sum + l.currentLoad, 0);
      const targetUtilization = 0.7; // 70% utilization target
      const targetTotalLoad = totalCapacity * targetUtilization;
      
      // Calculate required adjustment
      const totalAdjustment = targetTotalLoad - totalCurrentLoad;
      
      // Distribute adjustment based on location priorities and constraints
      for (const location of locations) {
        let weight = 1;
        
        // Higher weight for critical locations (more urgent to adjust)
        if (location.status === 'critical') weight = 3;
        else if (location.status === 'warning') weight = 2;
        
        // BESS locations can handle larger adjustments
        if (location.type === 'bess') weight *= 1.5;
        
        // Calculate proportional adjustment
        const locationAdjustment = (totalAdjustment * weight) / locations.length;
        
        // Apply constraints
        const maxIncrease = Math.max(0, (location.capacity || 100) - location.currentLoad);
        const maxDecrease = location.currentLoad;
        
        const constrainedAdjustment = Math.max(
          -maxDecrease, 
          Math.min(maxIncrease, locationAdjustment)
        );
        
        if (Math.abs(constrainedAdjustment) > 1) {
          const newLoad = location.currentLoad + constrainedAdjustment;
          
          recommendations.push({
            locationId: location.id,
            currentLoad: location.currentLoad,
            recommendedLoad: newLoad,
            adjustment: constrainedAdjustment,
            reason: 'Linear programming optimization',
            priority: weight > 2 ? 3 : (weight > 1 ? 2 : 1),
            powerSource: 'System optimization'
          });
        }
      }
      
      const efficiency = this.calculateEfficiency(locations, recommendations);
      
      return {
        algorithm: 'linear_programming',
        success: true,
        efficiency: efficiency.overall,
        recommendations,
        metrics: efficiency,
        targetUtilization: targetUtilization * 100,
        actualAdjustment: recommendations.reduce((sum, r) => sum + r.adjustment, 0)
      };
    } catch (error) {
      logger.error('Error in linear programming:', error);
      throw error;
    }
  }

  async geneticAlgorithm(locations) {
    try {
      // Simplified genetic algorithm for power distribution optimization
      const populationSize = 20;
      const generations = 10;
      const mutationRate = 0.1;
      
      // Initialize population (different load distributions)
      let population = [];
      for (let i = 0; i < populationSize; i++) {
        population.push(this.generateRandomSolution(locations));
      }
      
      // Evolution loop
      for (let gen = 0; gen < generations; gen++) {
        // Evaluate fitness for each solution
        const fitness = population.map(solution => this.evaluateFitness(solution, locations));
        
        // Selection (tournament selection)
        const newPopulation = [];
        for (let i = 0; i < populationSize; i++) {
          const parent1 = this.tournamentSelection(population, fitness);
          const parent2 = this.tournamentSelection(population, fitness);
          let offspring = this.crossover(parent1, parent2);
          
          if (Math.random() < mutationRate) {
            offspring = this.mutate(offspring, locations);
          }
          
          newPopulation.push(offspring);
        }
        
        population = newPopulation;
      }
      
      // Select best solution
      const finalFitness = population.map(solution => this.evaluateFitness(solution, locations));
      const bestIndex = finalFitness.indexOf(Math.max(...finalFitness));
      const bestSolution = population[bestIndex];
      
      // Convert solution to recommendations
      const recommendations = [];
      for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        const recommendedLoad = bestSolution[i];
        const adjustment = recommendedLoad - location.currentLoad;
        
        if (Math.abs(adjustment) > 1) {
          recommendations.push({
            locationId: location.id,
            currentLoad: location.currentLoad,
            recommendedLoad,
            adjustment,
            reason: 'Genetic algorithm optimization',
            priority: location.status === 'critical' ? 3 : (location.status === 'warning' ? 2 : 1),
            powerSource: 'Evolutionary optimization'
          });
        }
      }
      
      const efficiency = this.calculateEfficiency(locations, recommendations);
      
      return {
        algorithm: 'genetic_algorithm',
        success: true,
        efficiency: efficiency.overall,
        recommendations,
        metrics: efficiency,
        generations,
        bestFitness: finalFitness[bestIndex]
      };
    } catch (error) {
      logger.error('Error in genetic algorithm:', error);
      throw error;
    }
  }

  generateRandomSolution(locations) {
    return locations.map(location => {
      const capacity = location.capacity || 100;
      const minLoad = Math.max(0, location.currentLoad - 20);
      const maxLoad = Math.min(capacity, location.currentLoad + 20);
      return minLoad + Math.random() * (maxLoad - minLoad);
    });
  }

  evaluateFitness(solution, locations) {
    let fitness = 0;
    
    // Penalty for overloads
    for (let i = 0; i < solution.length; i++) {
      const load = solution[i];
      const capacity = locations[i].capacity || 100;
      
      if (load > capacity) {
        fitness -= (load - capacity) * 10; // Heavy penalty for exceeding capacity
      } else if (load > 85) {
        fitness -= (load - 85) * 5; // Penalty for high load
      } else if (load < 10) {
        fitness -= (10 - load) * 2; // Penalty for very low utilization
      } else {
        fitness += 10; // Reward for good utilization
      }
    }
    
    // Reward for load balancing
    const mean = solution.reduce((sum, load) => sum + load, 0) / solution.length;
    const variance = solution.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / solution.length;
    fitness -= variance; // Lower variance is better
    
    // Reward for reducing critical loads
    for (let i = 0; i < solution.length; i++) {
      if (locations[i].status === 'critical' && solution[i] < locations[i].currentLoad) {
        fitness += (locations[i].currentLoad - solution[i]) * 2;
      }
    }
    
    return fitness;
  }

  tournamentSelection(population, fitness, tournamentSize = 3) {
    let bestIndex = Math.floor(Math.random() * population.length);
    let bestFitness = fitness[bestIndex];
    
    for (let i = 1; i < tournamentSize; i++) {
      const index = Math.floor(Math.random() * population.length);
      if (fitness[index] > bestFitness) {
        bestIndex = index;
        bestFitness = fitness[index];
      }
    }
    
    return population[bestIndex];
  }

  crossover(parent1, parent2) {
    const offspring = [];
    const crossoverPoint = Math.floor(Math.random() * parent1.length);
    
    for (let i = 0; i < parent1.length; i++) {
      offspring[i] = i < crossoverPoint ? parent1[i] : parent2[i];
    }
    
    return offspring;
  }

  mutate(solution, locations) {
    const mutated = [...solution];
    const mutationIndex = Math.floor(Math.random() * solution.length);
    const location = locations[mutationIndex];
    const capacity = location.capacity || 100;
    
    // Random mutation within constraints
    const minLoad = 0;
    const maxLoad = capacity;
    mutated[mutationIndex] = minLoad + Math.random() * (maxLoad - minLoad);
    
    return mutated;
  }

  async simulatedAnnealing(locations) {
    try {
      // Simplified simulated annealing
      const initialTemp = 100;
      const coolingRate = 0.95;
      const minTemp = 1;
      
      // Start with current state
      let currentSolution = locations.map(l => l.currentLoad);
      let currentFitness = this.evaluateFitness(currentSolution, locations);
      let bestSolution = [...currentSolution];
      let bestFitness = currentFitness;
      
      let temperature = initialTemp;
      
      while (temperature > minTemp) {
        // Generate neighbor solution
        const neighbor = this.generateNeighbor(currentSolution, locations);
        const neighborFitness = this.evaluateFitness(neighbor, locations);
        
        // Accept or reject neighbor
        const delta = neighborFitness - currentFitness;
        if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
          currentSolution = neighbor;
          currentFitness = neighborFitness;
          
          if (neighborFitness > bestFitness) {
            bestSolution = [...neighbor];
            bestFitness = neighborFitness;
          }
        }
        
        temperature *= coolingRate;
      }
      
      // Convert to recommendations
      const recommendations = [];
      for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        const recommendedLoad = bestSolution[i];
        const adjustment = recommendedLoad - location.currentLoad;
        
        if (Math.abs(adjustment) > 1) {
          recommendations.push({
            locationId: location.id,
            currentLoad: location.currentLoad,
            recommendedLoad,
            adjustment,
            reason: 'Simulated annealing optimization',
            priority: location.status === 'critical' ? 3 : (location.status === 'warning' ? 2 : 1),
            powerSource: 'Annealing optimization'
          });
        }
      }
      
      const efficiency = this.calculateEfficiency(locations, recommendations);
      
      return {
        algorithm: 'simulated_annealing',
        success: true,
        efficiency: efficiency.overall,
        recommendations,
        metrics: efficiency,
        finalTemperature: temperature,
        bestFitness
      };
    } catch (error) {
      logger.error('Error in simulated annealing:', error);
      throw error;
    }
  }

  generateNeighbor(solution, locations) {
    const neighbor = [...solution];
    const index = Math.floor(Math.random() * solution.length);
    const location = locations[index];
    const capacity = location.capacity || 100;
    
    // Small random change
    const change = (Math.random() - 0.5) * 10; // ±5 units
    neighbor[index] = Math.max(0, Math.min(capacity, neighbor[index] + change));
    
    return neighbor;
  }

  calculateEfficiency(locations, recommendations) {
    // Apply recommendations to calculate new state
    const newState = locations.map(location => {
      const rec = recommendations.find(r => r.locationId === location.id);
      return {
        ...location,
        currentLoad: rec ? rec.recommendedLoad : location.currentLoad
      };
    });
    
    // Calculate various efficiency metrics
    const totalCapacity = newState.reduce((sum, l) => sum + (l.capacity || 100), 0);
    const totalLoad = newState.reduce((sum, l) => sum + l.currentLoad, 0);
    const utilization = (totalLoad / totalCapacity) * 100;
    
    // Load balancing (lower variance is better)
    const loads = newState.map(l => l.currentLoad);
    const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    const variance = loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length;
    const balance = Math.max(0, 100 - Math.sqrt(variance));
    
    // System stability (fewer critical/warning locations)
    const criticalCount = newState.filter(l => this.calculateStatus(l.currentLoad) === 'critical').length;
    const warningCount = newState.filter(l => this.calculateStatus(l.currentLoad) === 'warning').length;
    const stability = Math.max(0, 100 - (criticalCount * 30 + warningCount * 15));
    
    // Power loss (simplified - based on load distribution efficiency)
    const optimalUtilization = 70;
    const utilizationEfficiency = Math.max(0, 100 - Math.abs(utilization - optimalUtilization));
    
    // Overall efficiency (weighted average)
    const overall = (balance * 0.3 + stability * 0.4 + utilizationEfficiency * 0.3);
    
    return {
      overall: Math.round(overall * 100) / 100,
      utilization: Math.round(utilization * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      stability: Math.round(stability * 100) / 100,
      powerLoss: Math.round((100 - utilizationEfficiency) * 100) / 100,
      criticalLocations: criticalCount,
      warningLocations: warningCount
    };
  }

  calculateStatus(load) {
    if (load <= 65) return 'normal';
    if (load <= 85) return 'warning';
    return 'critical';
  }

  async optimizeWithParameters(locations, objectives, constraints, algorithm) {
    try {
      const optimizationFunction = this.algorithms[algorithm] || this.greedyOptimization;
      
      // Apply constraints and objectives to the optimization
      const result = await optimizationFunction.call(this, locations);
      
      // Filter recommendations based on constraints
      if (constraints.maxAdjustment) {
        result.recommendations = result.recommendations.filter(
          r => Math.abs(r.adjustment) <= constraints.maxAdjustment
        );
      }
      
      if (constraints.priorityFilter) {
        result.recommendations = result.recommendations.filter(
          r => r.priority >= constraints.priorityFilter
        );
      }
      
      return {
        ...result,
        objectives,
        constraints,
        algorithm
      };
    } catch (error) {
      logger.error('Error in parameterized optimization:', error);
      throw error;
    }
  }

  async calculateSystemEfficiency(locations) {
    try {
      const totalCapacity = locations.reduce((sum, l) => sum + (l.capacity || 100), 0);
      const totalLoad = locations.reduce((sum, l) => sum + l.currentLoad, 0);
      const utilization = (totalLoad / totalCapacity) * 100;
      
      // Calculate efficiency metrics
      const efficiency = this.calculateEfficiency(locations, []);
      
      // Additional system-wide metrics
      const bessEfficiency = this.calculateBESSEfficiency(locations);
      const networkLoss = this.calculateNetworkLoss(locations);
      
      return {
        ...efficiency,
        bessEfficiency,
        networkLoss,
        recommendations: this.getEfficiencyRecommendations(efficiency)
      };
    } catch (error) {
      logger.error('Error calculating system efficiency:', error);
      throw error;
    }
  }

  calculateBESSEfficiency(locations) {
    const bessLocations = locations.filter(l => l.type === 'bess');
    
    if (bessLocations.length === 0) {
      return { efficiency: 0, message: 'No BESS locations found' };
    }
    
    const totalBessCapacity = bessLocations.reduce((sum, l) => sum + (l.capacity || 100), 0);
    const totalBessLoad = bessLocations.reduce((sum, l) => sum + l.currentLoad, 0);
    const bessUtilization = (totalBessLoad / totalBessCapacity) * 100;
    
    // BESS efficiency is optimal around 60-80% utilization
    const optimalRange = [60, 80];
    let efficiency;
    
    if (bessUtilization >= optimalRange[0] && bessUtilization <= optimalRange[1]) {
      efficiency = 100;
    } else if (bessUtilization < optimalRange[0]) {
      efficiency = (bessUtilization / optimalRange[0]) * 100;
    } else {
      efficiency = Math.max(0, 100 - (bessUtilization - optimalRange[1]) * 2);
    }
    
    return {
      efficiency: Math.round(efficiency * 100) / 100,
      utilization: Math.round(bessUtilization * 100) / 100,
      optimalRange,
      bessCount: bessLocations.length
    };
  }

  calculateNetworkLoss(locations) {
    // Simplified network loss calculation based on load distribution
    const loads = locations.map(l => l.currentLoad);
    const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    
    // Higher variance in loads leads to higher network losses
    const variance = loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length;
    const loss = Math.min(20, variance / 10); // Cap at 20% loss
    
    return {
      percentage: Math.round(loss * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      recommendation: loss > 10 ? 'High network loss detected - consider load balancing' : 'Network loss within acceptable range'
    };
  }

  getEfficiencyRecommendations(efficiency) {
    const recommendations = [];
    
    if (efficiency.stability < 70) {
      recommendations.push({
        type: 'stability',
        priority: 'high',
        message: 'System stability is low - address critical and warning locations immediately'
      });
    }
    
    if (efficiency.balance < 60) {
      recommendations.push({
        type: 'balance',
        priority: 'medium',
        message: 'Load distribution is unbalanced - consider redistributing power'
      });
    }
    
    if (efficiency.utilization < 50 || efficiency.utilization > 90) {
      recommendations.push({
        type: 'utilization',
        priority: 'medium',
        message: `System utilization (${efficiency.utilization}%) is outside optimal range (60-80%)`
      });
    }
    
    return recommendations;
  }

  async optimizeLoadBalance(locations) {
    try {
      const loads = locations.map(l => l.currentLoad);
      const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
      const recommendations = [];
      
      for (const location of locations) {
        const deviation = location.currentLoad - avgLoad;
        
        if (Math.abs(deviation) > 15) { // Significant deviation
          const targetAdjustment = -deviation * 0.5; // Move halfway to average
          const newLoad = Math.max(0, Math.min(location.capacity || 100, location.currentLoad + targetAdjustment));
          
          recommendations.push({
            locationId: location.id,
            currentLoad: location.currentLoad,
            recommendedLoad: newLoad,
            adjustment: newLoad - location.currentLoad,
            reason: 'Load balancing optimization',
            priority: Math.abs(deviation) > 25 ? 3 : 2,
            deviation: Math.round(deviation * 100) / 100
          });
        }
      }
      
      const efficiency = this.calculateEfficiency(locations, recommendations);
      
      return {
        algorithm: 'load_balancing',
        success: true,
        efficiency: efficiency.overall,
        recommendations,
        metrics: efficiency,
        currentVariance: Math.sqrt(loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length),
        targetAverage: Math.round(avgLoad * 100) / 100
      };
    } catch (error) {
      logger.error('Error optimizing load balance:', error);
      throw error;
    }
  }

  async analyzeScenario(scenario) {
    try {
      const { name, locations: scenarioLocations, objectives = ['efficiency'] } = scenario;
      
      // Run optimization on scenario data
      const optimization = await this.optimizeDistribution(scenarioLocations);
      
      // Calculate scenario-specific metrics
      const metrics = {
        beforeOptimization: this.calculateEfficiency(scenarioLocations, []),
        afterOptimization: optimization.metrics,
        improvement: {}
      };
      
      // Calculate improvements
      metrics.improvement = {
        efficiency: metrics.afterOptimization.overall - metrics.beforeOptimization.overall,
        stability: metrics.afterOptimization.stability - metrics.beforeOptimization.stability,
        balance: metrics.afterOptimization.balance - metrics.beforeOptimization.balance
      };
      
      return {
        scenario: name,
        optimization,
        metrics,
        feasible: optimization.success,
        riskAssessment: this.assessScenarioRisk(scenarioLocations, optimization.recommendations)
      };
    } catch (error) {
      logger.error('Error analyzing scenario:', error);
      throw error;
    }
  }

  assessScenarioRisk(locations, recommendations) {
    let riskScore = 0;
    const risks = [];
    
    // Check for high load adjustments
    const largeAdjustments = recommendations.filter(r => Math.abs(r.adjustment) > 20);
    if (largeAdjustments.length > 0) {
      riskScore += largeAdjustments.length * 10;
      risks.push(`${largeAdjustments.length} locations require large load adjustments (>20%)`);
    }
    
    // Check for critical locations
    const criticalLocations = locations.filter(l => l.status === 'critical');
    if (criticalLocations.length > 0) {
      riskScore += criticalLocations.length * 15;
      risks.push(`${criticalLocations.length} locations in critical state`);
    }
    
    // Check system utilization
    const totalLoad = locations.reduce((sum, l) => sum + l.currentLoad, 0);
    const totalCapacity = locations.reduce((sum, l) => sum + (l.capacity || 100), 0);
    const utilization = (totalLoad / totalCapacity) * 100;
    
    if (utilization > 90) {
      riskScore += 20;
      risks.push('System utilization exceeds 90% - high risk of overload');
    } else if (utilization < 30) {
      riskScore += 10;
      risks.push('System utilization below 30% - inefficient operation');
    }
    
    return {
      score: Math.min(100, riskScore),
      level: riskScore < 20 ? 'low' : (riskScore < 50 ? 'medium' : 'high'),
      risks,
      recommendations: this.getRiskMitigationRecommendations(riskScore, risks)
    };
  }

  getRiskMitigationRecommendations(riskScore, risks) {
    const recommendations = [];
    
    if (riskScore > 50) {
      recommendations.push('Implement gradual load adjustments over multiple time periods');
      recommendations.push('Activate emergency protocols and backup systems');
      recommendations.push('Increase monitoring frequency for critical locations');
    } else if (riskScore > 20) {
      recommendations.push('Monitor system closely during optimization implementation');
      recommendations.push('Prepare contingency plans for potential issues');
    } else {
      recommendations.push('Proceed with optimization as planned');
      recommendations.push('Maintain standard monitoring protocols');
    }
    
    return recommendations;
  }

  async getRecommendations(locations, priority = 'all', limit = 10) {
    try {
      const optimization = await this.optimizeDistribution(locations);
      let recommendations = optimization.recommendations;
      
      // Filter by priority
      if (priority !== 'all') {
        const priorityMap = { 'high': 3, 'medium': 2, 'low': 1 };
        const minPriority = priorityMap[priority] || 1;
        recommendations = recommendations.filter(r => r.priority >= minPriority);
      }
      
      // Sort by priority and impact
      recommendations.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return Math.abs(b.adjustment) - Math.abs(a.adjustment);
      });
      
      // Limit results
      recommendations = recommendations.slice(0, limit);
      
      return {
        recommendations,
        totalCount: optimization.recommendations.length,
        filteredCount: recommendations.length,
        systemEfficiency: optimization.efficiency,
        priority,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting recommendations:', error);
      throw error;
    }
  }

  fallbackOptimization(locations) {
    // Simple fallback optimization
    const recommendations = [];
    
    for (const location of locations) {
      if (location.status === 'critical') {
        recommendations.push({
          locationId: location.id,
          currentLoad: location.currentLoad,
          recommendedLoad: Math.max(0, location.currentLoad - 15),
          adjustment: -15,
          reason: 'Emergency load reduction',
          priority: 3,
          powerSource: 'Fallback optimization'
        });
      }
    }
    
    return {
      algorithm: 'fallback',
      success: true,
      efficiency: 50,
      recommendations,
      metrics: {
        overall: 50,
        utilization: 0,
        balance: 0,
        stability: 0,
        powerLoss: 0
      },
      error: 'Using fallback optimization due to system error'
    };
  }
}

module.exports = OptimizationService;