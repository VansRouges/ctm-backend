// Test script to verify audit logging functionality
import { createAuditLog } from './utils/auditHelper.js';

// Mock request and response objects
const mockReq = {
  admin: {
    id: 'admin_001',
    username: 'admin',
    email: 'admin@ctm.com'
  },
  ip: '127.0.0.1',
  method: 'POST',
  originalUrl: '/api/v1/test',
  get: (header) => header === 'user-agent' ? 'Test-Agent/1.0' : null,
  connection: { remoteAddress: '127.0.0.1' }
};

const mockRes = {
  statusCode: 200
};

// Test creating an audit log
async function testAuditLog() {
  try {
    console.log('Testing audit log creation...');
    
    const result = await createAuditLog(mockReq, mockRes, {
      action: 'admin_login',
      resourceType: 'auth',
      description: 'Test admin login'
    });

    if (result) {
      console.log('✅ Audit log created successfully:', result._id);
      console.log('Admin:', result.admin);
      console.log('Action:', result.action);
      console.log('Description:', result.description);
    } else {
      console.log('❌ Failed to create audit log');
    }
  } catch (error) {
    console.error('❌ Error testing audit log:', error);
  }
}

export { testAuditLog };