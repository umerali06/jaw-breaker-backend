/**
 * Script to switch between development and production environments for the server
 * Usage: node switch-env.js [dev|prod]
 */

const fs = require("fs");
const path = require("path");

// Get the environment from command line arguments
const args = process.argv.slice(2);
const env = args[0]?.toLowerCase();

if (!env || (env !== "dev" && env !== "prod")) {
  console.error("Please specify environment: dev or prod");
  console.log("Usage: node switch-env.js [dev|prod]");
  process.exit(1);
}

// Define source and destination paths
const sourceEnvPath = path.join(__dirname, env === "dev" ? ".env" : ".env.production");
const destEnvPath = path.join(__dirname, ".env");

// Check if source file exists
if (!fs.existsSync(sourceEnvPath)) {
  console.error(`Source environment file ${sourceEnvPath} does not exist`);
  process.exit(1);
}

// Read source file
const envContent = fs.readFileSync(sourceEnvPath, "utf8");

// Write to destination file
fs.writeFileSync(destEnvPath, envContent);

console.log(`Environment switched to ${env === "dev" ? "development" : "production"}`);

// Read and display the environment variables (excluding sensitive values)
const envVars = envContent
  .split("\n")
  .filter(line => line.trim() && !line.startsWith("#"))
  .map(line => {
    const [key, value] = line.split("=");
    // Mask sensitive values
    if (
      key.includes("SECRET") ||
      key.includes("KEY") ||
      key.includes("PASSWORD") ||
      key.includes("URI")
    ) {
      return `${key}=********`;
    }
    return line;
  });

console.log("Environment variables:");
console.log(envVars.join("\n"));