const noop = () => {}; // eslint-disable-line no-empty-function

const _setup = () => {
    Object.assign(window, {
        resetMouse: noop,
        takeScreenshot: (args) => console.log('Screenshot would be taken with these args', args),
        puppeteerHover: (selector) => console.log('This test involves hovering on this element', document.querySelector(selector)),
        puppeteerClick: (selector) => document.querySelector(selector).click(),
    });

    if (!window._getTests().length) {
        window._registerTests();
    }

    // Clear the target root
    const targetRoot = document.getElementById('vizardTargetRoot');

    while (targetRoot.hasChildNodes()) {
        targetRoot.removeChild(targetRoot.lastChild);
    }
};

const runTest = (suiteName, testName) => {
    _setup();

    const allTests = window._getTests();
    const test = allTests.find((test) => test.suiteName === suiteName && test.testName === testName);

    if (!test) {
        console.warn(`No such test: ${suiteName}/${testName}. Run window._getTests() to see what's available.`);

        return;
    }

    const testTarget = document.getElementById('vizardTargetRoot').appendChild(document.createElement('div'));

    console.log(`Running visualisation ${suiteName}/${testName}`);
    test.testRunner(testTarget)
        .then((elem) => console.log('Screenshot would be taken of this element', elem));
};

module.exports = {
    _setup,
    runTest,
};
