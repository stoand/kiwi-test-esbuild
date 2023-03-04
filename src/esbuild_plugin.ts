import * as esbuild from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';
import { line_statuses, line_notifications, init_highlighters } from './kakoune_interface';

function now() {
    return new Date();
}

// #SPC-runner.log_time
function logTime(label: string, start?: Date, end: Date = now()) {
    if (process.env['KIWI_LOG_TIME']) {
        if (start) {
            console.log(label, end.getTime() - start.getTime(), 'ms');
        } else {
            console.log(label);
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

    function _IE(startLine, startCol, fileIndex, expr) {
        positionsCovered.push({ fileIndex, startLine, startCol });
        return expr;
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

    let originalConsoleLog = console.log;
    console.log = function(...contents) {
        consoleLogs.push({ contents, position: positionsCovered[positionsCovered.length - 1]});
        originalConsoleLog(...contents);
    }

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
        console.log(e.stack);
    }

    logTime('code run took', start);
    
    originalConsoleLog(consoleLogs);

    // console.log(positionsAvailable);

    let startKakouneOps = now();

    let statuses = {};
    let notifications = {};
    let currentWorkingDir = process.cwd();

    for (let position of positionsCovered) {
        let file = path.resolve(currentWorkingDir, fileIndices[position.fileIndex] || '');
        if (statuses[file] === undefined) {
            statuses[file] = {};
        }
        statuses[file][position.startLine] = 'success';
    }
    
    for (let log of consoleLogs) {
        let file = path.resolve(currentWorkingDir, fileIndices[log.position.fileIndex] || '');
        if (notifications[file] === undefined) {
            notifications[file] = {};
        }
        notifications[file][log.position.startLine + 1] = { text: log.contents.join(' '), color: 'normal' };
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

