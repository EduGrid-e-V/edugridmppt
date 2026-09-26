#pragma once

#if defined(ESP32)
#include <Arduino.h>

void setupLogManager(bool filesystemMounted);
bool startLogRecording(unsigned intervalSeconds, String &message);
void stopLogRecording();
void recordLogSample(unsigned long nowMs, float pvV, float pvI,
                     float loadV, float loadI, bool loadAvailable, float duty);
String logStatusJson();
bool deleteLogRecording(const String &name);
bool isSafeLogName(const String &name);
String logFilePath(const String &name);
#endif
