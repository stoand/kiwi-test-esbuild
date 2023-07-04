import * as esbuild from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
    line_statuses, line_notifications, init_highlighters, FileStatuses,
    register_full_notifications, FullNotification, add_location_list_command
} from './kakoune_interface';

let originalConsoleLog = console.log;

type Position = { fileIndex: number, startLine: number, startCol: number }
type PositionRange = { fileIndex: number, startLine: number, startCol: number, endLine: number, endCol: number };
type PositionCovered = Position | PositionRange;

type TestResult = { label: string, testIndex: number, positionsCovered: PositionCovered[], error: boolean };

function now() {
    return new Date();
}

function logTime(label: string, start?: Date, end: Date = now()) {
    if (process.env['KIWI_LOG_TIME']) {
        if (start) {
            originalConsoleLog(label, end.getTime() - start.getTime(), 'ms');
        } else {
            originalConsoleLog(label);
        }
    }
}

export async function runTests(results: Promise<esbuild.BuildResult>) {

    let { outputFiles, errors } = await results;

    let start = now();

    let positionsCovered: PositionCovered[] = [];
    let prevPositionsCovered: PositionCovered[] = [];

    let fileIndices = {};
    let positionsAvailable: PositionCovered[] = [];
    let consoleLogs: { contents: any[], position: Position }[] = [];
    let thrownErrors: { message: string, actual?: any, expected?: any, position: Position }[] = [];

    let statuses = {};
    let notifications = {};
    let fullNotifications: FullNotification[] = [];

    let testResults: TestResult[] = [];

    let currentWorkingDir = process.cwd();

    if (errors.length == 0) {
        let code = outputFiles[0].text;
        // Executed after the instrumented expression
        function _IR(nextPos, returnThis) {
            positionsCovered.push(nextPos);
            return returnThis;
        }
        // Executed before the instrumented expression
        function _IE(startLine, startCol, fileIndex) {
            let pos = { fileIndex, startLine, startCol };
            prevPositionsCovered.push(pos);
            return pos;
        }
        // Instrument block
        function _IB(startLine, startCol, endLine, endCol, fileIndex) {
            positionsCovered.push({ fileIndex, startLine, startCol, endLine, endCol });
        }
        function _IFILE_INDEX(fileName: string, index: number) {
            fileIndices[index] = fileName;
        }
        function _IAVAILABLE(fileIndex: number, items: []) {
            for (let item of items) {
                positionsAvailable.push({
                    fileIndex,
                    startLine: item[0], startCol: item[1], endLine: item[2], endCol: item[3]
                })
            }
        }

        console.log = function(...contents) {
            consoleLogs.push({ contents, position: positionsCovered[positionsCovered.length - 1] });
            // originalConsoleLog(...contents);
        }

        global._IR = _IR;
        global._IE = _IE;
        global._IB = _IB;
        global._IFILE_INDEX = _IFILE_INDEX;
        global._IAVAILABLE = _IAVAILABLE;

        // originalConsoleLog(code)

        // originalConsoleLog(code.length);

        let codeInFunc = `
            global.__SETUP = function() {
                ${code}
            }
        `;

        // await fs.writeFile('/tmp/__kiwi.js', codeInFunc);
        await fs.writeFile('/tmp/__kiwi.js', code);

        let preTestError = false;

        function handleError(e: Error & { actual?: string, expected?: string }) {
            // the first level of errors is taken from the prevPositionsCovered
            let position = prevPositionsCovered[prevPositionsCovered.length - 1];

            thrownErrors.push({
                message: e.message, actual: e.actual, expected: e.expected,
                position
            });

            let searchedFiles = { [position.fileIndex]: true };

            // all subsequent errors are taken from positionsCovered
            for (let i = positionsCovered.length - 2; i >= 0; i--) {
                let position = positionsCovered[i];

                if (!searchedFiles[position.fileIndex]) {
                    thrownErrors.push({
                        message: e.message, actual: e.actual, expected: e.expected,
                        position
                    });

                    searchedFiles[position.fileIndex] = true;
                }
            }
        }

        try {
            Function('require', `
            delete require.cache["/tmp/__kiwi.js"];            
            require("/tmp/__kiwi.js");
            `)(require);

            logTime('code load took', start);
        } catch (e) {
            handleError(e);

            preTestError = true;
        }

        let startTestRuns = now();

        testResults.push({ label: '<setup>', testIndex: -1, positionsCovered, error: preTestError });
        positionsCovered = [];

        let fitOnly = global.__TESTS.find(test => test.priority);

        for (let testIndex = 0; testIndex < global.__TESTS.length; testIndex++) {
            let test = global.__TESTS[testIndex];
            if (!fitOnly || test.priority) {
                let error = false;
                try {
                    await test.fn();
                } catch (e) {
                    error = true;

                    handleError(e);
                }
                testResults.push({ label: test.label, testIndex, positionsCovered, error });
                prevPositionsCovered = [];
                positionsCovered = [];
            }
        }

        logTime('tests took', startTestRuns);

    } else {
        let error = errors[0];
        fileIndices[0] = error.location.file;
        thrownErrors.push({
            message: error.text,
            position: { fileIndex: 0, startLine: error.location.line - 1, startCol: error.location.column }
        });
    }

    console.log = originalConsoleLog;

    for (let localFile of Object.values(fileIndices) as string[]) {
        let file = path.resolve(currentWorkingDir, localFile);
        statuses[file] = {};
        notifications[file] = {};
    }

    let startCompute = now();

    computeLineStatuses(statuses, testResults, fileIndices, positionsAvailable);

    logTime('Compute line statuses', startCompute);

    for (let log of consoleLogs) {
        let file = path.resolve(currentWorkingDir, fileIndices[log.position.fileIndex] || '');
        notifications[file][log.position.startLine + 1] = { text: log.contents.join(' '), color: 'normal' };

        let json;

        if (log.contents.length == 1) {
            json = JSON.stringify(log.contents[0], null, 2);
        } else {
            let contents = [];
            for (let content of log.contents) {
                contents.push(content);
            }
            json = JSON.stringify(contents, null, 2);
        }

        fullNotifications.push({ file, line: log.position.startLine + 1, json });
    }

    for (let error of thrownErrors) {
        let file = path.resolve(currentWorkingDir, fileIndices[error.position.fileIndex] || '');
        if (!notifications[file]) {
           notifications[file] = {};
        }
        notifications[file][error.position.startLine + 1] = { text: error.message, color: 'error' };
        statuses[file][error.position.startLine] = 'fail';

        let json;

        if ('expected' in error && 'actual' in error) {
            json = JSON.stringify({ actual: error.actual, expected: error.expected }, null, 2);
        } else {
            json = JSON.stringify(error.message, null, 2);
        }

        fullNotifications.push({ file, line: error.position.startLine + 1, json });
    }
    
    let testLocations = [];
    let failedTestLocations = [];
    let testFilesScan = new Set();
    let nonTestFilesScan = new Set(Object.values(fileIndices));
    
    nonTestFilesScan.delete('');
    nonTestFilesScan.delete('<runtime>');
    nonTestFilesScan.delete('(disabled):util');

    for (let testResult of testResults) {
        if (testResult.testIndex !== -1) {
            let position = testResult.positionsCovered[0];
            let file = fileIndices[position.fileIndex];

            nonTestFilesScan.delete(file);
            testFilesScan.add(file);

            let location = { file, line: position.startLine + 1, message: testResult.label };

            if (testResult.error) {
                failedTestLocations.push(location);
            }
            testLocations.push(location);
        }
    }
    
    let testFiles = [];
    let nonTestFiles = [];
    
    for (let file of testFilesScan) {
        testFiles.push({ file, line: 1, message: '' });
    }
    
    for (let file of nonTestFilesScan) {
        nonTestFiles.push({ file, line: 1, message: '' });
    }

    let startKakouneOps = now();

    init_highlighters();

    add_location_list_command('all-tests', testLocations);
    add_location_list_command('failed-tests', failedTestLocations);
    add_location_list_command('all-test-files', testFiles);
    add_location_list_command('all-covered-non-test-files', nonTestFiles);

    console.log('statuses', statuses);
    

    line_statuses(statuses);

    line_notifications(notifications);

    register_full_notifications(fullNotifications);

    logTime('Kakoune Ops', startKakouneOps);
}

function isRange(pos: Position): pos is PositionRange {
    return 'endCol' in pos;
}

function computeLineStatuses(statuses: FileStatuses, testResults: TestResult[], fileIndices: any,
    positionsAvailable: PositionCovered[]) {

    let currentWorkingDir = process.cwd();

    let filePathCache = {};

    for (let position of positionsAvailable) {
        if (!filePathCache[position.fileIndex]) {
            filePathCache[position.fileIndex] = path.resolve(currentWorkingDir, fileIndices[position.fileIndex] || '');
        }

        if (!statuses[filePathCache[position.fileIndex]]) {
            statuses[filePathCache[position.fileIndex]] = {};
        }
        
        statuses[filePathCache[position.fileIndex]][position.startLine] = 'uncovered';
    }

    let someTestFailed = testResults.find(test => test.error);

    for (let test of testResults) {
        let markAsFailed = (test.testIndex === -1 && someTestFailed) || test.error;

        for (let position of test.positionsCovered) {
            if (!filePathCache[position.fileIndex]) {
                filePathCache[position.fileIndex] = path.resolve(currentWorkingDir, fileIndices[position.fileIndex] || '');
            }
            statuses[filePathCache[position.fileIndex]][position.startLine] = markAsFailed ? 'fail' : 'success';
        }
    }
}

export let kiwiPlugin = {
    name: 'kiwi-test',
    setup(build) {
        build.onEnd(runTests);
    },
};

