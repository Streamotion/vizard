const path = require('path');
const fsExtra = require('fs-extra');
const uniqWith = require('lodash/uniqWith');
const isEqual = require('lodash/isEqual');
const xor = require('lodash/xor');
const zip = require('lodash/zip');
const junitReportBuilder = require('junit-report-builder');
const {imgDiff} = require('img-diff-js');
const recursive = require('recursive-readdir');
const compileTests = require('../util/compile-tests');
const clean = require('../util/clean');
const setupPuppeteer = require('../util/setup-puppeteer');
const takeScreenshots = require('../util/take-screenshots');
const getTestsByViewport = require('../util/tests-by-viewport');
const ensureDirs = require('../util/ensure-dirs');
const getScreenshotPath = require('../util/screenshot-path');
const logger = require('../util/logger');

// Gets all permutations of suite/test/viewport
function getAllTestPermutations({
    testsByViewport,
}) {
    return testsByViewport.reduce((curr, {viewportHeight, viewportWidth, tests}) => ([
        ...curr,
        ...tests.map(({testName, suiteName}) => ({testName, suiteName, viewportHeight, viewportWidth})),
    ]), []);
}

async function doAllTestsHaveAGolden({
    config,
    testPermutations,
}) {
    const eachPathExists = await Promise.all(testPermutations.map(async ({testName, suiteName, viewportWidth, viewportHeight}) => (
        await fsExtra.pathExists(getScreenshotPath({
            config,
            isTest: false,
            isDiff: false,
            suiteName,
            testName,
            viewportWidth,
            viewportHeight,
        }))
    )));

    zip(testPermutations, eachPathExists)
        .filter(([, pathExists]) => !pathExists)
        .forEach(([{testName, suiteName, viewportHeight, viewportWidth}]) => {
            logger.info(`Test ${suiteName}/${testName}/${viewportWidth}x${viewportHeight} has no golden screenshot!`);
        });

    return eachPathExists.every(Boolean);
}

async function doAllGoldensHaveATest({
    config,
    testPermutations,
}) {
    const goldenScreenshotsBaseDir = path.join(config.outputPath, 'golden');
    const goldenScreenshotPaths = await recursive(goldenScreenshotsBaseDir, [
        (file, stats) => !(stats.isDirectory() || file.endsWith('.jpeg')),
    ]);

    return goldenScreenshotPaths.every((goldenScreenshotPath) => {
        const [suiteName, testName, dimensions] = goldenScreenshotPath.split(path.sep).slice(-3);
        const [viewportWidth, viewportHeight] = path.basename(dimensions, '.jpeg').split('x');

        const goldenHasTest = testPermutations.some((test) => (
            test.suiteName === suiteName
            && test.testName === testName
            && test.viewportWidth.toString() === viewportWidth.toString()
            && test.viewportHeight.toString() === viewportHeight.toString()
        ));

        if (!goldenHasTest) {
            logger.info(`Golden screenshot at ${goldenScreenshotPath} has no associated test`);
        }

        return goldenHasTest;
    });
}

function areAllTestsUnique({
    testPermutations,
}) {
    const uniqueTests = uniqWith(testPermutations, isEqual);

    const success = uniqueTests.length === testPermutations.length;

    if (!success) {
        xor(uniqueTests, testPermutations).forEach(({testName, suiteName}) => {
            logger.info(`Duplicate test: ${suiteName}/${testName}`);
        });
    }

    return success;
}

async function testScreenshots({
    config,
    testPermutations,
    reportBuilder,
}) {
    const {testReportOutputDir, pixelMatchOptions} = config;
    let testsPassed = true;

    logger.info('Testing screenshots');

    const screenshotsTestSuite = reportBuilder.testSuite().name('Screenshot Equality');

    await Promise.all(testPermutations.map(async ({testName, suiteName, viewportHeight, viewportWidth}) => {
        const testCase = screenshotsTestSuite
            .testCase()
            .className(`${suiteName}/${testName}`)
            .name(`${viewportWidth}x${viewportHeight}`);

        const [testedPath, diffPath, goldenPath] = [{isTest: true}, {isDiff: true}, {isTest: false}]
            .map(({isTest, isDiff}) => getScreenshotPath({
                config,
                isTest,
                isDiff,
                suiteName,
                testName,
                viewportWidth,
                viewportHeight,
            }));
        const {imagesAreSame, diffCount} = await imgDiff({
            actualFilename: testedPath,
            expectedFilename: goldenPath,
            diffFilename: diffPath,
            generateOnlyDiffFile: true,

            options: pixelMatchOptions,
        });

        if (!imagesAreSame) {
            // Record the test as a failure
            testsPassed = false;
            logger.info(`Test ${suiteName}/${testName}/${viewportWidth}x${viewportHeight} differed by ${diffCount} pixels`);
            testCase.failure(`Differed by ${diffCount} pixels`);

            // Save the golden/tested/diff images to the reports directory
            await Promise.all([
                {baseDir: 'diff', originalPath: diffPath},
                {baseDir: 'tested', originalPath: testedPath},
                {baseDir: 'golden', originalPath: goldenPath},
            ].map(async ({baseDir, originalPath}) => {
                const reportOutputPath = path.join(testReportOutputDir, 'failing-screenshots', baseDir, suiteName, testName);

                await fsExtra.ensureDir(reportOutputPath);
                await fsExtra.copy(originalPath, path.join(reportOutputPath, `${viewportWidth}x${viewportHeight}.jpeg`));
            }));

            testCase.errorAttachment(path.resolve(path.join(testReportOutputDir, 'diff', suiteName, testName, `${viewportWidth}x${viewportHeight}.jpeg`)));
        }
    }));

    return testsPassed;
}

module.exports = async function test({
    config,
    skipCompile,
}) {
    const {testReportOutputDir} = config;

    await clean({config, skipCompile});
    if (!skipCompile) {
        await compileTests(config);
    }
    const {browsers, server, pages} = await setupPuppeteer(config);

    let testsPassed = true;
    const reportBuilder = junitReportBuilder.newBuilder();
    const metaTestSuite = reportBuilder.testSuite().name('_Meta');
    const testCaseRunningSuccess = metaTestSuite
        .testCase()
        .name('Screenshots are taken successfully');

    let testsByViewport = [];

    try {
        testsByViewport = await getTestsByViewport({
            pages,
            isTest: true,
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
            isTest: true,
        });
    } catch (e) {
        logger.error('Error interacting with browser', e);

        testCaseRunningSuccess.failure();
        testsPassed = false;
    }

    // We always want to clean up
    await Promise.all(browsers.map((browser) => browser.close()));
    server.stop();

    const testPermutations = getAllTestPermutations({testsByViewport});

    // Don't bother going further if we couldn't properly take screenshots
    if (testsPassed) {
        const testCaseAllTestsHaveGolden = metaTestSuite
            .testCase()
            .name('All tests can be compared against a golden screenshot');

        if (!await doAllTestsHaveAGolden({testPermutations, config})) {
            logger.info('Not all tests have a golden screenshot');
            testsPassed = false;
            testCaseAllTestsHaveGolden.failure();
        }

        const testCaseAllGoldensHaveATest = metaTestSuite
            .testCase()
            .name('All golden screenshots can be compared against a test');

        if (!await doAllGoldensHaveATest({config, testPermutations})) {
            logger.info('Not all golden screenshots have a test');
            testsPassed = false;
            testCaseAllGoldensHaveATest.failure();
        }

        const testCaseAllTestsUnique = metaTestSuite
            .testCase()
            .name('All tests are unique');

        if (!areAllTestsUnique({testPermutations})) {
            logger.info('Not all test cases are unique');
            testsPassed = false;
            testCaseAllTestsUnique.failure();
        }
    }

    // Don't bother testing screenshots if one of these meta tests failed
    if (testsPassed) {
        testsPassed = await testScreenshots({config, testPermutations, reportBuilder});
    }

    logger.info(testsPassed ? 'All tests passed!' : 'At least one test failed');

    // Write the test results
    await fsExtra.ensureDir(testReportOutputDir);
    reportBuilder.writeTo(path.join(testReportOutputDir, 'vizard-report.xml'));
};
