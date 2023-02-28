import esbuild from 'esbuild';
import { kiwiPlugin } from 'kiwi-test-esbuild';

async function kiwiTest() {
    let context = await esbuild.context({
        entryPoints: ['./src/tests.ts'],
        bundle: true,
        sourcemap: true,
        write: false,
        plugins: [kiwiPlugin],
    });

    await context.watch();
}

kiwiTest();
