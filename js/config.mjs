/**
 * Copyright (c) 2025, Kirahi LLC
 * Max Seenisamy kirahi.com
 * 
 * Configuration file for Intrusion Detection System
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Default configuration
const defaultConfig = {
  // Database Configuration
  DB_FILENAME: 'idspatternsdb.db',
  DB_DIRECTORY: '.',
  SERVER_PORT: 9008
};

// Load configuration from .config file if it exists
let config = { ...defaultConfig };

try {
  const configPath = path.join(projectRoot, '.config');
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const lines = configContent.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, value] = trimmedLine.split('=');
        if (key && value) {
          const configKey = key.trim();
          const configValue = value.trim();
          
          // Convert string values to appropriate types
          if (configKey === 'SERVER_PORT') {
            config[configKey] = parseInt(configValue, 10);
          } else {
            config[configKey] = configValue;
          }
        }
      }
    }
  }
} catch (error) {
  console.warn('Warning: Could not load .config file, using defaults:', error.message);
}

// Build database path
let databasePath;
if (config.DB_ABSOLUTE_PATH) {
  databasePath = config.DB_ABSOLUTE_PATH;
} else {
  const dbDir = path.resolve(projectRoot, config.DB_DIRECTORY);
  databasePath = path.join(dbDir, config.DB_FILENAME);
}

// Export configuration
export { config, databasePath };