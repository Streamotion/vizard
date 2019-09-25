const path = require('path');
const fsExtra = require('fs-extra');
const getScreenshotPath = require('./screenshot-path');
const logger = require('./logger');

module.exports = async function ensureDirs({
    testsByViewport,
    config,
}) {
    logger.info('Preparing output directories for screenshots');

    await Promise
        .all(testsByViewport.map(async ({viewportWidth, viewportHeight, tests}) =>
            await Promise.all(tests.map(async ({testName, suiteName}) => await Promise.all([true, false]
                .map((isTest) => getScreenshotPath({
                    config,
                    isTest,
                    suiteName,
                    testName,
                    viewportWidth,
                    viewportHeight,
                }))
                .map(path.dirname)
                .map(async (dirPath) => await fsExtra.ensureDir(dirPath)))))));
};
