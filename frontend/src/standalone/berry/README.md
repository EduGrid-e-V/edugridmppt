# Berry browser runtime

`berry-wasm.js` is the real Berry interpreter compiled to WebAssembly and wrapped as an ES module. The standalone simulation runs it in the simulation worker. The ESP32 dashboard loads it only when **Install & Run** is pressed, in a separate browser worker that checks code before upload. The ESP32 still compiles and validates the uploaded source independently; the browser check cannot guarantee runtime behaviour on hardware.

- Upstream: https://github.com/berry-lang/berry
- Version: 1.1.0
- Source commit: `b5ede66721937533fbf5c286ef44a5111ea30c75`
- Licence: MIT, reproduced in `LICENSE`
- Generated file SHA-256: `1665ab94aa0984f50e7d3f63c844d1d449a274267afa5584742203403f8e0224`

The checked-in `berry_bridge.c` exposes compilation, a synchronous `mppt()` call, firmware-compatible `PV`, `load`, and `duty` objects, and error retrieval through Berry's public C API. The interpreter and `SimpleSimulation` execute synchronously in the same worker, so a student decision is applied during the current simulation step.

To reproduce the generated module, check out the source commit, run Berry's `make prebuild`, then compile all `src/*.c` and `default/*.c` except `default/berry.c` together with `berry_bridge.c` using Emscripten. Required flags are:

```text
-O3 -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=worker
-sFILESYSTEM=0 -sSINGLE_FILE=1 -sALLOW_MEMORY_GROWTH=1
-sEXPORTED_FUNCTIONS=["_berry_compile","_berry_step","_berry_last_error"]
-sEXPORTED_RUNTIME_METHODS=["ccall","UTF8ToString"]
```
