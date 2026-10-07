'use strict';

// Owner 2026-10-07: no separate HITNO in the first release, so no build sets EXPO_PUBLIC_URGENT and the app shows no
// HITNO (src/lib/needUrgency.ts urgentBuilt). The HITNO code is kept for a later release; Jest compiles it in so its
// existing tests keep guarding it. Tests of the V1 default delete this variable themselves and restore it afterwards.
process.env.EXPO_PUBLIC_URGENT = '1';
