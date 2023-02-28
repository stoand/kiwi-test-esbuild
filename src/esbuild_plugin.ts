import * as esbuild from 'esbuild';

export async function runTests(results: Promise<esbuild.BuildResult>) {
   let { outputFiles } = await results; 
   console.log('outputFiles', outputFiles[0].text);
}
