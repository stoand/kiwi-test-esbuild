import * as esbuild from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';
import { line_statuses } from './kakoune_interface';

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
    let { outputFiles } = await results;
    let code = outputFiles[0].text;

    let positionsCovered = Function(`
        let __POSITIONS_COVERED = [];
    
        function _I(startLine, startCol, endLine, endCol, file, expr = undefined) {
            __POSITIONS_COVERED.push({file, startLine, startCol, endLine, endCol});
            return expr;
        }
        
        global._I = _I;
        
        return __POSITIONS_COVERED;
    `)();

    console.log(code)

    try {
        eval(code);
    } catch (e) {
        console.log(e.stack);
    }

    let statuses = {};
    let currentWorkingDir = process.cwd();

    for (let position of positionsCovered) {
        let file = path.resolve(currentWorkingDir, position.file);
        if (statuses[file] === undefined) {
            statuses[file] = {};
        }
        statuses[file][position.startLine] = 'success';
    }

    let currentFile = path.resolve(process.cwd(), 'src/app.ts');

    line_statuses(statuses);
}

export let kiwiPlugin = {
    name: 'kiwi-test',
    setup(build) {
        build.onEnd(runTests);
    },
};

