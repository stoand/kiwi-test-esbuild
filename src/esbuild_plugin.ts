import * as esbuild from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';
import sourceMap from 'source-map';

const SOURCE_MAP_SPLIT = '//# sourceMappingURL=data:application/json;base64,'

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

    let [code, sourceMapBase64] = text.split(SOURCE_MAP_SPLIT);

    let offsetsCovered = Function(`
        let __OFFSETS_COVERED = [];
    
        function __INST(start, end, expr = undefined) {
            __OFFSETS_COVERED.push([start, end]);
            return expr;
        }
        
        ${code}
        
        return __OFFSETS_COVERED;
    `)();
    
    let sourceMapBuffer = new Buffer(sourceMapBase64, 'base64');
    let sourceMapJson = sourceMapBuffer.toString('ascii');

    console.log('offsets covered:', offsetsCovered);

    console.log('all instrumented', findInstumentedItems(code));
    
    let sourceMapConsumer = await (new sourceMap.SourceMapConsumer(sourceMapJson as any));
    console.log(sourceMapConsumer);
}

function findInstumentedItems(source) {
    let items = source.matchAll(/__INST\((\d+), (null|\d+)/g);

    let matches = [];
    for (let item of items) {
        let start = Number(item[1]);
        let end = item[2] == 'null' ? null : Number(item[2]);

        matches.push([start, end]);
    }

    return matches;
}

export let kiwiPlugin = {
    name: 'kiwi-test',
    setup(build) {
        build.onEnd(runTests);
    },
};

