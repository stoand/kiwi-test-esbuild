import * as esbuild from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';

const SOURCEMAP_SPLIT = '//# sourceMappingURL=data:application/json;base64,'

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
    let text = outputFiles[0].text;

    let [code, sourcemap] = text.split(SOURCEMAP_SPLIT);
    console.log(code, '\n');
    console.log(sourcemap);

    console.log('Running ...');
    
    let testSource = `
    `;
    
    Function(testSource)();
}

export let kiwiPlugin = {
    name: 'kiwi-test',
    setup(build) {
        build.onEnd(runTests);
    },
};
