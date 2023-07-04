import { add } from './app';
import { it, fit } from 'kiwi-test-esbuild';
import { expect } from 'chai';
import { errorPassthrough } from './error_passthrough';

// errorPassthrough();

// a.j = 1

// throw new Error("asdf");

it('handles logs', () => {

    console.log('g');
});


it('handles deepErrors', () => {

    console.log('f');


    // b.a = 9;


    // expect({ a: add(1, 2), b: 1 }).to.deep.equal({ a: 1234, b: 1 });


    errorPassthrough();
    
});
