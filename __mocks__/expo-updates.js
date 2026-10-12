'use strict';

module.exports = {
  __esModule: true,
  runtimeVersion: 'uskoci-v1-preview-r1',
  channel: 'preview',
  updateId: '12345678-1234-4234-8234-123456789abc',
  isEmbeddedLaunch: true,
  checkForUpdateAsync: async () => ({ isAvailable: false }),
  fetchUpdateAsync: async () => ({ isNew: false }),
  reloadAsync: async () => {},
};
