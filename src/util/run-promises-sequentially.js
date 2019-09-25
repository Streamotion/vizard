
/*
 * Given a list of functions returning promises, runs them all in order and resolves an array of the results
 */
module.exports = function runPromisesSequentially(promisesArray) {
    return promisesArray.reduce((promiseChain, currentTask) => (
        promiseChain.then((chainResults) =>
            currentTask().then((currentResult) =>
                [...chainResults, currentResult]))
    ), Promise.resolve([]));
};
