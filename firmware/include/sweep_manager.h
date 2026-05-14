#pragma once
#include <Arduino.h>

#ifdef ESP32
void startSweep();
bool updateSweep();
bool isSweeping();
String getSweepData();
#endif
