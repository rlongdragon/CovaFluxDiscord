module.exports = {
  apps: [
    {
      name: "covaflux-discord",
      cwd: __dirname,
      script: "dist/index.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production"
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      max_restarts: 10,
      restart_delay: 3000
    }
  ]
};
