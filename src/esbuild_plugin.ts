import * as esbuild from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';
import { line_statuses, line_notifications, init_highlighters } from './kakoune_interface';

let originalConsoleLog = console.log;

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

    if (errors.length > 0) {
        console.log('compile errors', errors);

        return;
    }

    let code = outputFiles[0].text;

    let start = now();

    type Position = { fileIndex: number, startLine: number, startCol: number }
    type PositionRange = Position & { endLine, endCol };

    let positionsCovered: (Position | PositionRange)[] = [];
    let fileIndices = {};
    let positionsAvailable: (Position | PositionRange)[] = [];
    let consoleLogs: { contents: any[], position: Position }[] = [];
    let thrownErrors: { message: string, position: Position }[] = [];

    function _IR(ignore, returnThis) {
        return returnThis;
    }
    
    function _IE(startLine, startCol, fileIndex) {
        positionsCovered.push({ fileIndex, startLine, startCol });
    }
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
        originalConsoleLog(...contents);
    }

    global._IR = _IR;
    global._IE = _IE;
    global._IB = _IB;
    global._IFILE_INDEX = _IFILE_INDEX;
    global._IAVAILABLE = _IAVAILABLE;

    originalConsoleLog(code)

    originalConsoleLog(code.length);

    await fs.writeFile('/tmp/kiwi.js', code);

    try {
        Function('require', `
            delete require.cache["/tmp/kiwi.js"];            
            require("/tmp/kiwi.js");
        `)(require)
    } catch (e) {
        thrownErrors.push({ message: e.message, position: positionsCovered[positionsCovered.length - 1] });
        originalConsoleLog(positionsCovered);
        
        originalConsoleLog(e.stack);
    }

    logTime('code run took', start);

    // originalConsoleLog(consoleLogs);
    
    let startTestRuns = now();
    
    let testPositions = [];
    
    testPositions.push({ testIndex: -1, positionsCovered });
    positionsCovered = [];
    
    originalConsoleLog('tests', global.__TESTS);
       
    let fitOnly = global.__TESTS.find(test => test.priority);
    for (let testIndex = 0; testIndex < global.__TESTS.length; testIndex++) {
        let test = global.__TESTS[testIndex];
        if (!fitOnly || test.priority) {
            positionsCovered = [];
            try {
            await test.fn();
            } catch(e) {
                thrownErrors.push({ message: e.message, position: positionsCovered[positionsCovered.length - 1] });
            }
            testPositions.push({ testIndex, positionsCovered });
        }
    }
    
    originalConsoleLog('thrown', thrownErrors, fileIndices[thrownErrors[0].position.fileIndex]);
    
    // originalConsoleLog(testPositions);

    logTime('tests took', startTestRuns);

    let startKakouneOps = now();

    let statuses = {};
    let notifications = {};
    let currentWorkingDir = process.cwd();

    for (let localFile of Object.values(fileIndices) as string[]) {
        let file = path.resolve(currentWorkingDir, localFile);
        statuses[file] = {};
        notifications[file] = {};
    }

    for (let position of positionsCovered) {
        let file = path.resolve(currentWorkingDir, fileIndices[position.fileIndex] || '');
        statuses[file][position.startLine] = 'success';
    }

    for (let log of consoleLogs) {
        let file = path.resolve(currentWorkingDir, fileIndices[log.position.fileIndex] || '');
        notifications[file][log.position.startLine + 1] = { text: log.contents.join(' '), color: 'normal' };
    }
    
    for (let error of thrownErrors) {
        let file = path.resolve(currentWorkingDir, fileIndices[error.position.fileIndex] || '');
        notifications[file][error.position.startLine + 1] = { text: error.message, color: 'error' };
    }

    init_highlighters();

    line_statuses(statuses);

    line_notifications(notifications);

    logTime('Kakoune Ops', startKakouneOps);
}

export let kiwiPlugin = {
    name: 'kiwi-test',
    setup(build) {
        build.onEnd(runTests);
    },
};

