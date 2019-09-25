const packageJson = require('../../package.json');

module.exports = function printHelp() {
    console.log(`
${packageJson.name} version ${packageJson.version}
    
Usage:
    ${packageJson.name} help         - Show this message
    ${packageJson.name} compile      - Compile the local test cases
    ${packageJson.name} make-golden  - Make golden screenshots from each of the test cases
             --missing                  - Only take golden screenshots that don't yet exist
             --suite SUITE-1 SUITE-2    - Run specific suites
             --skip-compile             - Don't compile the tests 
    ${packageJson.name} test         - Make golden screenshots and test them against the golden screenshots
`);
};
