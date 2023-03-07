export function genBenchTests() {
    let items = 10000;

    let src = `
        import React from 'react';
        import { it, xit, fit } from 'kiwi-test-esbuild';
        import { renderToString } from 'react-dom/server';
        
        function doRender() {
            console.log(renderToString(React.createElement('div', null, 'asdf')));
        }
    `;


    for (let i = 0; i < items; i++) {
        src += `
            it('run index ${i}', () => {
                console.log(${i}, React.version);
                doRender();
            });
        `;
    }


    return src;
}
