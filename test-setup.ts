// Even though we're using vitest as our test runner,
// it's matchers are compatible with jest matchers.
import "@testing-library/jest-dom";
import "react-test-renderer";
import { BroadcastChannel } from "worker_threads";

console.warn("Disabling console logging for tests");

globalThis.BroadcastChannel = BroadcastChannel as any;
globalThis.testLogger = { ...console };
globalThis.console.log = function () {};
globalThis.console.error = function () {};
globalThis.console.warn = function () {};
globalThis.console.debug = function () {};
