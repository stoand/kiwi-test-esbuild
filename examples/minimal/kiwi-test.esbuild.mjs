import esbuild from 'esbuild';
import { kiwiPlugin } from 'kiwi-test-esbuild/plugin.js';

async function kiwiTest() {
    let context = await esbuild.context({
        entryPoints: ['./src/tests.ts'],
        bundle: true,
        sourcemap: true,
        sourcesContent: false,
        write: false,
        plugins: [kiwiPlugin],
    });

    await context.watch();
}

kiwiTest();
