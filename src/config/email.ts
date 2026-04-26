// Create an account at https://www.emailjs.com/
// 1. Create a "Email Service" (e.g. Gmail)
// 2. Create a "Email Template"
//    Template should look like: "Your verification code is: {{otp}}"
// 3. Get your "Public Key" from Account > API Keys

export const EMAILJS_CONFIG = {
  SERVICE_ID: 'YOUR_SERVICE_ID',
  TEMPLATE_ID: 'YOUR_TEMPLATE_ID',
  PUBLIC_KEY: 'YOUR_PUBLIC_KEY',
};
