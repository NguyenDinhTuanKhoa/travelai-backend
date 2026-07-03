const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TravelAI API',
      version: '1.0.0',
      description: 'API Documentation cho ứng dụng TravelAI - Hệ thống gợi ý du lịch thông minh',
      contact: {
        name: 'TravelAI Team',
        email: 'support@travelai.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5001/api',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['user', 'admin'] },
            avatar: { type: 'string' }
          }
        },
        Destination: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            location: {
              type: 'object',
              properties: {
                city: { type: 'string' },
                country: { type: 'string' },
                coordinates: {
                  type: 'object',
                  properties: {
                    lat: { type: 'number' },
                    lng: { type: 'number' }
                  }
                }
              }
            },
            images: { type: 'array', items: { type: 'string' } },
            category: { type: 'string', enum: ['beach', 'mountain', 'city', 'countryside', 'historical'] },
            priceRange: { type: 'string', enum: ['budget', 'mid-range', 'luxury'] },
            rating: { type: 'number' },
            reviewCount: { type: 'number' },
            amenities: { type: 'array', items: { type: 'string' } },
            activities: { type: 'array', items: { type: 'string' } },
            bestTimeToVisit: { type: 'array', items: { type: 'string' } },
            cuisine: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        },
        Review: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
            destination: { type: 'string' },
            rating: { type: 'number', minimum: 1, maximum: 5 },
            title: { type: 'string' },
            content: { type: 'string' },
            visitDate: { type: 'string', format: 'date' }
          }
        },
        Itinerary: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            user: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            status: { type: 'string', enum: ['planning', 'ongoing', 'completed'] },
            destinations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  destination: { $ref: '#/components/schemas/Destination' },
                  order: { type: 'number' },
                  notes: { type: 'string' },
                  activities: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        },
        Weather: {
          type: 'object',
          properties: {
            temp: { type: 'number' },
            feelsLike: { type: 'number' },
            humidity: { type: 'number' },
            description: { type: 'string' },
            iconUrl: { type: 'string' },
            windSpeed: { type: 'number' },
            cityName: { type: 'string' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' }
          }
        }
      }
    },
    tags: [
      { name: 'Auth', description: 'Xác thực người dùng' },
      { name: 'Users', description: 'Quản lý người dùng' },
      { name: 'Destinations', description: 'Quản lý điểm đến' },
      { name: 'Reviews', description: 'Đánh giá điểm đến' },
      { name: 'Itineraries', description: 'Lịch trình du lịch' },
      { name: 'Saved', description: 'Điểm đến đã lưu' },
      { name: 'AI', description: 'Chatbot AI hỗ trợ' },
      { name: 'Weather', description: 'Thông tin thời tiết' },
      { name: 'Recommendations', description: 'Gợi ý cá nhân hóa' },
      { name: 'Admin', description: 'Quản trị hệ thống' }
    ]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
