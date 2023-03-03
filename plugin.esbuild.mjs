import esbuild from 'esbuild';

esbuild.build({
    entryPoints: ['./src/esbuild_plugin.ts'],
    bundle: true,
    sourcemap: true,
    platform: 'node',
    outfile: './dist/esbuild_plugin.js',
});
