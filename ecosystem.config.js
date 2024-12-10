module.exports = {
    apps: [
      {
        name: "zykli-backend", // Name of the application
        script: "server.js",   // Entry point file for your backend
        instances: 1,          // Number of instances to run (1 for single-threaded)
        exec_mode: "fork",     // Execution mode: "fork" for single instance or "cluster" for multi-instance
        watch: true,           // Enable file watching to auto-restart on changes
        env: {
          NODE_ENV: "production", // Default environment variables for production
          PORT: process.env.PORT || 5000, // Use PORT from the environment, default to 5000
          JWT_SECRET: process.env.JWT_SECRET || "common_jwt_secret", // JWT Secret for auth
          DB_HOST: process.env.DB_HOST || "localhost", // DB host
          DB_USER: process.env.DB_USER || "root", // DB user
          DB_PASSWORD: process.env.DB_PASSWORD || "admin", // DB password
          DB_NAME: process.env.DB_NAME || "url_shortener" // DB name
        },
        env_development: {
          NODE_ENV: "development", // Environment variables for local development
          PORT: process.env.PORT || 5000,
          JWT_SECRET: process.env.JWT_SECRET || "dev_jwt_secret",
          DB_HOST: process.env.DB_HOST || "localhost",
          DB_USER: process.env.DB_USER || "root",
          DB_PASSWORD: process.env.DB_PASSWORD || "admin",
          DB_NAME: process.env.DB_NAME || "url_shortener"
        },
        env_production: {
          NODE_ENV: "production", // Environment variables for production
          PORT: process.env.PORT || 5000,
          JWT_SECRET: process.env.JWT_SECRET || "prod_jwt_secret",
          DB_HOST: process.env.DB_HOST || "localhost",
          DB_USER: process.env.DB_USER || "admin_zyk",
          DB_PASSWORD: process.env.DB_PASSWORD || "aruns777389@AKL",
          DB_NAME: process.env.DB_NAME || "admin_zyk"
        }
      }
    ]
  };
  