const Joi = require('joi');

// Location update validation schema
const locationUpdateSchema = Joi.object({
  locationId: Joi.string().required().min(1).max(50),
  currentLoad: Joi.number().required().min(0).max(100),
  predictedLoad: Joi.number().optional().min(0).max(100)
});

// Location creation validation schema
const locationCreateSchema = Joi.object({
  id: Joi.string().required().min(1).max(50),
  name: Joi.string().required().min(1).max(100),
  type: Joi.string().required().valid('house', 'factory', 'industry', 'substation', 'bess'),
  latitude: Joi.number().required().min(-90).max(90),
  longitude: Joi.number().required().min(-180).max(180),
  currentLoad: Joi.number().optional().min(0).max(100).default(0),
  predictedLoad: Joi.number().optional().min(0).max(100).default(0),
  capacity: Joi.number().optional().min(1).max(1000).default(100),
  efficiency: Joi.number().optional().min(0).max(100).default(95),
  metadata: Joi.object().optional()
});

// Bulk update validation schema
const bulkUpdateSchema = Joi.object({
  updates: Joi.array().items(locationUpdateSchema).required().min(1).max(100)
});

// Optimization parameters validation schema
const optimizationParamsSchema = Joi.object({
  locationIds: Joi.array().items(Joi.string()).optional(),
  objectives: Joi.array().items(
    Joi.string().valid('minimize_loss', 'balance_load', 'maximize_efficiency', 'minimize_cost')
  ).optional().default(['minimize_loss', 'balance_load']),
  constraints: Joi.object({
    maxAdjustment: Joi.number().optional().min(0).max(50),
    priorityFilter: Joi.number().optional().min(1).max(3),
    timeHorizon: Joi.number().optional().min(1).max(24)
  }).optional().default({}),
  algorithm: Joi.string().optional().valid('greedy', 'linear', 'genetic', 'simulated_annealing').default('greedy')
});

// RL feedback validation schema
const rlFeedbackSchema = Joi.object({
  previousState: Joi.object().required(),
  action: Joi.object().required(),
  currentState: Joi.object().required(),
  reward: Joi.number().optional().default(0),
  metadata: Joi.object().optional()
});

// Scenario validation schema
const scenarioSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  locations: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      type: Joi.string().required().valid('house', 'factory', 'industry', 'substation', 'bess'),
      currentLoad: Joi.number().required().min(0).max(100),
      predictedLoad: Joi.number().optional().min(0).max(100),
      status: Joi.string().optional().valid('normal', 'warning', 'critical'),
      capacity: Joi.number().optional().min(1).max(1000)
    })
  ).required().min(1),
  timeframe: Joi.string().optional().default('1 hour'),
  objectives: Joi.array().items(Joi.string()).optional()
});

// Query parameters validation schemas
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().optional().default('lastUpdated'),
  order: Joi.string().valid('asc', 'desc').default('desc')
});

const filterSchema = Joi.object({
  type: Joi.string().optional().valid('house', 'factory', 'industry', 'substation', 'bess'),
  status: Joi.string().optional().valid('normal', 'warning', 'critical'),
  minLoad: Joi.number().optional().min(0).max(100),
  maxLoad: Joi.number().optional().min(0).max(100),
  minSeverity: Joi.number().optional().min(0).max(100),
  maxSeverity: Joi.number().optional().min(0).max(100)
});

// Validation functions
const validateLocationUpdate = (data) => {
  return locationUpdateSchema.validate(data);
};

const validateLocationCreate = (data) => {
  return locationCreateSchema.validate(data);
};

const validateBulkUpdate = (data) => {
  return bulkUpdateSchema.validate(data);
};

const validateOptimizationParams = (data) => {
  return optimizationParamsSchema.validate(data);
};

const validateRLFeedback = (data) => {
  return rlFeedbackSchema.validate(data);
};

const validateScenario = (data) => {
  return scenarioSchema.validate(data);
};

const validatePagination = (data) => {
  return paginationSchema.validate(data);
};

const validateFilters = (data) => {
  return filterSchema.validate(data);
};

// Custom validation helpers
const validateCoordinates = (latitude, longitude) => {
  const latValid = latitude >= -90 && latitude <= 90;
  const lngValid = longitude >= -180 && longitude <= 180;
  
  return {
    isValid: latValid && lngValid,
    errors: [
      ...(latValid ? [] : ['Latitude must be between -90 and 90']),
      ...(lngValid ? [] : ['Longitude must be between -180 and 180'])
    ]
  };
};

const validateLoadRange = (currentLoad, predictedLoad, capacity = 100) => {
  const errors = [];
  
  if (currentLoad < 0 || currentLoad > capacity) {
    errors.push(`Current load must be between 0 and ${capacity}`);
  }
  
  if (predictedLoad !== undefined && (predictedLoad < 0 || predictedLoad > capacity)) {
    errors.push(`Predicted load must be between 0 and ${capacity}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateTimeRange = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  const errors = [];
  
  if (isNaN(start.getTime())) {
    errors.push('Invalid start time format');
  }
  
  if (isNaN(end.getTime())) {
    errors.push('Invalid end time format');
  }
  
  if (start >= end) {
    errors.push('Start time must be before end time');
  }
  
  const maxRange = 7 * 24 * 60 * 60 * 1000; // 7 days
  if (end - start > maxRange) {
    errors.push('Time range cannot exceed 7 days');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Middleware for request validation
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }))
      });
    }
    
    req.validatedBody = value;
    next();
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Query validation error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }))
      });
    }
    
    req.validatedQuery = value;
    next();
  };
};

// Sanitization helpers
const sanitizeString = (str, maxLength = 255) => {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength);
};

const sanitizeNumber = (num, min = 0, max = 100) => {
  const parsed = parseFloat(num);
  if (isNaN(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
};

const sanitizeLocationData = (data) => {
  return {
    id: sanitizeString(data.id, 50),
    name: sanitizeString(data.name, 100),
    type: ['house', 'factory', 'industry', 'substation', 'bess'].includes(data.type) ? data.type : 'house',
    latitude: sanitizeNumber(data.latitude, -90, 90),
    longitude: sanitizeNumber(data.longitude, -180, 180),
    currentLoad: sanitizeNumber(data.currentLoad, 0, 100),
    predictedLoad: sanitizeNumber(data.predictedLoad, 0, 100),
    capacity: sanitizeNumber(data.capacity, 1, 1000),
    efficiency: sanitizeNumber(data.efficiency, 0, 100)
  };
};

module.exports = {
  // Validation functions
  validateLocationUpdate,
  validateLocationCreate,
  validateBulkUpdate,
  validateOptimizationParams,
  validateRLFeedback,
  validateScenario,
  validatePagination,
  validateFilters,
  
  // Custom validators
  validateCoordinates,
  validateLoadRange,
  validateTimeRange,
  
  // Middleware
  validateRequest,
  validateQuery,
  
  // Sanitization
  sanitizeString,
  sanitizeNumber,
  sanitizeLocationData,
  
  // Schemas (for direct use)
  schemas: {
    locationUpdate: locationUpdateSchema,
    locationCreate: locationCreateSchema,
    bulkUpdate: bulkUpdateSchema,
    optimizationParams: optimizationParamsSchema,
    rlFeedback: rlFeedbackSchema,
    scenario: scenarioSchema,
    pagination: paginationSchema,
    filters: filterSchema
  }
};