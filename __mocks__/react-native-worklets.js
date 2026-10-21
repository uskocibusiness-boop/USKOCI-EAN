'use strict';

// Jest has no native UI runtime. Preserve the argument handoff to the RN callback;
// animation timing and single completion are exercised by the owning component tests.
module.exports = {
  scheduleOnRN: (callback, ...args) => callback(...args),
};
