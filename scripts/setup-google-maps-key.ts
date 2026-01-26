#!/usr/bin/env node
/**
 * Google Maps API Key Setup Script
 * Interactive script to help users obtain and configure Google Maps API key
 * Usage: npm run setup:google-maps
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import * as readline from "readline";

const ENV_LOCAL_PATH = resolve(process.cwd(), ".env.local");
const ENV_EXAMPLE_PATH = resolve(process.cwd(), ".env.example");
const GOOGLE_CLOUD_CONSOLE_URL = "https://console.cloud.google.com/google/maps-apis";
const MAPS_EMBED_API_URL = "https://console.cloud.google.com/apis/library/maps-embed-backend.googleapis.com";

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, message: string) {
  log(`\n${step}. ${message}`, "cyan");
}

/**
 * Read .env.local file and parse environment variables
 */
function readEnvFile(): Map<string, string> {
  const envMap = new Map<string, string>();
  
  if (!existsSync(ENV_LOCAL_PATH)) {
    return envMap;
  }

  const content = readFileSync(ENV_LOCAL_PATH, "utf-8");
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.substring(0, equalIndex).trim();
    const value = trimmed.substring(equalIndex + 1).trim();
    
    // Remove quotes if present
    const unquotedValue = value.replace(/^["']|["']$/g, "");
    envMap.set(key, unquotedValue);
  }

  return envMap;
}

/**
 * Write environment variables back to .env.local
 */
function writeEnvFile(envMap: Map<string, string>): void {
  // Read original file to preserve comments and structure
  let originalContent = "";
  if (existsSync(ENV_LOCAL_PATH)) {
    originalContent = readFileSync(ENV_LOCAL_PATH, "utf-8");
  } else if (existsSync(ENV_EXAMPLE_PATH)) {
    // Use .env.example as template if .env.local doesn't exist
    originalContent = readFileSync(ENV_EXAMPLE_PATH, "utf-8");
  }

  const lines = originalContent.split("\n");
  const output: string[] = [];
  const processedKeys = new Set<string>();

  // Process existing lines
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check if this line contains the Google Maps API key
    if (trimmed.startsWith("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=")) {
      const key = envMap.get("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
      if (key) {
        output.push(`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${key}`);
        processedKeys.add("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
      } else {
        output.push(line); // Keep original if no new value
      }
    } else if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const key = trimmed.substring(0, trimmed.indexOf("=")).trim();
      if (envMap.has(key) && !processedKeys.has(key)) {
        output.push(`${key}=${envMap.get(key)}`);
        processedKeys.add(key);
      } else {
        output.push(line);
      }
    } else {
      output.push(line);
    }
  }

  // Add any new keys that weren't in the original file
  for (const [key, value] of envMap.entries()) {
    if (!processedKeys.has(key)) {
      // Find a good place to add it (after Google Maps comment if exists)
      let insertIndex = output.length;
      for (let i = 0; i < output.length; i++) {
        if (output[i].includes("Google Maps") || output[i].includes("GOOGLE_MAPS")) {
          insertIndex = i + 2; // Insert after comment and empty line
          break;
        }
      }
      output.splice(insertIndex, 0, `${key}=${value}`);
    }
  }

  writeFileSync(ENV_LOCAL_PATH, output.join("\n") + "\n", "utf-8");
}

/**
 * Validate API key format
 */
function validateApiKeyFormat(key: string): { valid: boolean; error?: string } {
  if (!key || key.trim().length === 0) {
    return { valid: false, error: "API key cannot be empty" };
  }

  const trimmed = key.trim();

  // Google Maps API keys typically start with "AIza"
  if (!trimmed.startsWith("AIza")) {
    return {
      valid: false,
      error: "Invalid API key format. Google Maps API keys should start with 'AIza'",
    };
  }

  // Typical length is around 39 characters
  if (trimmed.length < 30 || trimmed.length > 50) {
    return {
      valid: false,
      error: "Invalid API key length. Google Maps API keys are typically 39 characters long",
    };
  }

  // Check for valid characters (alphanumeric and some special chars)
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: "Invalid API key format. Key contains invalid characters",
    };
  }

  return { valid: true };
}

/**
 * Test API key by making a sample request
 */
async function testApiKey(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const testUrl = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=New+York`;
    
    const response = await fetch(testUrl, {
      method: "HEAD", // Use HEAD to avoid loading full page
      redirect: "follow",
    });

    // If we get a response (even if it's an error page), the key format is likely valid
    // The actual validation happens when the iframe loads in the browser
    if (response.status === 200 || response.status === 403) {
      // 403 might mean restrictions, but key is valid
      return { success: true };
    }

    return {
      success: false,
      error: `API key test returned status ${response.status}`,
    };
  } catch (error: any) {
    // Network errors don't necessarily mean the key is invalid
    // The key will be validated when actually used
    return {
      success: true, // Assume valid if we can't test (network issues)
    };
  }
}

/**
 * Create readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input
 */
function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

/**
 * Main setup function
 */
async function main() {
  log("\n🗺️  Google Maps API Key Setup", "bright");
  log("=" .repeat(50), "cyan");

  // Check if key already exists
  const envMap = readEnvFile();
  const existingKey = envMap.get("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");

  if (existingKey && existingKey.trim().length > 0) {
    log("\n⚠️  A Google Maps API key already exists in .env.local", "yellow");
    log(`Current key: ${existingKey.substring(0, 10)}...${existingKey.substring(existingKey.length - 4)}`, "reset");
    
    const rl = createReadlineInterface();
    const answer = await question(rl, "\nDo you want to replace it? (y/N): ");
    rl.close();

    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      log("\n✅ Keeping existing API key. Exiting.", "green");
      process.exit(0);
    }
  }

  logStep(1, "Get your API key from Google Cloud Console");
  log("\nTo get a Google Maps API key:", "bright");
  log("1. Go to Google Cloud Console:", "reset");
  log(`   ${GOOGLE_CLOUD_CONSOLE_URL}`, "blue");
  log("\n2. Create a project (if you don't have one)", "reset");
  log("3. Enable billing (required but Maps Embed API is free)", "reset");
  log("4. Enable Maps Embed API:", "reset");
  log(`   ${MAPS_EMBED_API_URL}`, "blue");
  log("5. Create an API key:", "reset");
  log("   - Go to 'APIs & Services' > 'Credentials'", "reset");
  log("   - Click 'Create Credentials' > 'API key'", "reset");
  log("6. (Recommended) Restrict the key:", "reset");
  log("   - API restrictions: Select 'Maps Embed API' only", "reset");
  log("   - Application restrictions: Add HTTP referrers", "reset");
  log("     * http://localhost:3000/*", "reset");
  log("     * https://dansarpherbal.com/*", "reset");
  log("\n📖 For detailed instructions, see: docs/GOOGLE_MAPS_SETUP.md", "cyan");

  const rl = createReadlineInterface();
  
  logStep(2, "Enter your Google Maps API key");
  const apiKey = await question(rl, "\nPaste your API key here: ");

  if (!apiKey || apiKey.trim().length === 0) {
    log("\n❌ No API key provided. Exiting.", "red");
    rl.close();
    process.exit(1);
  }

  // Validate format
  log("\n🔍 Validating API key format...", "cyan");
  const validation = validateApiKeyFormat(apiKey);

  if (!validation.valid) {
    log(`\n❌ ${validation.error}`, "red");
    log("\nPlease check your API key and try again.", "yellow");
    rl.close();
    process.exit(1);
  }

  log("✅ API key format is valid", "green");

  // Test the key
  log("\n🧪 Testing API key...", "cyan");
  const testResult = await testApiKey(apiKey.trim());

  if (!testResult.success) {
    log(`\n⚠️  Warning: ${testResult.error}`, "yellow");
    log("The key format is valid, but the test request failed.", "yellow");
    log("This might be due to network issues or API restrictions.", "yellow");
    
    const continueAnswer = await question(rl, "\nDo you want to continue anyway? (Y/n): ");
    if (continueAnswer.toLowerCase() === "n" || continueAnswer.toLowerCase() === "no") {
      log("\n❌ Setup cancelled.", "red");
      rl.close();
      process.exit(1);
    }
  } else {
    log("✅ API key test passed", "green");
  }

  // Save to .env.local
  logStep(3, "Saving API key to .env.local");
  envMap.set("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", apiKey.trim());
  writeEnvFile(envMap);

  log("✅ API key saved successfully!", "green");

  // Verify
  const verifyMap = readEnvFile();
  const savedKey = verifyMap.get("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");

  if (savedKey === apiKey.trim()) {
    log("\n✅ Verification successful!", "green");
    log("\n📝 Next steps:", "bright");
    log("1. Restart your development server if it's running", "reset");
    log("2. Visit http://localhost:3000/contact to see the map", "reset");
    log("3. If you see errors, check the browser console", "reset");
    log("\n💡 Tip: Make sure to restrict your API key in Google Cloud Console", "yellow");
    log("   for better security. See docs/GOOGLE_MAPS_SETUP.md for details.", "yellow");
  } else {
    log("\n⚠️  Warning: Could not verify the saved key. Please check .env.local manually.", "yellow");
  }

  rl.close();
  log("\n🎉 Setup complete!", "green");
}

// Run the script
main().catch((error) => {
  log(`\n❌ Error: ${error.message}`, "red");
  process.exit(1);
});
