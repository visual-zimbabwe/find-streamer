// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude android/.gradle from Metro's file watcher to prevent
// ENOENT crashes when Gradle cleans its cache directories.
config.resolver.blockList = [...(config.resolver.blockList || []), /android[\\/]\.gradle[\\/].*/];

module.exports = config;
