import * as esbuild from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';
import sourceMap from 'source-map';
import { calcAccumulatedLineLengths, positionFromOffset } from './compute';

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

    let actualSource = `(() => {
  // src/app.ts
  function add(a, b) {
    return a + b;
  }

  // src/tests.ts
  console.log("add result = ", add(2, 3));
})();
    `
    // console.log(code);

    let sourceMapConsumer = new sourceMap.SourceMapConsumer(sourceMapJson as any);

    let accumulatedLineLengths = calcAccumulatedLineLengths(code);

    let originalPositionFromOffset = (offset) => {
        let position = positionFromOffset(offset, accumulatedLineLengths);
        return sourceMapConsumer.originalPositionFor(position);
    }

    let originalPositionForRange = (range) => {
        let start = originalPositionFromOffset(range[0]);
        let end = range[1] == null ? null : originalPositionFromOffset(range[1]);
        return [start, end];
    }

    console.log(code.split('').splice(43).join(''));
    console.log('--------------\n')
    console.log(code)
    // console.log(code.split('').splice(292).join(''));
    // console.log(code.split('').splice(278).join(''));
    
    console.log(originalPositionFromOffset(262))

    // console.log(code);

    // console.log('offsets covered:', offsetsCovered.map(originalPositionForRange));

    // console.log('all instrumented', findInstumentedItems(code));
    // console.log('all instrumented', findInstumentedItems(code).map(originalPositionForRange));

    // for (let i = 1; i < 33; i ++ ) {
    //     console.log(sourceMapConsumer.originalPositionFor({line: i, column: 0}));
    // }
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

