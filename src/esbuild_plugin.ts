import * as esbuild from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';
import { line_statuses, line_notifications, init_highlighters } from './kakoune_interface';

let originalConsoleLog = console.log;

type Position = { fileIndex: number, startLine: number, startCol: number }
type PositionRange = { fileIndex: number, startLine: number, startCol: number, endLine: number, endCol: number };
type PositionCovered = Position | PositionRange;

type TestResult = { testIndex: number, positionsCovered: PositionCovered[], error: boolean };

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

    originalConsoleLog('New run ---------------------');

    let { outputFiles, errors } = await results;

    let start = now();

    let positionsCovered: PositionCovered[] = [];
    let prevPositionsCovered: PositionCovered[] = [];

    let fileIndices = {};
    let positionsAvailable: PositionCovered[] = [];
    let consoleLogs: { contents: any[], position: Position }[] = [];
    let thrownErrors: { message: string, position: Position }[] = [];

    let statuses = {};
    let notifications = {};

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

        await fs.writeFile('/tmp/__kiwi.js', code);

        let preTestError = false;

        try {
            Function('require', `
            delete require.cache["/tmp/__kiwi.js"];            
            require("/tmp/__kiwi.js");
        `)(require)
        } catch (e) {
            thrownErrors.push({ message: e.message, position: prevPositionsCovered[prevPositionsCovered.length - 1] });

            originalConsoleLog(e);
            preTestError = true;
        }

        logTime('code run took', start);

        // originalConsoleLog(consoleLogs);

        let startTestRuns = now();

        testResults.push({ testIndex: -1, positionsCovered, error: preTestError });
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
                    thrownErrors.push({ message: e.message, position: prevPositionsCovered[prevPositionsCovered.length - 1] });
                }
                testResults.push({ testIndex, positionsCovered, error });
                positionsCovered = [];
            }
        }

        logTime('tests took', startTestRuns);

    } else {

        console.error(errors);

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
    
    // TODO optimize
    computeLineStatuses(statuses, testResults, fileIndices, positionsAvailable);
    
    logTime('Compute line statuses', startCompute);

    for (let log of consoleLogs) {
        let file = path.resolve(currentWorkingDir, fileIndices[log.position.fileIndex] || '');
        notifications[file][log.position.startLine + 1] = { text: log.contents.join(' '), color: 'normal' };
    }

    for (let error of thrownErrors) {
        let file = path.resolve(currentWorkingDir, fileIndices[error.position.fileIndex] || '');
        notifications[file][error.position.startLine + 1] = { text: error.message, color: 'error' };
        statuses[file][error.position.startLine] = 'fail';
    }

    let startKakouneOps = now();

    init_highlighters();

    line_statuses(statuses);

    line_notifications(notifications);

    logTime('Kakoune Ops', startKakouneOps);
}

function isRange(pos: Position): pos is PositionRange {
    return 'endCol' in pos;
}

function computeLineStatuses(statuses, testResults: TestResult[], fileIndices, positionsAvailable: PositionCovered[]) {
    let currentWorkingDir = process.cwd();
    
    let inactivePositionScan = {};
    let filePathCache = {};

    let inactivePositionsJSON = new Set();

    for (let position of positionsAvailable) {
        if (!filePathCache[position.fileIndex]) {
           filePathCache[position.fileIndex] = path.resolve(currentWorkingDir, fileIndices[position.fileIndex] || ''); 
        }
        
        statuses[filePathCache[position.fileIndex]][position.startLine] = 'success';
    }
    
    //     for (let i = 0 ; i< 30000; i++)
    // statuses['/home/andreas/kiwi-test-esbuild/bench/generated_tests.js'][i] = 'fail';
    
    
    return;

    let someTestFailed = testResults.find(test => test.error);

    let inactivePositions: PositionCovered[] = [];
    inactivePositionsJSON.forEach((pos: string) => inactivePositions.push(JSON.parse(pos)));

    for (let test of testResults) {
        let markAsFailed = (test.testIndex === -1 && someTestFailed) || test.error;

        for (let position of test.positionsCovered) {
            let file = path.resolve(currentWorkingDir, fileIndices[position.fileIndex] || '');

            if (isRange(position)) {
                for (let line = position.startLine; line <= position.endLine; line++) {
                    let lineInactive = false;

                    for (let inactivePosition of inactivePositions) {
                        if (isRange(inactivePosition)) {
                            if (line >= inactivePosition.startLine && line < inactivePosition.endLine) {
                                lineInactive = true;

                            }
                        }
                        // } else {
                        //     if (line == inactivePosition.startLine) {
                        //         // lineInactive = true;

                        //     }
                        // }
                    }

                    if (!lineInactive) {
                        if (statuses[file][line] !== 'fail') {
                            statuses[file][line] = markAsFailed ? 'fail' : 'success';
                        }
                    } else {
                        // if (statuses[file][line] !== 'fail') {
                        //     statuses[file][line] = 'uncovered';
                        // }

                    }
                }
            } else {
                if (statuses[file][position.startLine] !== 'fail') {
                    statuses[file][position.startLine] = markAsFailed ? 'fail' : 'success';
                }
            }
        }
    }

}

export let kiwiPlugin = {
    name: 'kiwi-test',
    setup(build) {
        build.onEnd(runTests);
    },
};

