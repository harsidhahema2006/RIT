#!/usr/bin/env python3
"""
Smart Power Distribution - Reinforcement Learning Service
Provides Q-Learning and Deep Q-Network (DQN) based power distribution optimization
"""

import os
import sys
import logging
import numpy as np
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from collections import deque
import random

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import warnings
warnings.filterwarnings('ignore')

# RL Libraries
try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential, load_model
    from tensorflow.keras.layers import Dense, Dropout
    from tensorflow.keras.optimizers import Adam
    TENSORFLOW_AVAILABLE = True
except ImportError:
    print("TensorFlow not available, using Q-table based RL")
    TENSORFLOW_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

class PowerDistributionRL:
    """Reinforcement Learning system for optimal power distribution"""
    
    def __init__(self):
        self.state_size = 20  # Number of features in state representation
        self.action_size = 10  # Number of possible actions per location
        self.memory = deque(maxlen=10000)  # Experience replay buffer
        self.epsilon = 1.0  # Exploration rate
        self.epsilon_min = 0.01
        self.epsilon_decay = 0.995
        self.learning_rate = 0.001
        self.gamma = 0.95  # Discount factor
        
        # Model storage
        self.models_dir = 'rl_models'
        os.makedirs(self.models_dir, exist_ok=True)
        
        # Q-table for tabular Q-learning (fallback)
        self.q_table = {}
        
        # DQN model
        self.dqn_model = None
        self.target_model = None
        
        # Training statistics
        self.training_stats = {
            'episodes': 0,
            'total_reward': 0,
            'average_reward': 0,
            'last_training': None
        }
        
        # Initialize models
        self.initialize_models()
    
    def initialize_models(self):
        """Initialize RL models"""
        try:
            # Try to load existing models
            self.load_models()
        except:
            # Create new models if loading fails
            logger.info("Creating new RL models")
            self.create_models()
    
    def create_models(self):
        """Create new RL models"""
        if TENSORFLOW_AVAILABLE:
            # Deep Q-Network
            self.dqn_model = Sequential([
                Dense(128, input_dim=self.state_size, activation='relu'),
                Dropout(0.2),
                Dense(64, activation='relu'),
                Dropout(0.2),
                Dense(32, activation='relu'),
                Dense(self.action_size, activation='linear')
            ])
            self.dqn_model.compile(
                optimizer=Adam(learning_rate=self.learning_rate),
                loss='mse'
            )
            
            # Target network for stable training
            self.target_model = Sequential([
                Dense(128, input_dim=self.state_size, activation='relu'),
                Dropout(0.2),
                Dense(64, activation='relu'),
                Dropout(0.2),
                Dense(32, activation='relu'),
                Dense(self.action_size, activation='linear')
            ])
            self.target_model.compile(
                optimizer=Adam(learning_rate=self.learning_rate),
                loss='mse'
            )
            
            # Copy weights to target model
            self.update_target_model()
            
            logger.info("DQN models created successfully")
        else:
            logger.info("Using Q-table based RL (TensorFlow not available)")
    
    def save_models(self):
        """Save RL models to disk"""
        try:
            if TENSORFLOW_AVAILABLE and self.dqn_model:
                # Save DQN model
                dqn_path = os.path.join(self.models_dir, 'dqn_model.h5')
                self.dqn_model.save(dqn_path)
                
                target_path = os.path.join(self.models_dir, 'target_model.h5')
                self.target_model.save(target_path)
            
            # Save Q-table and other data
            rl_data = {
                'q_table': self.q_table,
                'epsilon': self.epsilon,
                'training_stats': self.training_stats,
                'state_size': self.state_size,
                'action_size': self.action_size
            }
            
            data_path = os.path.join(self.models_dir, 'rl_data.pkl')
            joblib.dump(rl_data, data_path)
            
            logger.info("RL models saved successfully")
            
        except Exception as e:
            logger.error(f"Error saving RL models: {e}")
    
    def load_models(self):
        """Load RL models from disk"""
        try:
            # Load Q-table and other data
            data_path = os.path.join(self.models_dir, 'rl_data.pkl')
            if os.path.exists(data_path):
                rl_data = joblib.load(data_path)
                self.q_table = rl_data.get('q_table', {})
                self.epsilon = rl_data.get('epsilon', 1.0)
                self.training_stats = rl_data.get('training_stats', self.training_stats)
            
            # Load DQN models
            if TENSORFLOW_AVAILABLE:
                dqn_path = os.path.join(self.models_dir, 'dqn_model.h5')
                target_path = os.path.join(self.models_dir, 'target_model.h5')
                
                if os.path.exists(dqn_path):
                    self.dqn_model = load_model(dqn_path)
                    logger.info("DQN model loaded successfully")
                
                if os.path.exists(target_path):
                    self.target_model = load_model(target_path)
                    logger.info("Target model loaded successfully")
            
            logger.info("RL models loaded successfully")
            
        except Exception as e:
            logger.warning(f"Could not load RL models: {e}")
            raise
    
    def encode_state(self, system_state: Dict) -> np.ndarray:
        """Encode system state into feature vector"""
        try:
            locations = system_state.get('locations', [])
            
            if not locations:
                return np.zeros(self.state_size)
            
            # System-level features
            system_load = system_state.get('systemLoad', 0)
            bess_capacity = system_state.get('bessCapacity', 0)
            critical_count = system_state.get('criticalCount', 0)
            
            # Location-level aggregated features
            total_locations = len(locations)
            avg_load = np.mean([loc.get('currentLoad', 0) for loc in locations])
            max_load = np.max([loc.get('currentLoad', 0) for loc in locations])
            min_load = np.min([loc.get('currentLoad', 0) for loc in locations])
            load_std = np.std([loc.get('currentLoad', 0) for loc in locations])
            
            # Predicted load features
            avg_predicted = np.mean([loc.get('predictedLoad', 0) for loc in locations])
            max_predicted = np.max([loc.get('predictedLoad', 0) for loc in locations])
            
            # Status distribution
            status_counts = {'normal': 0, 'warning': 0, 'critical': 0}
            for loc in locations:
                status = loc.get('status', 'normal')
                status_counts[status] += 1
            
            normal_ratio = status_counts['normal'] / total_locations
            warning_ratio = status_counts['warning'] / total_locations
            critical_ratio = status_counts['critical'] / total_locations
            
            # Type distribution
            type_counts = {'house': 0, 'factory': 0, 'industry': 0, 'substation': 0, 'bess': 0}
            for loc in locations:
                loc_type = loc.get('type', 'house')
                if loc_type in type_counts:
                    type_counts[loc_type] += 1
            
            # Time-based features
            now = datetime.now()
            hour_sin = np.sin(2 * np.pi * now.hour / 24)
            hour_cos = np.cos(2 * np.pi * now.hour / 24)
            day_sin = np.sin(2 * np.pi * now.weekday() / 7)
            day_cos = np.cos(2 * np.pi * now.weekday() / 7)
            
            # Construct state vector
            state = np.array([
                system_load / 100.0,  # Normalize to [0,1]
                bess_capacity / 1000.0,  # Normalize
                critical_count / total_locations,
                avg_load / 100.0,
                max_load / 100.0,
                min_load / 100.0,
                load_std / 100.0,
                avg_predicted / 100.0,
                max_predicted / 100.0,
                normal_ratio,
                warning_ratio,
                critical_ratio,
                type_counts['bess'] / total_locations,
                type_counts['substation'] / total_locations,
                type_counts['factory'] / total_locations,
                type_counts['industry'] / total_locations,
                hour_sin,
                hour_cos,
                day_sin,
                day_cos
            ])
            
            # Ensure correct size
            if len(state) < self.state_size:
                state = np.pad(state, (0, self.state_size - len(state)), 'constant')
            elif len(state) > self.state_size:
                state = state[:self.state_size]
            
            return state
            
        except Exception as e:
            logger.error(f"Error encoding state: {e}")
            return np.zeros(self.state_size)
    
    def get_optimal_action(self, system_state: Dict) -> Dict:
        """Get optimal power distribution action using RL"""
        try:
            state = self.encode_state(system_state)
            locations = system_state.get('locations', [])
            
            if not locations:
                return {'allocations': [], 'confidence': 0.0}
            
            # Get action from model
            if TENSORFLOW_AVAILABLE and self.dqn_model:
                action_values = self.dqn_model.predict(state.reshape(1, -1), verbose=0)[0]
            else:
                # Use Q-table
                state_key = self.discretize_state(state)
                action_values = self.q_table.get(state_key, np.random.rand(self.action_size))
            
            # Convert action values to power allocations
            allocations = self.action_to_allocations(action_values, locations)
            
            # Calculate confidence based on action value spread
            confidence = self.calculate_action_confidence(action_values)
            
            return {
                'allocations': allocations,
                'confidence': confidence,
                'action_values': action_values.tolist() if hasattr(action_values, 'tolist') else list(action_values),
                'strategy': 'dqn' if TENSORFLOW_AVAILABLE and self.dqn_model else 'q_table',
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting optimal action: {e}")
            return self.fallback_action(system_state)
    
    def action_to_allocations(self, action_values: np.ndarray, locations: List[Dict]) -> List[Dict]:
        """Convert action values to power allocation recommendations"""
        allocations = []
        
        try:
            # Sort locations by priority (critical first)
            priority_order = {'critical': 3, 'warning': 2, 'normal': 1}
            sorted_locations = sorted(
                locations, 
                key=lambda x: (priority_order.get(x.get('status', 'normal'), 1), 
                              x.get('currentLoad', 0)), 
                reverse=True
            )
            
            for i, location in enumerate(sorted_locations):
                if i >= len(action_values):
                    break
                
                action_value = action_values[i]
                current_load = location.get('currentLoad', 0)
                predicted_load = location.get('predictedLoad', 0)
                status = location.get('status', 'normal')
                
                # Calculate adjustment based on action value and location status
                if status == 'critical':
                    # Reduce load for critical locations
                    adjustment = -abs(action_value) * 10
                elif status == 'warning':
                    # Moderate adjustment for warning locations
                    adjustment = action_value * 5
                else:
                    # Small adjustments for normal locations
                    adjustment = action_value * 2
                
                # Apply constraints
                adjustment = max(-20, min(20, adjustment))  # Limit to ±20%
                
                allocations.append({
                    'locationId': location.get('id'),
                    'currentLoad': current_load,
                    'recommendedLoad': max(0, min(100, current_load + adjustment)),
                    'adjustment': adjustment,
                    'priority': priority_order.get(status, 1),
                    'reason': self.get_allocation_reason(status, adjustment)
                })
            
            return allocations
            
        except Exception as e:
            logger.error(f"Error converting action to allocations: {e}")
            return []
    
    def get_allocation_reason(self, status: str, adjustment: float) -> str:
        """Generate human-readable reason for allocation decision"""
        if status == 'critical':
            if adjustment < 0:
                return "Reducing load due to critical overload condition"
            else:
                return "Stabilizing critical zone"
        elif status == 'warning':
            if adjustment < 0:
                return "Preventive load reduction to avoid overload"
            else:
                return "Optimizing load distribution"
        else:
            if adjustment > 0:
                return "Increasing allocation to utilize available capacity"
            elif adjustment < 0:
                return "Minor load reduction for system optimization"
            else:
                return "Maintaining current optimal allocation"
    
    def calculate_action_confidence(self, action_values: np.ndarray) -> float:
        """Calculate confidence in the action selection"""
        try:
            if len(action_values) < 2:
                return 0.5
            
            # Calculate confidence based on the spread of action values
            max_val = np.max(action_values)
            min_val = np.min(action_values)
            spread = max_val - min_val
            
            # Higher spread indicates more confident decision
            confidence = min(1.0, spread / 2.0)
            
            # Adjust based on exploration rate
            confidence *= (1.0 - self.epsilon)
            
            return max(0.1, confidence)
            
        except Exception as e:
            logger.error(f"Error calculating confidence: {e}")
            return 0.5
    
    def discretize_state(self, state: np.ndarray) -> str:
        """Discretize continuous state for Q-table"""
        try:
            # Discretize each state dimension into bins
            discretized = []
            for value in state:
                if value < 0.2:
                    discretized.append('low')
                elif value < 0.5:
                    discretized.append('med')
                elif value < 0.8:
                    discretized.append('high')
                else:
                    discretized.append('very_high')
            
            return '_'.join(discretized)
            
        except Exception as e:
            logger.error(f"Error discretizing state: {e}")
            return 'default_state'
    
    def calculate_reward(self, prev_state: Dict, action: Dict, new_state: Dict) -> float:
        """Calculate reward for the RL agent"""
        try:
            reward = 0.0
            
            # Get location data
            prev_locations = prev_state.get('locations', [])
            new_locations = new_state.get('locations', [])
            
            if not prev_locations or not new_locations:
                return 0.0
            
            # Reward for reducing critical locations
            prev_critical = len([l for l in prev_locations if l.get('status') == 'critical'])
            new_critical = len([l for l in new_locations if l.get('status') == 'critical'])
            
            if new_critical < prev_critical:
                reward += 15 * (prev_critical - new_critical)  # +15 per critical zone stabilized
            elif new_critical > prev_critical:
                reward -= 20 * (new_critical - prev_critical)  # -20 per new critical zone
            
            # Reward for load balancing
            prev_loads = [l.get('currentLoad', 0) for l in prev_locations]
            new_loads = [l.get('currentLoad', 0) for l in new_locations]
            
            prev_std = np.std(prev_loads)
            new_std = np.std(new_loads)
            
            if new_std < prev_std:
                reward += 10 * (prev_std - new_std) / 10  # Reward for better balance
            
            # Penalty for overloads
            overloaded = len([l for l in new_locations if l.get('currentLoad', 0) > 85])
            reward -= 20 * overloaded
            
            # Reward for efficiency (avoiding waste)
            total_capacity = sum([l.get('capacity', 100) for l in new_locations])
            total_load = sum([l.get('currentLoad', 0) for l in new_locations])
            utilization = total_load / total_capacity if total_capacity > 0 else 0
            
            if 0.6 <= utilization <= 0.8:  # Optimal utilization range
                reward += 10
            elif utilization < 0.3:  # Wastage penalty
                reward -= 10
            
            # Small penalty for large adjustments (encourage stability)
            allocations = action.get('allocations', [])
            total_adjustment = sum([abs(a.get('adjustment', 0)) for a in allocations])
            reward -= total_adjustment * 0.1
            
            return reward
            
        except Exception as e:
            logger.error(f"Error calculating reward: {e}")
            return 0.0
    
    def remember(self, state: np.ndarray, action: int, reward: float, next_state: np.ndarray, done: bool):
        """Store experience in replay buffer"""
        self.memory.append((state, action, reward, next_state, done))
    
    def replay_training(self, batch_size: int = 32):
        """Train the DQN using experience replay"""
        if not TENSORFLOW_AVAILABLE or not self.dqn_model:
            return
        
        if len(self.memory) < batch_size:
            return
        
        try:
            # Sample random batch from memory
            batch = random.sample(self.memory, batch_size)
            
            states = np.array([e[0] for e in batch])
            actions = np.array([e[1] for e in batch])
            rewards = np.array([e[2] for e in batch])
            next_states = np.array([e[3] for e in batch])
            dones = np.array([e[4] for e in batch])
            
            # Predict Q-values for current states
            current_q_values = self.dqn_model.predict(states, verbose=0)
            
            # Predict Q-values for next states using target model
            next_q_values = self.target_model.predict(next_states, verbose=0)
            
            # Update Q-values using Bellman equation
            for i in range(batch_size):
                if dones[i]:
                    current_q_values[i][actions[i]] = rewards[i]
                else:
                    current_q_values[i][actions[i]] = rewards[i] + self.gamma * np.max(next_q_values[i])
            
            # Train the model
            self.dqn_model.fit(states, current_q_values, epochs=1, verbose=0)
            
            # Decay exploration rate
            if self.epsilon > self.epsilon_min:
                self.epsilon *= self.epsilon_decay
            
            logger.debug("DQN training step completed")
            
        except Exception as e:
            logger.error(f"Error in replay training: {e}")
    
    def update_target_model(self):
        """Update target model with current model weights"""
        if TENSORFLOW_AVAILABLE and self.dqn_model and self.target_model:
            self.target_model.set_weights(self.dqn_model.get_weights())
    
    def train_episode(self, training_data: Dict):
        """Train the RL agent with an episode of data"""
        try:
            states = training_data.get('states', [])
            actions = training_data.get('actions', [])
            rewards = training_data.get('rewards', [])
            next_states = training_data.get('next_states', [])
            
            if not all([states, actions, rewards, next_states]):
                return {'error': 'Incomplete training data'}
            
            # Store experiences in memory
            for i in range(len(states)):
                state = np.array(states[i])
                action = actions[i]
                reward = rewards[i]
                next_state = np.array(next_states[i])
                done = i == len(states) - 1  # Last step in episode
                
                self.remember(state, action, reward, next_state, done)
            
            # Perform replay training
            self.replay_training()
            
            # Update statistics
            episode_reward = sum(rewards)
            self.training_stats['episodes'] += 1
            self.training_stats['total_reward'] += episode_reward
            self.training_stats['average_reward'] = (
                self.training_stats['total_reward'] / self.training_stats['episodes']
            )
            self.training_stats['last_training'] = datetime.now().isoformat()
            
            # Update target model periodically
            if self.training_stats['episodes'] % 10 == 0:
                self.update_target_model()
            
            # Save models periodically
            if self.training_stats['episodes'] % 50 == 0:
                self.save_models()
            
            return {
                'episode_reward': episode_reward,
                'average_reward': self.training_stats['average_reward'],
                'epsilon': self.epsilon,
                'episodes_trained': self.training_stats['episodes']
            }
            
        except Exception as e:
            logger.error(f"Error in training episode: {e}")
            return {'error': str(e)}
    
    def fallback_action(self, system_state: Dict) -> Dict:
        """Fallback action when RL models fail"""
        try:
            locations = system_state.get('locations', [])
            allocations = []
            
            for location in locations:
                current_load = location.get('currentLoad', 0)
                status = location.get('status', 'normal')
                
                # Simple rule-based allocation
                if status == 'critical':
                    adjustment = -10  # Reduce load by 10%
                elif status == 'warning':
                    adjustment = -5   # Reduce load by 5%
                else:
                    adjustment = 0    # No change
                
                allocations.append({
                    'locationId': location.get('id'),
                    'currentLoad': current_load,
                    'recommendedLoad': max(0, min(100, current_load + adjustment)),
                    'adjustment': adjustment,
                    'priority': 1,
                    'reason': 'Rule-based fallback allocation'
                })
            
            return {
                'allocations': allocations,
                'confidence': 0.3,
                'strategy': 'fallback',
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in fallback action: {e}")
            return {'allocations': [], 'confidence': 0.0}

# Initialize global RL agent
rl_agent = PowerDistributionRL()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'rl-optimization-service',
        'tensorflow_available': TENSORFLOW_AVAILABLE,
        'models_loaded': rl_agent.dqn_model is not None,
        'training_episodes': rl_agent.training_stats['episodes'],
        'timestamp': datetime.now().isoformat()
    })

@app.route('/action', methods=['POST'])
def get_optimal_action():
    """Get optimal power distribution action"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No system state provided'}), 400
        
        # Get optimal action from RL agent
        result = rl_agent.get_optimal_action(data)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Action endpoint error: {e}")
        return jsonify({
            'error': 'Action generation failed',
            'message': str(e),
            'fallback': rl_agent.fallback_action(data if 'data' in locals() else {})
        }), 500

@app.route('/train', methods=['POST'])
def train_agent():
    """Train the RL agent with provided data"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No training data provided'}), 400
        
        # Train the agent
        result = rl_agent.train_episode(data)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Training endpoint error: {e}")
        return jsonify({'error': 'Training failed', 'message': str(e)}), 500

@app.route('/stats', methods=['GET'])
def get_training_stats():
    """Get training statistics"""
    try:
        stats = rl_agent.training_stats.copy()
        stats['epsilon'] = rl_agent.epsilon
        stats['memory_size'] = len(rl_agent.memory)
        stats['model_type'] = 'DQN' if TENSORFLOW_AVAILABLE and rl_agent.dqn_model else 'Q-table'
        
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Stats endpoint error: {e}")
        return jsonify({'error': 'Failed to get stats', 'message': str(e)}), 500

@app.route('/save_models', methods=['POST'])
def save_models():
    """Save trained models"""
    try:
        rl_agent.save_models()
        return jsonify({
            'status': 'models_saved',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Save models error: {e}")
        return jsonify({'error': 'Failed to save models', 'message': str(e)}), 500

@app.route('/reset', methods=['POST'])
def reset_agent():
    """Reset the RL agent (clear memory and reset exploration)"""
    try:
        rl_agent.memory.clear()
        rl_agent.epsilon = 1.0
        rl_agent.training_stats = {
            'episodes': 0,
            'total_reward': 0,
            'average_reward': 0,
            'last_training': None
        }
        
        return jsonify({
            'status': 'agent_reset',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Reset error: {e}")
        return jsonify({'error': 'Failed to reset agent', 'message': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8001))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting RL Optimization Service on port {port}")
    logger.info(f"TensorFlow available: {TENSORFLOW_AVAILABLE}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)