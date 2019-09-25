const fsExtra = require('fs-extra');
const flattenDeep = require('lodash/flattenDeep');
const isEqual = require('lodash/isEqual');
const uniqWith = require('lodash/uniqWith');
const getScreenshotPath = require('./screenshot-path');
const logger = require('./logger');

/*
 * Returns an array of objects of the form
 * {
 *     viewportWidth,
 *     viewportHeight,
 *     tests: [{testName, suiteName, options}]
 * }
 */
module.exports = async function getTestsByViewport({
    pages,
    shouldReplaceMissingOnly = false,
    specificSuiteNames = null,
    isTest,
    config,
}) {
    logger.info('Discovering tests and viewports');

    const {
        defaultViewportHeight,
        defaultViewportWidth,
    } = config;

    const defaultTestOptions = {viewportHeights: [defaultViewportHeight], viewportWidths: [defaultViewportWidth]};

    // Register the tests for all the pages we have
    await Promise.all(pages.map((page) => page.evaluate(() => window._registerTests())));

    // The tests are the same across all the pages so we only bother checking page 1 for this
    const [firstPage] = pages;
    const suites = await firstPage.evaluate(() => window._getSuites());
    const tests = await firstPage.evaluate(() => window._getTests());

    // logger.debug('Found suites and tests', JSON.stringify({suites, tests}));

    const suiteNameToOptions = suites.reduce((curr, {suiteName, suiteOptions}) => ({
        ...curr,
        [suiteName]: suiteOptions,
    }), {});

    // logger.debug('suiteNameToOptions', JSON.stringify(suiteNameToOptions));

    const allTestsWithOptions = tests.reduce((curr, {testName, suiteName, testOptions}) => [
        ...curr,
        {
            testName,
            suiteName,
            options: {
                ...defaultTestOptions,
                ...(suiteNameToOptions[suiteName] || {}),
                ...testOptions,
            },
        },
    ], []);

    // logger.debug('allTestsWithOptions', JSON.stringify(allTestsWithOptions));

    const testsToRun = allTestsWithOptions.filter(({testName, suiteName, options: {viewportWidths, viewportHeights}}) => {
        if (isTest) {
            return true;
        } else if (shouldReplaceMissingOnly) {
            return viewportWidths
                .every((viewportWidth) => viewportHeights
                    .every((viewportHeight) => !fsExtra.pathExistsSync(
                        getScreenshotPath({config, isTest, suiteName, testName, viewportWidth, viewportHeight})
                    )));
        } else {
            return specificSuiteNames === null || specificSuiteNames.includes(suiteName);
        }
    })
        .map((test, index) => ({...test, testNumber: index}));

    const allViewports = uniqWith(
        flattenDeep(
            testsToRun.map(({options: {viewportWidths = [defaultViewportWidth], viewportHeights = [defaultViewportHeight]}}) => (
                viewportWidths.map((viewportWidth) => viewportHeights.map((viewportHeight) => ({viewportHeight, viewportWidth})))))
        ),
        isEqual
    );

    // logger.debug('Using viewports', JSON.stringify(allViewports));
    logger.info(`Found ${testsToRun.length} tests to run`);
    // logger.debug(`testsToRun`, JSON.stringify(testsToRun));

    // Tests grouped by viewport
    const testsByViewport = allViewports.map(({viewportWidth, viewportHeight}) => ({
        viewportWidth,
        viewportHeight,
        tests: testsToRun.filter(({options}) => (
            options.viewportHeights.includes(viewportHeight)
            && options.viewportWidths.includes(viewportWidth))),
    }));

    // logger.debug('testsByViewport', JSON.stringify(testsByViewport));

    return testsByViewport;
};
