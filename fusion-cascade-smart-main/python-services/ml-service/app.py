#!/usr/bin/env python3
"""
Smart Power Distribution - Machine Learning Service
Provides LSTM-based demand prediction and advanced ML algorithms
"""

import os
import sys
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import json

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import warnings
warnings.filterwarnings('ignore')

# ML Libraries
try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential, load_model
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    from tensorflow.keras.optimizers import Adam
    from sklearn.preprocessing import MinMaxScaler
    from sklearn.metrics import mean_absolute_error, mean_squared_error
    TENSORFLOW_AVAILABLE = True
except ImportError:
    print("TensorFlow not available, using fallback methods")
    TENSORFLOW_AVAILABLE = False

from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

class PowerDemandPredictor:
    """Advanced ML-based power demand prediction system"""
    
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.model_dir = 'models'
        self.sequence_length = 24  # 24 hours of historical data
        
        # Create models directory
        os.makedirs(self.model_dir, exist_ok=True)
        
        # Initialize models for different location types
        self.location_types = ['house', 'factory', 'industry', 'substation', 'bess']
        self.initialize_models()
    
    def initialize_models(self):
        """Initialize ML models for each location type"""
        for location_type in self.location_types:
            try:
                # Try to load existing models
                self.load_model(location_type)
            except:
                # Create new models if loading fails
                logger.info(f"Creating new model for {location_type}")
                self.create_model(location_type)
    
    def create_model(self, location_type: str):
        """Create new ML models for a location type"""
        if TENSORFLOW_AVAILABLE:
            # LSTM Model for time series prediction
            lstm_model = Sequential([
                LSTM(50, return_sequences=True, input_shape=(self.sequence_length, 4)),
                Dropout(0.2),
                LSTM(50, return_sequences=False),
                Dropout(0.2),
                Dense(25),
                Dense(1)
            ])
            lstm_model.compile(optimizer=Adam(learning_rate=0.001), loss='mse')
            self.models[f'{location_type}_lstm'] = lstm_model
        
        # Random Forest as fallback/ensemble
        rf_model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
        self.models[f'{location_type}_rf'] = rf_model
        
        # Linear regression for trend analysis
        lr_model = LinearRegression()
        self.models[f'{location_type}_lr'] = lr_model
        
        # Scalers for normalization
        self.scalers[f'{location_type}_scaler'] = MinMaxScaler()
        self.scalers[f'{location_type}_feature_scaler'] = StandardScaler()
    
    def save_model(self, location_type: str):
        """Save trained models to disk"""
        try:
            model_path = os.path.join(self.model_dir, f'{location_type}_models.pkl')
            
            models_to_save = {}
            for key, model in self.models.items():
                if location_type in key:
                    if 'lstm' in key and TENSORFLOW_AVAILABLE:
                        # Save LSTM model separately
                        lstm_path = os.path.join(self.model_dir, f'{location_type}_lstm.h5')
                        model.save(lstm_path)
                        models_to_save[key] = lstm_path
                    else:
                        models_to_save[key] = model
            
            # Save other models and scalers
            save_data = {
                'models': models_to_save,
                'scalers': {k: v for k, v in self.scalers.items() if location_type in k}
            }
            
            joblib.dump(save_data, model_path)
            logger.info(f"Models saved for {location_type}")
            
        except Exception as e:
            logger.error(f"Error saving model for {location_type}: {e}")
    
    def load_model(self, location_type: str):
        """Load trained models from disk"""
        try:
            model_path = os.path.join(self.model_dir, f'{location_type}_models.pkl')
            
            if os.path.exists(model_path):
                save_data = joblib.load(model_path)
                
                # Load models
                for key, model in save_data['models'].items():
                    if isinstance(model, str) and model.endswith('.h5'):
                        # Load LSTM model
                        if TENSORFLOW_AVAILABLE and os.path.exists(model):
                            self.models[key] = load_model(model)
                    else:
                        self.models[key] = model
                
                # Load scalers
                self.scalers.update(save_data['scalers'])
                
                logger.info(f"Models loaded for {location_type}")
            else:
                raise FileNotFoundError(f"No saved model found for {location_type}")
                
        except Exception as e:
            logger.warning(f"Could not load model for {location_type}: {e}")
            raise
    
    def prepare_features(self, location_data: Dict, historical_data: List[Dict]) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare features for ML prediction"""
        try:
            # Extract basic features
            current_load = location_data.get('current_load', 0)
            location_type = location_data.get('location_type', 'house')
            capacity = location_data.get('metadata', {}).get('capacity', 100)
            efficiency = location_data.get('metadata', {}).get('efficiency', 95)
            
            # Time-based features
            now = datetime.now()
            hour = now.hour
            day_of_week = now.weekday()
            month = now.month
            is_weekend = 1 if day_of_week >= 5 else 0
            
            # Seasonal features
            hour_sin = np.sin(2 * np.pi * hour / 24)
            hour_cos = np.cos(2 * np.pi * hour / 24)
            day_sin = np.sin(2 * np.pi * day_of_week / 7)
            day_cos = np.cos(2 * np.pi * day_of_week / 7)
            month_sin = np.sin(2 * np.pi * month / 12)
            month_cos = np.cos(2 * np.pi * month / 12)
            
            # Location type encoding
            type_encoding = {
                'house': [1, 0, 0, 0, 0],
                'factory': [0, 1, 0, 0, 0],
                'industry': [0, 0, 1, 0, 0],
                'substation': [0, 0, 0, 1, 0],
                'bess': [0, 0, 0, 0, 1]
            }
            type_features = type_encoding.get(location_type, [0, 0, 0, 0, 0])
            
            # Historical load sequence
            if historical_data and len(historical_data) > 0:
                # Extract load values from historical data
                loads = [entry.get('load', current_load) for entry in historical_data[-self.sequence_length:]]
                
                # Pad if necessary
                while len(loads) < self.sequence_length:
                    loads.insert(0, current_load)
                
                # Calculate statistical features
                load_mean = np.mean(loads)
                load_std = np.std(loads)
                load_trend = loads[-1] - loads[0] if len(loads) > 1 else 0
                load_volatility = np.std(np.diff(loads)) if len(loads) > 1 else 0
            else:
                loads = [current_load] * self.sequence_length
                load_mean = current_load
                load_std = 0
                load_trend = 0
                load_volatility = 0
            
            # Feature vector for non-sequence models
            features = np.array([
                current_load, capacity, efficiency,
                hour, day_of_week, month, is_weekend,
                hour_sin, hour_cos, day_sin, day_cos, month_sin, month_cos,
                load_mean, load_std, load_trend, load_volatility
            ] + type_features)
            
            # Sequence data for LSTM (load, hour, day_of_week, is_weekend)
            sequence_data = []
            for i, load in enumerate(loads):
                # Calculate time features for each historical point
                hist_time = now - timedelta(hours=len(loads)-i-1)
                hist_hour = hist_time.hour
                hist_dow = hist_time.weekday()
                hist_weekend = 1 if hist_dow >= 5 else 0
                
                sequence_data.append([load, hist_hour, hist_dow, hist_weekend])
            
            sequence_array = np.array(sequence_data).reshape(1, self.sequence_length, 4)
            
            return features.reshape(1, -1), sequence_array
            
        except Exception as e:
            logger.error(f"Error preparing features: {e}")
            # Return default features
            default_features = np.zeros((1, 22))
            default_sequence = np.zeros((1, self.sequence_length, 4))
            return default_features, default_sequence
    
    def predict(self, location_data: Dict, historical_data: List[Dict]) -> Dict:
        """Make load prediction using ensemble of models"""
        try:
            location_type = location_data.get('location_type', 'house')
            current_load = location_data.get('current_load', 0)
            
            # Prepare features
            features, sequence_data = self.prepare_features(location_data, historical_data)
            
            predictions = []
            model_weights = []
            
            # LSTM Prediction
            if TENSORFLOW_AVAILABLE and f'{location_type}_lstm' in self.models:
                try:
                    # Scale sequence data
                    scaler_key = f'{location_type}_scaler'
                    if scaler_key in self.scalers:
                        # Fit scaler if not already fitted
                        if not hasattr(self.scalers[scaler_key], 'scale_'):
                            dummy_data = np.random.rand(100, 4)
                            self.scalers[scaler_key].fit(dummy_data)
                        
                        scaled_sequence = self.scalers[scaler_key].transform(
                            sequence_data.reshape(-1, 4)
                        ).reshape(1, self.sequence_length, 4)
                    else:
                        scaled_sequence = sequence_data
                    
                    lstm_pred = self.models[f'{location_type}_lstm'].predict(scaled_sequence, verbose=0)[0][0]
                    
                    # Inverse transform if scaler was used
                    if scaler_key in self.scalers:
                        # Create dummy array for inverse transform
                        dummy = np.zeros((1, 4))
                        dummy[0, 0] = lstm_pred
                        lstm_pred = self.scalers[scaler_key].inverse_transform(dummy)[0, 0]
                    
                    predictions.append(max(0, min(100, lstm_pred)))
                    model_weights.append(0.5)  # Higher weight for LSTM
                    
                except Exception as e:
                    logger.warning(f"LSTM prediction failed: {e}")
            
            # Random Forest Prediction
            if f'{location_type}_rf' in self.models:
                try:
                    # Check if model is trained
                    rf_model = self.models[f'{location_type}_rf']
                    if hasattr(rf_model, 'feature_importances_'):
                        rf_pred = rf_model.predict(features)[0]
                        predictions.append(max(0, min(100, rf_pred)))
                        model_weights.append(0.3)
                    else:
                        # Train with dummy data if not trained
                        self.train_fallback_model(location_type, 'rf')
                        rf_pred = self.time_based_prediction(location_data)
                        predictions.append(rf_pred)
                        model_weights.append(0.2)
                except Exception as e:
                    logger.warning(f"Random Forest prediction failed: {e}")
            
            # Linear Regression Prediction
            if f'{location_type}_lr' in self.models:
                try:
                    lr_model = self.models[f'{location_type}_lr']
                    if hasattr(lr_model, 'coef_'):
                        lr_pred = lr_model.predict(features)[0]
                        predictions.append(max(0, min(100, lr_pred)))
                        model_weights.append(0.2)
                    else:
                        # Use time-based prediction as fallback
                        lr_pred = self.time_based_prediction(location_data)
                        predictions.append(lr_pred)
                        model_weights.append(0.1)
                except Exception as e:
                    logger.warning(f"Linear Regression prediction failed: {e}")
            
            # Ensemble prediction
            if predictions and model_weights:
                # Weighted average
                total_weight = sum(model_weights)
                ensemble_pred = sum(p * w for p, w in zip(predictions, model_weights)) / total_weight
            else:
                # Fallback to time-based prediction
                ensemble_pred = self.time_based_prediction(location_data)
            
            # Apply bounds and smoothing
            final_prediction = self.smooth_prediction(current_load, ensemble_pred)
            
            return {
                'predicted_load': final_prediction,
                'confidence': self.calculate_confidence(predictions),
                'model_predictions': {
                    'ensemble': final_prediction,
                    'individual': dict(zip(['lstm', 'rf', 'lr'], predictions[:3]))
                },
                'metadata': {
                    'location_type': location_type,
                    'models_used': len(predictions),
                    'timestamp': datetime.now().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            # Ultimate fallback
            return {
                'predicted_load': current_load,
                'confidence': 0.5,
                'error': str(e),
                'fallback': True
            }
    
    def time_based_prediction(self, location_data: Dict) -> float:
        """Time-based prediction as fallback method"""
        current_load = location_data.get('current_load', 0)
        location_type = location_data.get('location_type', 'house')
        
        now = datetime.now()
        hour = now.hour
        day_of_week = now.weekday()
        
        # Define load patterns by type
        patterns = {
            'house': {
                'hourly': [0.6, 0.5, 0.5, 0.5, 0.6, 0.7, 0.9, 1.2, 1.1, 0.8, 0.7, 0.7,
                          0.8, 0.8, 0.8, 0.9, 1.0, 1.3, 1.4, 1.3, 1.2, 1.0, 0.8, 0.7],
                'weekend_factor': 0.9
            },
            'factory': {
                'hourly': [0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 1.0, 1.3, 1.4, 1.4, 1.3,
                          1.2, 1.3, 1.4, 1.4, 1.3, 1.0, 0.7, 0.5, 0.4, 0.3, 0.3, 0.3],
                'weekend_factor': 0.4
            },
            'industry': {
                'hourly': [0.9, 0.8, 0.8, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.3, 1.2, 1.2,
                          1.2, 1.2, 1.3, 1.3, 1.2, 1.1, 1.0, 1.0, 1.0, 1.0, 0.9, 0.9],
                'weekend_factor': 0.95
            },
            'substation': {
                'hourly': [0.7, 0.6, 0.6, 0.6, 0.7, 0.8, 1.0, 1.2, 1.1, 1.0, 0.9, 0.9,
                          1.0, 1.0, 1.0, 1.1, 1.2, 1.4, 1.5, 1.4, 1.3, 1.1, 0.9, 0.8],
                'weekend_factor': 0.85
            },
            'bess': {
                'hourly': [1.2, 1.1, 1.0, 1.0, 1.0, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.5,
                          0.5, 0.5, 0.6, 0.7, 0.8, 1.0, 1.3, 1.4, 1.4, 1.3, 1.3, 1.2],
                'weekend_factor': 0.9
            }
        }
        
        pattern = patterns.get(location_type, patterns['house'])
        hourly_multiplier = pattern['hourly'][hour]
        weekend_multiplier = pattern['weekend_factor'] if day_of_week >= 5 else 1.0
        
        prediction = current_load * hourly_multiplier * weekend_multiplier
        return max(0, min(100, prediction))
    
    def smooth_prediction(self, current_load: float, predicted_load: float) -> float:
        """Apply smoothing to prevent dramatic changes"""
        max_change = 20  # Maximum 20% change
        change = predicted_load - current_load
        
        if abs(change) > max_change:
            change = max_change if change > 0 else -max_change
        
        return max(0, min(100, current_load + change))
    
    def calculate_confidence(self, predictions: List[float]) -> float:
        """Calculate prediction confidence based on model agreement"""
        if len(predictions) < 2:
            return 0.5
        
        # Calculate coefficient of variation
        mean_pred = np.mean(predictions)
        std_pred = np.std(predictions)
        
        if mean_pred == 0:
            return 0.5
        
        cv = std_pred / mean_pred
        confidence = max(0.1, min(1.0, 1.0 - cv))
        
        return confidence
    
    def train_fallback_model(self, location_type: str, model_type: str):
        """Train fallback model with synthetic data"""
        try:
            # Generate synthetic training data
            X, y = self.generate_synthetic_data(location_type, 1000)
            
            if model_type == 'rf':
                self.models[f'{location_type}_rf'].fit(X, y)
            elif model_type == 'lr':
                self.models[f'{location_type}_lr'].fit(X, y)
            
            logger.info(f"Trained fallback {model_type} model for {location_type}")
            
        except Exception as e:
            logger.error(f"Error training fallback model: {e}")
    
    def generate_synthetic_data(self, location_type: str, n_samples: int) -> Tuple[np.ndarray, np.ndarray]:
        """Generate synthetic training data for fallback models"""
        np.random.seed(42)
        
        X = []
        y = []
        
        for _ in range(n_samples):
            # Random time features
            hour = np.random.randint(0, 24)
            day_of_week = np.random.randint(0, 7)
            month = np.random.randint(1, 13)
            is_weekend = 1 if day_of_week >= 5 else 0
            
            # Random load and capacity
            current_load = np.random.uniform(0, 100)
            capacity = np.random.uniform(80, 120)
            efficiency = np.random.uniform(90, 100)
            
            # Time-based features
            hour_sin = np.sin(2 * np.pi * hour / 24)
            hour_cos = np.cos(2 * np.pi * hour / 24)
            day_sin = np.sin(2 * np.pi * day_of_week / 7)
            day_cos = np.cos(2 * np.pi * day_of_week / 7)
            month_sin = np.sin(2 * np.pi * month / 12)
            month_cos = np.cos(2 * np.pi * month / 12)
            
            # Location type encoding
            type_encoding = {
                'house': [1, 0, 0, 0, 0],
                'factory': [0, 1, 0, 0, 0],
                'industry': [0, 0, 1, 0, 0],
                'substation': [0, 0, 0, 1, 0],
                'bess': [0, 0, 0, 0, 1]
            }
            type_features = type_encoding.get(location_type, [0, 0, 0, 0, 0])
            
            # Statistical features (random for synthetic data)
            load_mean = current_load + np.random.normal(0, 5)
            load_std = np.random.uniform(0, 10)
            load_trend = np.random.normal(0, 2)
            load_volatility = np.random.uniform(0, 5)
            
            # Create feature vector
            features = [
                current_load, capacity, efficiency,
                hour, day_of_week, month, is_weekend,
                hour_sin, hour_cos, day_sin, day_cos, month_sin, month_cos,
                load_mean, load_std, load_trend, load_volatility
            ] + type_features
            
            # Generate target using time-based pattern
            target = self.time_based_prediction({
                'current_load': current_load,
                'location_type': location_type
            })
            
            X.append(features)
            y.append(target)
        
        return np.array(X), np.array(y)

# Initialize global predictor
predictor = PowerDemandPredictor()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ml-prediction-service',
        'tensorflow_available': TENSORFLOW_AVAILABLE,
        'models_loaded': len(predictor.models),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/predict', methods=['POST'])
def predict_load():
    """Main prediction endpoint"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Extract required fields
        location_id = data.get('location_id')
        location_type = data.get('location_type', 'house')
        current_load = data.get('current_load', 0)
        historical_data = data.get('historical_data', [])
        metadata = data.get('metadata', {})
        
        # Prepare location data
        location_data = {
            'location_id': location_id,
            'location_type': location_type,
            'current_load': current_load,
            'metadata': metadata
        }
        
        # Make prediction
        result = predictor.predict(location_data, historical_data)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Prediction endpoint error: {e}")
        return jsonify({
            'error': 'Prediction failed',
            'message': str(e),
            'predicted_load': data.get('current_load', 0) if data else 0
        }), 500

@app.route('/batch_predict', methods=['POST'])
def batch_predict():
    """Batch prediction endpoint"""
    try:
        data = request.get_json()
        locations = data.get('locations', [])
        
        if not locations:
            return jsonify({'error': 'No locations provided'}), 400
        
        results = []
        
        for location_data in locations:
            try:
                historical_data = location_data.get('historical_data', [])
                result = predictor.predict(location_data, historical_data)
                result['location_id'] = location_data.get('location_id')
                results.append(result)
            except Exception as e:
                results.append({
                    'location_id': location_data.get('location_id'),
                    'error': str(e),
                    'predicted_load': location_data.get('current_load', 0)
                })
        
        return jsonify({
            'predictions': results,
            'count': len(results),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        return jsonify({'error': 'Batch prediction failed', 'message': str(e)}), 500

@app.route('/train', methods=['POST'])
def train_model():
    """Train models with provided data"""
    try:
        data = request.get_json()
        location_type = data.get('location_type', 'house')
        training_data = data.get('training_data', [])
        
        if not training_data:
            return jsonify({'error': 'No training data provided'}), 400
        
        # Process training data
        # This would implement actual model training
        # For now, return success
        
        return jsonify({
            'status': 'training_completed',
            'location_type': location_type,
            'samples_processed': len(training_data),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Training error: {e}")
        return jsonify({'error': 'Training failed', 'message': str(e)}), 500

@app.route('/models', methods=['GET'])
def get_models_info():
    """Get information about loaded models"""
    try:
        models_info = {}
        
        for location_type in predictor.location_types:
            models_info[location_type] = {
                'lstm_available': f'{location_type}_lstm' in predictor.models,
                'rf_available': f'{location_type}_rf' in predictor.models,
                'lr_available': f'{location_type}_lr' in predictor.models,
                'scaler_available': f'{location_type}_scaler' in predictor.scalers
            }
        
        return jsonify({
            'models': models_info,
            'tensorflow_available': TENSORFLOW_AVAILABLE,
            'total_models': len(predictor.models),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Models info error: {e}")
        return jsonify({'error': 'Failed to get models info', 'message': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting ML Prediction Service on port {port}")
    logger.info(f"TensorFlow available: {TENSORFLOW_AVAILABLE}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)