const Joi = require('joi');

// Location validation schemas
const locationSchemas = {
  create: Joi.object({
    id: Joi.string().required().min(1).max(50),
    name: Joi.string().required().min(1).max(100),
    type: Joi.string().required().valid('house', 'factory', 'industry', 'substation', 'bess'),
    latitude: Joi.number().required().min(-90).max(90),
    longitude: Joi.number().required().min(-180).max(180),
    currentLoad: Joi.number().min(0).max(100).default(0),
    predictedLoad: Joi.number().min(0).max(100).default(0),
    capacity: Joi.number().min(0).default(100),
    efficiency: Joi.number().min(0).max(100).default(95),
    voltage: Joi.number().min(0).default(220),
    powerFactor: Joi.number().min(0).max(1).default(0.95),
    connectionStatus: Joi.string().valid('online', 'offline', 'maintenance').default('online'),
    metadata: Joi.object().optional()
  }),
  
  update: Joi.object({
    name: Joi.string().min(1).max(100),
    currentLoad: Joi.number().min(0).max(100),
    predictedLoad: Joi.number().min(0).max(100),
    capacity: Joi.number().min(0),
    efficiency: Joi.number().min(0).max(100),
    voltage: Joi.number().min(0),
    powerFactor: Joi.number().min(0).max(1),
    connectionStatus: Joi.string().valid('online', 'offline', 'maintenance'),
    metadata: Joi.object()
  }).min(1),
  
  updateLoad: Joi.object({
    locationId: Joi.string().required(),
    currentLoad: Joi.number().required().min(0).max(100),
    predictedLoad: Joi.number().min(0).max(100)
  })
};

// Route validation schemas
const routeSchemas = {
  create: Joi.object({
    sourceId: Joi.string().required(),
    destinationId: Joi.string().required(),
    powerFlow: Joi.number().required().min(0),
    priority: Joi.number().min(1).max(10).default(5)
  })
};

// AI Decision validation schemas
const decisionSchemas = {
  create: Joi.object({
    locationId: Joi.string().required(),
    decisionType: Joi.string().required().valid(
      'load_balancing', 'power_rerouting', 'demand_prediction',
      'critical_alert', 'optimization', 'maintenance_schedule', 'emergency_response'
    ),
    severity: Joi.string().valid('info', 'warning', 'critical', 'emergency').default('info'),
    message: Joi.string().max(500),
    action: Joi.string().required().max(1000),
    confidence: Joi.number().min(0).max(100).default(85),
    parameters: Joi.object().optional()
  })
};

// Validation middleware factory
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: errorMessage
      });
    }

    req[property] = value;
    next();
  };
};

// Parameter validation
const validateParams = {
  locationId: Joi.string().required().min(1),
  routeId: Joi.string().required().min(1),
  decisionId: Joi.string().required().min(1)
};

const validateParam = (paramName) => {
  return validate(Joi.object({ [paramName]: validateParams[paramName] }), 'params');
};

// Query validation
const validateQuery = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().valid('name', 'type', 'status', 'severityScore', 'lastUpdated').default('lastUpdated'),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),
  
  filter: Joi.object({
    type: Joi.string().valid('house', 'factory', 'industry', 'substation', 'bess'),
    status: Joi.string().valid('normal', 'warning', 'critical'),
    connectionStatus: Joi.string().valid('online', 'offline', 'maintenance')
  })
};

module.exports = {
  locationSchemas,
  routeSchemas,
  decisionSchemas,
  validate,
  validateParam,
  validateQuery
};