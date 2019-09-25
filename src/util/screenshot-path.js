const path = require('path');

module.exports = function getScreenshotPath({
    config,
    isTest,
    isDiff,
    suiteName,
    testName,
    viewportWidth,
    viewportHeight,
}) {
    const {
        outputPath,
        defaultViewportHeight,
        defaultViewportWidth,
    } = config;

    let baseDir;

    if (isDiff) {
        baseDir = 'diff';
    } else if (isTest) {
        baseDir = 'tested';
    } else {
        baseDir = 'golden';
    }

    return path.join(
        outputPath,
        baseDir,
        suiteName,
        testName,
        `${viewportWidth || defaultViewportWidth}x${viewportHeight || defaultViewportHeight}.jpeg`
    );
};
