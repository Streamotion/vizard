const path = require('path');
const fsExtra = require('fs-extra');

module.exports = async function clean({
    config,
    clearGolden = false,
    skipCompile = false,
}) {
    const {
        tmpDir,
        outputPath,
    } = config;

    if (!skipCompile) {
        await fsExtra.emptyDir(tmpDir);
    }

    await fsExtra.emptyDir(path.join(outputPath, 'tested'));
    await fsExtra.emptyDir(path.join(outputPath, 'diff'));

    if (clearGolden) {
        await fsExtra.emptyDir(path.join(outputPath, 'golden'));
    }
};
