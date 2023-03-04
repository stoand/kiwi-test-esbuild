let tests: {priority: boolean, label: string, fn: Function}[] = [];

export async function it(label: string, fn: Function) {
    tests.push({priority: false, label, fn});
}

export async function xit(label: string, fn: Function) { }

export async function fit(label: string, fn: Function) {
    tests.push({priority: true, label, fn});
}

global.__TESTS = tests;
