# Berry interpreter

This is the Berry 1.1.0 interpreter core, pinned from commit
`b5ede66721937533fbf5c286ef44a5111ea30c75`. It is vendored so an EduGrid
firmware build does not download executable source at build time.

The local `berry_conf.h` disables filesystem, OS, debug, introspection, shared
library, and bytecode-file access. It also enables the VM observability hook at
4096-instruction intervals; `berry_manager.cpp` uses that hook to enforce a
wall-clock execution deadline.
