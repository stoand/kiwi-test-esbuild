import { add } from './app';
import { it, xit, fit } from 'kiwi-test-esbuild';

it('can add', () => {
    console.log('add result = ', add(2, 3));
});

it('supports async', async () => {
    console.log('add result = ', add(2, 3));
    await new Promise((resolve, reject) => {
        setTimeout(() => resolve(undefined), 300);
    });
});

xit('this should not run', () => {
    console.log('silent');
});

it('focus only on this test', () => {
    console.log('asdf');
    add(2,3);
    
    f.a = 1;
})
