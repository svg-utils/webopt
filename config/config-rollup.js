import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";

export const commonPlugins = [
  // @ts-ignore - see https://github.com/rollup/plugins/pull/1782
  commonjs(),
  nodeResolve({ browser: true, preferBuiltins: false }),
];

/** @type {import("rollup").RollupOptions} */
export const config = {
  input: "src/js/optimize.js",
  output: {
    dir: "public/js",
  },
  // @ts-ignore - see https://github.com/rollup/plugins/pull/1782
  plugins: [...commonPlugins, terser()],
};

export default config;
