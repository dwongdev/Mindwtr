declare module 'bun:test' {
    type TestCallback = () => unknown | Promise<unknown>;

    export const describe: (name: string, callback: TestCallback) => void;
    export const test: (name: string, callback: TestCallback) => void;
    export const beforeEach: (callback: TestCallback) => void;
    export const afterEach: (callback: TestCallback) => void;
    export const expect: any;
}

type RequestDuplex = 'half';

interface RequestInit {
    duplex?: RequestDuplex;
}
