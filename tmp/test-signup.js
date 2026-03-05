const fs = require('fs');
const path = require('path');
const { FormData } = require('undici');
const { fetch } = require('undici');

async function main() {
    const formData = new FormData();
    formData.append('username', `testuser_${Date.now()}`);
    formData.append('password', '12341234');
    formData.append('businessName', 'MyBusiness');
    formData.append('representativeName', 'John Doe');
    formData.append('contact', '01012345678');
    formData.append('email', 'john@example.com');
    formData.append('businessRegNumber', '1234567890');
    formData.append('address', 'Seoul');
    formData.append('country', 'Korea');

    // Create a mock file
    const fileBlob = new Blob(['mock file content'], { type: 'text/plain' });
    formData.append('businessRegistrationDocument', fileBlob, 'doc.txt');

    // Let's call the actual handler directly if we can't fetch to 3000
    // Instead of fetch, let's just create a next Request and pass to the Next.js handler
}
main();
