const path = require('node:path')

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'Slidev Studio',
    icon: path.join(__dirname, 'assets', 'studio.ico'),
    // Keep Electron's default RunAsNode capability: the same exe runs Slidev
    // and pnpm. The project and mutable dependencies live outside app.asar.
    extraResource: [
      path.join(__dirname, 'studio-resources'),
      path.join(__dirname, 'node_modules/pnpm'),
    ],
    ignore: [/^\/out(?:\/|$)/, /^\/resources(?:\/|$)/, /^\/studio-resources(?:\/|$)/, /^\/template(?:\/|$)/, /^\/scripts(?:\/|$)/, /pnpm-lock\.yaml$/, /pnpm-workspace\.yaml$/],
  },
  makers: [{ name: '@electron-forge/maker-zip', platforms: ['win32'] }],
}
