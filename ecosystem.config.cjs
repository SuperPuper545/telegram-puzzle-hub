module.exports = {
  apps: [
    {
      name: 'tg-puzzle-hub-backend',
      script: './backend/src/server.js',
      cwd: '/var/www/telegram-puzzle-hub',
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '150M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      time: true,
    },
  ],
};
