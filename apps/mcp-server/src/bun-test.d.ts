declare module 'bun:test' {
  type TestCallback = () => unknown | Promise<unknown>;

  export const describe: (name: string, callback: TestCallback) => void;
  export const test: (name: string, callback: TestCallback) => void;
  export const afterEach: (callback: TestCallback) => void;
  export const expect: any;
  export const spyOn: (object: object, method: string) => any;
}
