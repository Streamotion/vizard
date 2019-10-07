const runPromisesSequentially = require('../util/run-promises-sequentially');

function VizardInstance() {
    this.registeredSuites = [];
    this.registeredTests = [];
    this.currentSuiteName = null;
}

VizardInstance.prototype.registerSuite = function ({suiteName, testCreator, suiteOptions = {}}) {
    this.registeredSuites.push({suiteName, testCreator, suiteOptions});
};

VizardInstance.prototype.registerAllTests = function () {
    this.registeredSuites.forEach(({testCreator, suiteName}) => {
        // Attach the current suite name to the class so when we call `it` we can work out which test we're under
        this.currentSuiteName = suiteName;

        // Calls the function which will do a bunch of `test('foo', function () {...});
        testCreator();
    });
};

VizardInstance.prototype.registerTestCase = function ({testName, testRunner, testOptions = {}}) {
    this.registeredTests.push({testName, testRunner, suiteName: this.currentSuiteName, testOptions});
};

// Customise those props to run, for example, every 10th tests starting at test 5
// This helps if you want to run tests in parallel
VizardInstance.prototype.runTests = async function ({
    tests,
} = {}) {
    const vizardTargetRoot = document.getElementById('vizardTargetRoot');

    await runPromisesSequentially(tests.map(({screenshotOutputPath, testName, suiteName}) => async () => {
        const hungConsoleWarningTimeout = setTimeout(() => {
            console.log(`${suiteName}/${testName} being slow.`);
        }, 5 * 1000); // This is to call out tests that may be 'hung', which is helpful for debugging

        const target = vizardTargetRoot.appendChild(document.createElement('div'));
        const {testRunner} = this.registeredTests.find((test) => test.testName === testName && test.suiteName === suiteName);

        // Run the test to render something to the viewport
        let screenshotTarget;

        try {
            screenshotTarget = await testRunner(target);
        } catch (e) {
            console.error(`Error running test ${suiteName}/${testName}`, e);
        }

        if (!screenshotTarget) {
            throw new Error(`No screenshot target returned from test ${suiteName}/${testName}. Did you forget to 'return'?`);
        }

        await window.takeScreenshot({targetRect: (screenshotTarget || target).getBoundingClientRect(), screenshotOutputPath});

        vizardTargetRoot.removeChild(target);

        await window.resetMouse();

        clearTimeout(hungConsoleWarningTimeout);
    }));
};

VizardInstance.prototype.reset = function () {
    this.registeredSuites = [];
    this.registeredTests = [];
    this.currentSuiteName = null;
};

module.exports = VizardInstance;
