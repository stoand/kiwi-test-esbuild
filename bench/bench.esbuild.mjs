import esbuild from 'esbuild';
import { kiwiPlugin } from 'kiwi-test-esbuild/plugin.js';
import { genBenchTests } from './gen_bench_src.mjs';
import fs from 'fs/promises';

async function kiwiTest() {
    await fs.writeFile('generated_tests.js', genBenchTests(), 'utf8');

    let context = await esbuild.context({
        entryPoints: ['./generated_tests.js'],
        bundle: true,
        sourcemap: true,
        sourcesContent: false,
        write: false,
        plugins: [kiwiPlugin],
    });

    await context.watch();
}

kiwiTest();
