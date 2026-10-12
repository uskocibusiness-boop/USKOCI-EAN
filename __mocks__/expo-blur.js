const React = require('react');
const { View } = require('react-native');

const BlurView = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));
BlurView.displayName = 'BlurView';

const BlurTargetView = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));
BlurTargetView.displayName = 'BlurTargetView';

module.exports = {
  BlurView,
  BlurTargetView,
};
