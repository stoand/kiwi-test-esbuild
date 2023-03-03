import React from 'react';

console.log(React);

// fail.now = 1

// this causes a build-time error
// if (Math.PI + 1 = 3 || Math.PI + 1 = 4) {
//   console.log("no way!");
// }

export function add(a: number, b: number): number {
    return a + b;
}
