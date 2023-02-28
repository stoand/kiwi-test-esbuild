import esbuild from 'esbuild';
import { runTests } from 'kiwi-test-esbuild';

let buildResult = esbuild.build({
    entryPoints: ['./src/tests.ts'],
    write: false,
});

runTests(buildResult);
