# Berry browser runtime

`berry-wasm.js` is the real Berry interpreter compiled to WebAssembly and wrapped as an ES module. It is standalone-only and must never be imported by the firmware target.

- Upstream: https://github.com/berry-lang/berry
- Version: 1.1.0
- Source commit: `b5ede66721937533fbf5c286ef44a5111ea30c75`
- Licence: MIT, reproduced in `LICENSE`
- Generated file SHA-256: `e7bad0ee911f6956578aa47627a4b072946a43b13b02eda863631cb2194f02ae`

The checked-in `berry_bridge.c` exposes compilation, a synchronous `mppt(v, i, p, duty)` call, and error retrieval through Berry's public C API. The interpreter and `packages/pv-sim` execute synchronously in the same worker, so a student decision is applied during the current engine step.

To reproduce the generated module, check out the source commit, run Berry's `make prebuild`, then compile all `src/*.c` and `default/*.c` except `default/berry.c` together with `berry_bridge.c` using Emscripten. Required flags are:

```text
-O3 -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=worker
-sFILESYSTEM=0 -sSINGLE_FILE=1 -sALLOW_MEMORY_GROWTH=1
-sEXPORTED_FUNCTIONS=["_berry_compile","_berry_step","_berry_last_error"]
-sEXPORTED_RUNTIME_METHODS=["ccall","UTF8ToString"]
```
