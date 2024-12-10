module.exports = {
    apps: [
      {
        name: "zykli-backend", // Name of the application
        script: "server.js", // Entry point file for your backend
        instances: 1, // Number of instances to run (1 for single-threaded)
        exec_mode: "fork", // Execution mode: "fork" for single instance or "cluster" for multi-instance
        watch: true, // Optional: Enable file watching to auto-restart on changes
        env: {
          NODE_ENV: "production", // Environment variables for production
        },
        env_development: {
          NODE_ENV: "local", // Environment variables for development
        },
      },
    ],
  };
  