const compileTests = require('../util/compile-tests');
const clean = require('../util/clean');
const setupPuppeteer = require('../util/setup-puppeteer');
const takeScreenshots = require('../util/take-screenshots');
const getTestsByViewport = require('../util/tests-by-viewport');
const ensureDirs = require('../util/ensure-dirs');
const logger = require('../util/logger');

module.exports = async function makeGolden({
    shouldReplaceMissingOnly,
    specificSuiteNames,
    skipCompile,
    config,
}) {
    await clean({
        config,
        skipCompile,
        clearGolden: !!specificSuiteNames && !!shouldReplaceMissingOnly,
    });

    if (!skipCompile) {
        await compileTests(config);
    }

    const {browsers, server, pages} = await setupPuppeteer(config);

    try {
        const testsByViewport = await getTestsByViewport({
            pages,
            shouldReplaceMissingOnly,
            specificSuiteNames,
            isTest: false,
            config,
        });

        await ensureDirs({
            testsByViewport,
            config,
        });

        await takeScreenshots({
            config,
            testsByViewport,
            pages,
            isTest: false,
        });
    } catch (e) {
        logger.error('Error interacting with browser', e);
    }

    // We always want to clean up
    await Promise.all(browsers.map((browser) => browser.close()));
    server.stop();
};
