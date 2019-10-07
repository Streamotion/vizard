const path = require('path');
const fsExtra = require('fs-extra');
const logger = require('./logger');

const DEFAULT_CONFIG = {
    chromeExecutablePath: null,
    concurrentLimit: 1,
    defaultViewportWidth: 1024,
    defaultViewportHeight: 1080,
    outputPath: path.join(process.cwd(), 'tmp'),
    testReportOutputDir: path.join(process.cwd(), 'tmp', 'report'),
    testFilePath: process.cwd(),
    testFilePattern: '.viz.js',
    testRunnerHtml: null,
    tmpDir: path.join(__dirname, '..', '..', 'tmp'),
    pixelMatchOptions: {
        threshold: 0,
        includeAA: false,
    },
};

module.exports = async function getConfig() {
    let configJson;

    try {
        const possibleConfigPaths = [
            'vizard.json',
            '.vizardrc',
            '.vizard.js',
            'vizard.js',
        ].map((filename) => path.join(process.cwd(), filename));

        const foundConfigFiles = await Promise.all(
            possibleConfigPaths.map(
                async (possibleConfigPath) => {
                    try {
                        if (/\.js$/.test(possibleConfigPath)) {
                            // If the config is JavaScript, import and evaluate it.
                            return require(possibleConfigPath)(); // eslint-disable-line global-require
                        } else {
                            // If the config is JSON, use it as is.
                            return await fsExtra.readJson(possibleConfigPath);
                        }
                    } catch (error) {
                        return null;
                    }
                }
            )
        )
            // Filter out all the empty/non existent/erroneous ones
            .then((foundConfigFiles) => foundConfigFiles.filter(Boolean));

        if (foundConfigFiles.length > 1) {
            console.warn('Found more than one vizard config file. Taking the first.');
        }

        configJson = foundConfigFiles[0] || {};
    } catch (_) {
        configJson = {};
    }

    const fullConfig = {
        ...DEFAULT_CONFIG,
        ...configJson,
        pixelMatchOptions: {
            ...DEFAULT_CONFIG.pixelMatchOptions,
            ...(configJson.pixelMatchOptions || {}),
        },
    };

    logger.debug('Using config', fullConfig);

    return fullConfig;
};
