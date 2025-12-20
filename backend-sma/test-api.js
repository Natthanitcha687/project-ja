// Simple test script for the SMEC Email Auth API
// Run this after starting the server to test the endpoints

const API_BASE = 'http://localhost:4000';

async function testAPI() {
  console.log('🧪 Testing SMEC Email Auth API...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health check...');
    const health = await fetch(`${API_BASE}/`);
    const healthText = await health.text();
    console.log('✅ Health check:', healthText);

    // Test 2: Customer registration
    console.log('\n2️⃣ Testing customer registration...');
    const customerReg = await fetch(`${API_BASE}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'Customer',
        email: 'testcustomer@example.com',
        phone: '0812345678',
        password: 'password123',
        isConsent: true
      })
    });
    
    if (customerReg.ok) {
      const customerData = await customerReg.json();
      console.log('✅ Customer registered:', customerData.message);
      if (customerData.etherealPreviewUrl) {
        console.log('📧 Ethereal preview URL:', customerData.etherealPreviewUrl);
      }
    } else {
      const error = await customerReg.json();
      console.log('❌ Customer registration failed:', error.message);
    }

    // Test 3: Store registration
    console.log('\n3️⃣ Testing store registration...');
    const storeReg = await fetch(`${API_BASE}/auth/register/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeName: 'Test Store',
        typeStore: 'Retail',
        ownerStore: 'Test Owner',
        email: 'teststore@example.com',
        phone: '0898765432',
        address: '123 Test St, Bangkok',
        timeAvailable: 'Mon-Fri 9:00-18:00',
        password: 'password123',
        isConsent: true
      })
    });
    
    if (storeReg.ok) {
      const storeData = await storeReg.json();
      console.log('✅ Store registered:', storeData.message);
      if (storeData.etherealPreviewUrl) {
        console.log('📧 Ethereal preview URL:', storeData.etherealPreviewUrl);
      }
    } else {
      const error = await storeReg.json();
      console.log('❌ Store registration failed:', error.message);
    }

    // Test 4: Login (will fail without email verification)
    console.log('\n4️⃣ Testing login (should fail without verification)...');
    const login = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testcustomer@example.com',
        password: 'password123'
      })
    });
    
    if (login.ok) {
      const loginData = await login.json();
      console.log('✅ Login successful:', loginData.user.email);
    } else {
      const error = await login.json();
      console.log('❌ Login failed (expected):', error.message);
    }

    console.log('\n🎉 API testing completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Check the Ethereal preview URLs above to see verification emails');
    console.log('2. Click the verification links to activate accounts');
    console.log('3. Try logging in again after verification');
    console.log('4. Test the /auth/me endpoint with a valid JWT token');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the server is running on port 4000');
  }
}

// Run the tests
testAPI();
