type Primitives = void | null | undefined | string | number | bigint | boolean | symbol;
/**
 * Branded type that encodes possible thrown errors in the return type. The error types are
 * phantom types for static analysis; the runtime value is just T.
 */
export type Throws<T, E extends Error> = (T & {
    readonly __throws?: E;
}) | Extract<T, Primitives>;
export {};
//# sourceMappingURL=throws.d.ts.map