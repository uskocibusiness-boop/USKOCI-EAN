'use strict';

// Use the library's Jest renderer; no native gesture/worklet runtime exists in Jest.
// Model only the documented completion callback so route/draft tests can dismiss
// a sheet, and the documented footer slot (`footerComponent` rendered through
// `BottomSheetFooter`) so the actions a sheet pins there can be found and pressed.
// The footer is rendered as a component, as the library renders it, so a footer
// function rebuilt on every render is mounted again here just as it is on a phone.
// The shape is the same with or without a footer, so the content is never mounted
// again when one appears (a guard's question, say).
// Dragging, scrolling and animation still require the device check.
const React = require('react');
let official = {};
try {
  official = require('@gorhom/bottom-sheet/mock');
} catch {
  class BaseMock extends React.Component { render() { return null; } }
  official = { default: BaseMock };
}
const NO_POSITION = { value: 0, get: () => 0, set: () => undefined };
class BottomSheet extends (official.default || React.Component) {
  close() { this.props.onClose?.(); }
  render() {
    const Footer = this.props.footerComponent;
    return React.createElement(React.Fragment, null, this.props.children,
      Footer ? React.createElement(Footer, { animatedFooterPosition: NO_POSITION }) : null);
  }
}
const BottomSheetFooter = ({ children }) => children ?? null;
const BottomSheetBackdrop = ({ children }) => children ?? null;
const BottomSheetScrollView = React.forwardRef(({ children, ...props }, ref) =>
  React.createElement(require('react-native').ScrollView, { ...props, ref }, children));
BottomSheetScrollView.displayName = 'BottomSheetScrollView';

const BottomSheetView = React.forwardRef(({ children, ...props }, ref) =>
  React.createElement(require('react-native').View, { ...props, ref }, children));
BottomSheetView.displayName = 'BottomSheetView';

const BottomSheetFlatList = React.forwardRef((props, ref) =>
  React.createElement(require('react-native').FlatList, { ...props, ref }));
BottomSheetFlatList.displayName = 'BottomSheetFlatList';

const ANIMATION_STATUS = { UNDETERMINED: 0, RUNNING: 1, STOPPED: 2, INTERRUPTED: 3 };
const SCROLLABLE_STATUS = { LOCKED: 0, UNLOCKED: 1, UNDETERMINED: 2 };
const SHEET_STATE = { CLOSED: 0, OPENED: 1, EXTENDED: 2, OVER_EXTENDED: 3, FILL_PARENT: 4 };

const useBottomSheetInternal = () => ({
  animatedSheetState: { value: 0 },
  animatedIndex: { value: 0 },
  animatedPosition: { value: 0 },
  animatedDetentsState: { value: { detents: [] } },
  animatedAnimationState: { value: { status: 2 } },
  animatedContentGestureState: { value: 0 },
  animatedHandleGestureState: { value: 0 },
  isInTemporaryPosition: { value: false },
  animatedScrollableStatus: { value: 1 },
});

const useScrollEventsHandlersDefault = () => ({
  handleOnScroll: () => {},
  handleOnBeginDrag: () => {},
  handleOnEndDrag: () => {},
  handleOnMomentumBegin: () => {},
  handleOnMomentumEnd: () => {},
});

module.exports = {
  ...official,
  __esModule: true,
  default: BottomSheet,
  BottomSheet,
  BottomSheetFooter,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
  BottomSheetFlatList,
  ANIMATION_STATUS,
  SCROLLABLE_STATUS,
  SHEET_STATE,
  useBottomSheetInternal,
  useScrollEventsHandlersDefault,
};
