const path = require('path');
const {execSync} = require('child_process');
const http = require('http');
const puppeteer = require('puppeteer-core');
const serveHandler = require('serve-handler');
const portfinder = require('portfinder');
const times = require('lodash/times');
const takeScreenshot = require('./take-screenshot');
const logger = require('./logger');

const IGNORE_LOG_MESSAGES = [
    'Download the React DevTools for a better development experience',
];

const PAGE_WAIT_INCREMENTS_MS = 500;
const MAX_PAGE_WAIT_MS = 30 * 1000;

// Keep trying `thingToTry` until it resolves the promise, for a max of maxDuration
const tryIncrementally = (thingToTry, incrementDuration, maxDuration) => {
    const getWaitingPromise = () => new Promise((resolve) => setTimeout(resolve, incrementDuration));

    let fullPromise = getWaitingPromise().then(thingToTry);

    for (let timeElapsed = incrementDuration; timeElapsed <= maxDuration; timeElapsed += incrementDuration) {
        fullPromise = fullPromise.catch(() => getWaitingPromise().then(thingToTry));
    }

    return fullPromise;
};

module.exports = async function setupPuppeteer(config) {
    const {
        chromeExecutablePath,
        concurrentLimit,
        testRunnerHtml,
    } = config;

    logger.info(`Attempting to set up Puppeteer with ${concurrentLimit} pages...`);

    const port = await portfinder.getPortPromise({port: 9009});

    logger.info(`Setting up server on port ${port}`);

    // If the user supplied a testRunnerHtml via config, run in their cwd
    const serveHandlerOptions = {public: testRunnerHtml ? process.cwd() : path.join(__dirname, '..', '..')};
    const server = http.createServer((req, res) => serveHandler(req, res, serveHandlerOptions));

    await new Promise((resolve) => void server.listen(port, resolve));

    const puppeteerOptions = {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: chromeExecutablePath || execSync('which google-chrome-beta')
            .toString()
            .replace('\n', ''),
    };

    const browsers = await Promise.all(times(Math.max(1, concurrentLimit), () => puppeteer.launch(puppeteerOptions)));
    const pages = await Promise.all(browsers.map((browser) => browser.newPage()));
    let anyPageHasError = false;

    pages.forEach((page) => {
        page.on('console', (msg) => {
            const messageText = msg.text();
            const messageContainsAnyIgnoreString = IGNORE_LOG_MESSAGES
                .some((ignoreMessageContaining) => messageText.includes(ignoreMessageContaining));

            if (!messageContainsAnyIgnoreString) {
                logger.info(` > ${messageText}`);
            }
        });
        page.on('pageerror', (err) => {
            logger.error(err);
            anyPageHasError = true;
        });
    });

    // For each of our pages, expose relevant functions to the page and then send them to the runner.html
    await Promise.all(pages.map((page) => (
        // Expose all functions to the page in parallel
        Promise.all([
            page.exposeFunction('takeScreenshot', async ({
                targetRect,
                screenshotOutputPath,
            }) => {
                const {x, y, width, height} = targetRect;
                const clip = {
                    x: Math.max(0, x),
                    y: Math.max(0, y),
                    width: Math.max(Math.min(page.viewport().width, width), 1),
                    height: Math.max(Math.min(page.viewport().height, height), 1),
                };

                await takeScreenshot({
                    screenshotOutputPath,
                    clip,
                    page,
                });
            }),

            page.exposeFunction('resetMouse', async () => {
                await page.mouse.move(0, 0);
            }),
            page.exposeFunction('puppeteerHover', async (selector) => {
                await page.hover(selector);
            }),
            page.exposeFunction('puppeteerClick', async (selector) => {
                await page.click(selector);
            }),
        ])
            // Try to go to that page every PAGE_WAIT_INCREMENTS_MS (it takes some time for the server to actually be up)
            .then(() => tryIncrementally(
                () => page.goto(`http://localhost:${port}/${testRunnerHtml || 'bin/runner.html'}`),
                PAGE_WAIT_INCREMENTS_MS,
                MAX_PAGE_WAIT_MS
            ))
            .then(() => page.waitForFunction(() => !!window._registerTests))
            .then(async () => {
                if (anyPageHasError) {
                    throw new Error(
                        'Errors occured when puppeteer was loading the test file, please see above logs.'
                    );
                }
            })
    )));

    logger.info('Puppeteer setup complete');

    return {pages, browsers, server};
};
