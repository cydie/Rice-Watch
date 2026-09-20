const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('ricewatch', {
  platform: process.platform,
  isDesktop: true,
});
