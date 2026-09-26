#pragma once

#include <Arduino.h>

#if defined(ESP32)

/** Initialize the restricted Berry VM and load the last verified program. */
void setupBerryRuntime();

/** Compile and atomically install source. The previous program remains active on failure. */
bool installBerryProgram(const char *source, size_t length, String &diagnostic);

/** Execute the installed synchronous mppt() function once. */
bool runBerryMpptStep();

/** Recreate the VM from the active source, resetting all student globals. */
void resetBerryMppt();

/** Disable Berry control and release its VM. */
void disableBerryProgram();

bool isBerryProgramInstalled();
bool isBerryProgramHealthy();
const char *getBerryDiagnostic();
const char *getBerrySource();

#else

inline void setupBerryRuntime() {}
inline bool runBerryMpptStep() { return false; }
inline void resetBerryMppt() {}
inline void disableBerryProgram() {}
inline bool isBerryProgramInstalled() { return false; }
inline bool isBerryProgramHealthy() { return false; }
inline const char *getBerryDiagnostic() { return "Berry requires ESP32"; }
inline const char *getBerrySource() { return ""; }

#endif
