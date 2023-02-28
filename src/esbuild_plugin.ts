import * as esbuild from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as wtf from 'tracing-framework';

global.wtf = wtf;

const SOURCEMAP_SPLIT = '//# sourceMappingURL=data:application/json;base64,'

// https://google.github.io/tracing-framework/instrumenting-code.html#automatic-instrumentation
// note: we await this promise later
const GOOGLE_TRACING_FRAMEWORK = fs.readFile(path.join(__dirname, 'google_tracing_framework.js'), { encoding: 'utf8' });

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
    
    Function(await GOOGLE_TRACING_FRAMEWORK)();
    
    let testSource = `
        WTF.trace.prepare();
    
        function other() {
            console.log("add = ", 1+3);
        }
    
        WTF.trace.start();
        
        other();
        
        let buffer = [];
        
        WTF.trace.snapshot(buffer);
        
        console.log(buffer[0]);
        console.log(buffer[0].buffer_.toString('utf8'));
    `;
    
    Function(testSource)();
}

export let kiwiPlugin = {
    name: 'kiwi-test',
    setup(build) {
        build.onEnd(runTests);
    },
};
