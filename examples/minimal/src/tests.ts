import { add } from './app';
import { it, xit, fit } from 'kiwi-test-esbuild';

// g.a = 1;
    
console.log('asdf');
    

it('can add', () => {

    console.log('add result = ', add(2, 3));
    
    if (false) {
        console.log('ignore');
        
        console.log('us');
    }
});

it('supports async', async () => {
    console.log('add result = ' + add(0, 3));
    
    await new Promise((resolve, reject) => {
        setTimeout(() => resolve(undefined), 3);
    });
});

xit('this should not run', () => {
    console.log('silent');
});


it('focus only on this test', () => {
    console.log('asdf');
    add(2,3);
    
    g.a = 1;
    
})

it('focus only on this test', () => {
    console.log('asdf');
    add(2,3);
    
    // f.a = 1;
    
})
