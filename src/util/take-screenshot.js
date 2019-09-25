module.exports = async function ({
    screenshotOutputPath,
    clip,
    page,
}) {
    await page.screenshot({
        type: 'jpeg',
        quality: 80,
        path: screenshotOutputPath,
        clip,
        omitBackground: true,
    });
};
