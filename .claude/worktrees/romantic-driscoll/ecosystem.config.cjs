module.exports = {
  apps: [
    {
      name: 'nexarr-server',
      cwd: './packages/server',
      script: 'src/server.ts',
      interpreter: 'node',
      interpreter_args: '--experimental-sqlite',
      node_args: '--import tsx/esm',
      env: {
        NODE_ENV: 'development',
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 2000,
    },
    {
      name: 'nexarr-client',
      cwd: './packages/client',
      script: 'node_modules/.bin/vite',
      args: '--port 5173 --strictPort',
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 2000,
    },
  ],
};
