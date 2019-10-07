const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const browserify = require('browserify');
const envify = require('envify/custom');
const recursive = require('recursive-readdir');
const logger = require('./logger');

const BUNDLE_NAME = 'vizardTests';

module.exports = async function compileTests({
    testFilePath,
    testFilePattern,
    tmpDir,
}) {
    logger.info('Compiling tests...');

    const testFilePaths = await recursive(testFilePath, [
        (file, stats) => !(stats.isDirectory() || file.endsWith(testFilePattern)),
    ]);
    const bundleOutfilePath = path.join(tmpDir, `${BUNDLE_NAME}.js`);

    await fsExtra.ensureDir(tmpDir);

    logger.debug(`Building test script at ${bundleOutfilePath}`);
    logger.debug('Found test files at:', testFilePaths);

    await new Promise((resolve, reject) => {
        const writeablePipeline = browserify(testFilePaths, {
            standalone: BUNDLE_NAME,
        })
            .transform('babelify')
            .transform(envify({NODE_ENV: process.env.NODE_ENV || 'development'}))
            .bundle()
            .pipe(fs.createWriteStream(bundleOutfilePath));

        writeablePipeline.on('error', (e) => {
            writeablePipeline.end();
            logger.error('Couldn\'t create test bundle', e);
            reject();
        });
        writeablePipeline.on('finish', () => {
            writeablePipeline.end();
            logger.info('Test bundle created');
            resolve();
        });
    });
    logger.info('Compilation complete');
};
