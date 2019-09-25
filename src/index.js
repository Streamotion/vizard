#!/usr/bin/env node
const args = require('minimist')(process.argv.slice(2));
const printHelp = require('./scripts/help');
const getConfig = require('./util/config');
const makeGolden = require('./scripts/make-golden');
const test = require('./scripts/test');
const compileTests = require('./util/compile-tests');
const logger = require('./util/logger');

async function main() {
    if (args.verbose) {
        logger.level = 'debug';
    } else if (args.silent) {
        logger.level = 'error';
    } else {
        logger.level = 'info';
    }

    switch (args._[0]) {
        case 'make-golden':
            await makeGolden({
                config: await getConfig(),
                shouldReplaceMissingOnly: !!args.missing,
                skipCompile: !!args['skip-compile'],
                specificSuiteNames: args.suite
                    ? process.argv.slice(3).filter((arg) => !arg.startsWith('--'))
                    : null,
            });
            break;

        case 'compile':
            await compileTests(await getConfig());
            break;

        case 'test':
            await test({
                config: await getConfig(),
                skipCompile: !!args['skip-compile'],
            });
            break;

        default:
        case 'help':
            printHelp();
            break;
    }
}

main()
    .catch((e) => {
        console.error(e);
        logger.fatal('Error while running Vizard', e);

        process.exit(1); // eslint-disable-line no-process-exit
    });
