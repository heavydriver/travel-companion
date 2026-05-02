const React = require("react");
const { FlatList } = require("react-native");

const FlashList = React.forwardRef((props, ref) => React.createElement(FlatList, { ...props, ref }));

module.exports = { FlashList };
