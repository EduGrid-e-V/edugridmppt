#pragma once
#include <Arduino.h>

#ifdef ESP32
void startSweep();
void updateSweep();
bool isSweeping();
String getSweepData();
#endif

