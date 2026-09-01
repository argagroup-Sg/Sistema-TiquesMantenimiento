const path = require('path');

// Evita que Watchpack intente lstat sobre archivos especiales de Windows
// y emita errores EINVAL durante el escaneo inicial.
module.exports = {
  // Mantener una clave `turbopack` vacía para evitar que Next intente usar Turbopack
  // cuando hay una configuración personalizada de `webpack`.
  turbopack: {},
  // Permitir orígenes de desarrollo en la red local para HMR/dev tools si es necesario
  allowedDevOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.90.87:3000'],
  webpack: (config, { dev }) => {
    if (dev) {
      // No mutamos propiedades internas directamente; construimos un nuevo objeto
      // Usamos glob strings (compatibles con la validación de Webpack)
      config.watchOptions = Object.assign({}, config.watchOptions || {}, {
        // Single RegExp matching the Windows root files we want to ignore and node_modules
        ignored: /(^C:\\(?:DumpStack\.log\.tmp|hiberfil\.sys|pagefile\.sys|swapfile\.sys)$)|node_modules/i,
      });
    }
    return config;
  }
};
