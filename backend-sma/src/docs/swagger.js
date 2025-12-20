// src/docs/swagger.js
import swaggerJsdoc from 'swagger-jsdoc';

const port = process.env.PORT || 4000;
const serverUrl = process.env.APP_URL || `http://localhost:${port}`;

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      // เดิม: 'SME Auth API' (ไม่บังคับเปลี่ยน แต่เปลี่ยนเพื่อให้ครอบคลุมทั้งระบบ)
      title: 'SME API',
      version: '1.0.0',
      description:
        'เอกสาร API สำหรับ Auth, Store, Warranty, Warranty Item และ Customer',
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        // ===== ของเดิม =====
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },

        // ===== เพิ่มเติมที่ใช้อ้างอิงจริงใน routes =====
        // ใช้โดย warrantyItem.routes.js (PATCH /warranty-items/{itemId})
        WarrantyItemPatchRequest: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'ชื่อสินค้า' },
            model: { type: 'string', description: 'รุ่นสินค้า' },
            serial: { type: 'string', description: 'หมายเลขซีเรียล' },
            purchaseDate: {
              type: 'string',
              format: 'date',
              description: 'YYYY-MM-DD',
            },
            expiryDate: {
              type: 'string',
              format: 'date',
              description: 'YYYY-MM-DD',
            },
            coverageNote: { type: 'string', description: 'เงื่อนไข/หมายเหตุ' },
          },
        },

        // ===== ตัวเลือกเสริม (ไม่บังคับ แต่มีไว้ใช้ซ้ำได้ดี) =====
        ChangePasswordRequest: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 6 },
          },
        },
        StoreProfilePatchRequest: {
          type: 'object',
          properties: {
            storeName: { type: 'string' },
            phone: { type: 'string' },
            address: { type: 'string' },
          },
        },
        CustomerNotePatchRequest: {
          type: 'object',
          required: ['note'],
          properties: {
            note: { type: 'string', maxLength: 2000 },
          },
        },
        WarrantyItemInput: {
          type: 'object',
          required: ['name', 'serial'],
          properties: {
            name: { type: 'string' },
            model: { type: 'string' },
            serial: { type: 'string' },
            purchaseDate: { type: 'string', format: 'date' },
            warrantyMonths: { type: 'integer', minimum: 0 },
            coverageNote: { type: 'string' },
          },
        },
        WarrantyCreateRequest: {
          type: 'object',
          required: ['items'],
          properties: {
            customer: {
              type: 'object',
              properties: {
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                email: { type: 'string', format: 'email' },
                phone: { type: 'string' },
              },
            },
            items: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/WarrantyItemInput' },
            },
          },
        },
      },
    },
  },
  
  apis: ['./src/routes/**/*.js', './src/controllers/**/*.js'],
};

export default swaggerJsdoc(options);
