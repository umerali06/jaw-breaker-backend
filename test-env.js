import dotenv from "dotenv";

// Load environment variables
dotenv.config();

console.log("🔍 Environment Variables Check:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("EMAIL_USER:", process.env.EMAIL_USER ? "✅ SET" : "❌ NOT SET");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "✅ SET" : "❌ NOT SET");
console.log("EMAIL_HOST:", process.env.EMAIL_HOST);
console.log("EMAIL_PORT:", process.env.EMAIL_PORT);
console.log("EMAIL_FROM:", process.env.EMAIL_FROM);

if (process.env.EMAIL_USER) {
  console.log("EMAIL_USER value:", process.env.EMAIL_USER);
}
if (process.env.EMAIL_PASS) {
  console.log("EMAIL_PASS length:", process.env.EMAIL_PASS.length);
}
