import type { ImageSourcePropType } from 'react-native';

/**
 * USKOČI V3 vizuelni registar
 * Integrisani 3D pinovi za mapu, namenski roboti za stanja dijaloga i ilustracije.
 */

export type MapPinId =
  | 'map-task-open'
  | 'map-task-selected'
  | 'map-worker-available'
  | 'map-worker-selected'
  | 'map-route-start'
  | 'map-route-end'
  | 'map-transport'
  | 'map-tools'
  | 'map-home'
  | 'map-meeting'
  | 'map-garden'
  | 'map-pet';

export type MapPinSpec = {
  id: MapPinId;
  label: string;
  source: ImageSourcePropType;
  anchor: { x: number; y: number };
  widthDp: number;
  heightDp: number;
};

export const MAP_PIN_SPECS: Record<MapPinId, MapPinSpec> = {
  'map-task-open': {
    id: 'map-task-open',
    label: 'Pin — otvoren zadatak',
    source: require('../../../assets/v3/maps/map-task-open.png'),
    anchor: { x: 0.481991, y: 0.988636 },
    widthDp: 36,
    heightDp: 47.25,
  },
  'map-task-selected': {
    id: 'map-task-selected',
    label: 'Pin — izabran zadatak',
    source: require('../../../assets/v3/maps/map-task-selected.png'),
    anchor: { x: 0.486613, y: 0.988636 },
    widthDp: 36,
    heightDp: 47.25,
  },
  'map-worker-available': {
    id: 'map-worker-available',
    label: 'Pin — dostupan pomagač',
    source: require('../../../assets/v3/maps/map-worker-available.png'),
    anchor: { x: 0.483762, y: 0.987692 },
    widthDp: 36,
    heightDp: 47.25,
  },
  'map-worker-selected': {
    id: 'map-worker-selected',
    label: 'Pin — izabran pomagač',
    source: require('../../../assets/v3/maps/map-worker-selected.png'),
    anchor: { x: 0.4827, y: 0.987705 },
    widthDp: 36,
    heightDp: 47.25,
  },
  'map-route-start': {
    id: 'map-route-start',
    label: 'Pin — polazište (A)',
    source: require('../../../assets/v3/maps/map-route-start.png'),
    anchor: { x: 0.481633, y: 0.987667 },
    widthDp: 36,
    heightDp: 47.81,
  },
  'map-route-end': {
    id: 'map-route-end',
    label: 'Pin — odredište (B)',
    source: require('../../../assets/v3/maps/map-route-end.png'),
    anchor: { x: 0.4827, y: 0.987667 },
    widthDp: 36,
    heightDp: 47.25,
  },
  'map-transport': {
    id: 'map-transport',
    label: 'Pin — prevoz',
    source: require('../../../assets/v3/maps/map-transport.png'),
    anchor: { x: 0.483762, y: 0.987692 },
    widthDp: 36,
    heightDp: 47.25,
  },
  'map-tools': {
    id: 'map-tools',
    label: 'Pin — majstorska pomoć',
    source: require('../../../assets/v3/maps/map-tools.png'),
    anchor: { x: 0.481428, y: 0.987692 },
    widthDp: 36,
    heightDp: 47.25,
  },
  'map-home': {
    id: 'map-home',
    label: 'Pin — kućna lokacija',
    source: require('../../../assets/v3/maps/map-home.png'),
    anchor: { x: 0.483417, y: 0.98773 },
    widthDp: 36,
    heightDp: 47.81,
  },
  'map-meeting': {
    id: 'map-meeting',
    label: 'Pin — mesto susreta',
    source: require('../../../assets/v3/maps/map-meeting.png'),
    anchor: { x: 0.483762, y: 0.987705 },
    widthDp: 36,
    heightDp: 47.25,
  },
  'map-garden': {
    id: 'map-garden',
    label: 'Pin — baštenski posao',
    source: require('../../../assets/v3/maps/map-garden.png'),
    anchor: { x: 0.481428, y: 0.987692 },
    widthDp: 36,
    heightDp: 47.25,
  },
  'map-pet': {
    id: 'map-pet',
    label: 'Pin — pomoć za ljubimce',
    source: require('../../../assets/v3/maps/map-pet.png'),
    anchor: { x: 0.481421, y: 0.987692 },
    widthDp: 36,
    heightDp: 47.81,
  },
};

export const ROBOT_ASSETS = {
  needWelcome: require('../../../assets/v3/robots/robot-need-welcome.png'),
  canWelcome: require('../../../assets/v3/robots/robot-can-welcome.png'),
  needClarify: require('../../../assets/v3/robots/robot-need-clarify.png'),
  needThinking: require('../../../assets/v3/robots/robot-need-thinking.png'),
  needVoice: require('../../../assets/v3/robots/robot-need-voice.png'),
  needListening: require('../../../assets/v3/robots/robot-need-listening.png'),
  needNoResults: require('../../../assets/v3/robots/robot-need-no-results.png'),
  needSearch: require('../../../assets/v3/robots/robot-need-search.png'),
  needWriting: require('../../../assets/v3/robots/robot-need-writing.png'),
  needWaiting: require('../../../assets/v3/robots/robot-need-waiting.png'),
  needRetry: require('../../../assets/v3/robots/robot-need-retry.png'),
  needPause: require('../../../assets/v3/robots/robot-need-pause.png'),
  needChooseTime: require('../../../assets/v3/robots/robot-need-choose-time.png'),
  needLocation: require('../../../assets/v3/robots/robot-need-location.png'),
  needPhoto: require('../../../assets/v3/robots/robot-need-photo.png'),
  needUpload: require('../../../assets/v3/robots/robot-need-upload.png'),
  needBudget: require('../../../assets/v3/robots/robot-need-budget.png'),
  needPeople: require('../../../assets/v3/robots/robot-need-people.png'),
  needRoute: require('../../../assets/v3/robots/robot-need-route.png'),
  canReady: require('../../../assets/v3/robots/robot-can-ready.png'),
  canSuccess: require('../../../assets/v3/robots/robot-can-success.png'),
  canOffer: require('../../../assets/v3/robots/robot-can-offer.png'),
  canRadius: require('../../../assets/v3/robots/robot-can-radius.png'),
  canRemote: require('../../../assets/v3/robots/robot-can-remote.png'),
  canSupport: require('../../../assets/v3/robots/robot-can-support.png'),
  canTravel: require('../../../assets/v3/robots/robot-can-travel.png'),
  canCalendar: require('../../../assets/v3/robots/robot-can-calendar.png'),
  canSkills: require('../../../assets/v3/robots/robot-can-skills.png'),
  canTools: require('../../../assets/v3/robots/robot-can-tools.png'),
  canReview: require('../../../assets/v3/robots/robot-can-review.png'),
  duoAgreement: require('../../../assets/v3/robots/robot-duo-agreement.png'),
  duoMessage: require('../../../assets/v3/robots/robot-duo-message.png'),
  duoHelping: require('../../../assets/v3/robots/robot-duo-helping.png'),
  duoPlan: require('../../../assets/v3/robots/robot-duo-plan.png'),
  duoThanks: require('../../../assets/v3/robots/robot-duo-thanks.png'),
  duoWave: require('../../../assets/v3/robots/robot-duo-wave.png'),
} as const;

export const ILLUSTRATION_ASSETS = {
  offlineRetry: require('../../../assets/v3/illustrations/illustration-offline-retry.png'),
  emptyMessages: require('../../../assets/v3/illustrations/illustration-empty-messages.png'),
  profileReady: require('../../../assets/v3/illustrations/illustration-profile-ready.png'),
  scheduledTask: require('../../../assets/v3/illustrations/illustration-scheduled-task.png'),
  twoWayRoute: require('../../../assets/v3/illustrations/illustration-two-way-route.png'),
  nearbyHelp: require('../../../assets/v3/illustrations/illustration-nearby-help.png'),
  flexibleTime: require('../../../assets/v3/illustrations/illustration-flexible-time.png'),
  homeCare: require('../../../assets/v3/illustrations/illustration-home-care.png'),
  localCommunity: require('../../../assets/v3/illustrations/illustration-local-community.png'),
  movingHelp: require('../../../assets/v3/illustrations/illustration-moving-help.png'),
  photoTips: require('../../../assets/v3/illustrations/illustration-photo-tips.png'),
  remoteHelp: require('../../../assets/v3/illustrations/illustration-remote-help.png'),
  safeAgreement: require('../../../assets/v3/illustrations/illustration-safe-agreement.png'),
  taskComplete: require('../../../assets/v3/illustrations/illustration-task-complete.png'),
  waitingReply: require('../../../assets/v3/illustrations/illustration-waiting-reply.png'),
  workRadius: require('../../../assets/v3/illustrations/illustration-work-radius.png'),
} as const;
