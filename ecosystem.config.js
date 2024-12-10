const dotenv = require('dotenv');

// Load environment variables based on NODE_ENV
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
} else if (process.env.NODE_ENV === 'development') {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config({ path: '.env' });
}

module.exports = {
  apps: [
    {
      name: "zykli-backend", // Name of the application
      script: "./server.js", // Entry point file for your backend
      instances: 1,          // Number of instances to run
      exec_mode: "fork",     // Execution mode: "fork" for single instance
      watch: false,          // Disable watching files in production
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production', // Use the NODE_ENV from environment variable
        PORT: process.env.PORT || 5000, // Port from environment variable
      },
      env_development: {
        NODE_ENV: "development", // Environment variables for local development
        PORT: process.env.PORT || 5000,
      },
      env_production: {
        NODE_ENV: "production", // Environment variables for production
        PORT: process.env.PORT || 5000,
      }
    }
  ]
};
