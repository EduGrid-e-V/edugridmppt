#if defined(ESP32)

#include "log_manager.h"
#include <LittleFS.h>
#include <cstring>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

namespace {
constexpr size_t LOG_BUDGET_BYTES = 4U * 1024U * 1024U;
constexpr unsigned MAX_LOG_FILES = 64;
constexpr size_t MIN_FREE_BYTES = 256U * 1024U;
constexpr char LOG_DIR[] = "/logs";
constexpr char CSV_HEADER[] = "elapsed_s,pv_voltage_v,pv_current_a,load_voltage_v,load_current_a,duty\n";
SemaphoreHandle_t logMutex = nullptr;
File activeFile;
bool mounted = false;
bool recording = false;
unsigned intervalS = 1;
unsigned long startedMs = 0;
unsigned long lastSampleMs = 0;
unsigned pendingRows = 0;
String activeName;
String lastMessage = "Ready";

bool takeLock() {
    return logMutex && xSemaphoreTake(logMutex, pdMS_TO_TICKS(1000)) == pdTRUE;
}

void closeActive() {
    if (activeFile) {
        activeFile.flush();
        activeFile.close();
    }
    recording = false;
    pendingRows = 0;
}

size_t logBytes() {
    File directory = LittleFS.open(LOG_DIR);
    if (!directory || !directory.isDirectory()) return 0;
    size_t total = 0;
    File entry = directory.openNextFile();
    while (entry) {
        if (!entry.isDirectory()) total += entry.size();
        entry.close();
        entry = directory.openNextFile();
    }
    directory.close();
    return total;
}

String nextName() {
    for (unsigned id = 1; id <= MAX_LOG_FILES; ++id) {
        char name[20];
        snprintf(name, sizeof(name), "run-%04u.csv", id);
        if (!LittleFS.exists(String(LOG_DIR) + "/" + name)) return String(name);
    }
    return "";
}
}

bool isSafeLogName(const String &name) {
    if (name.length() != 12 || !name.startsWith("run-") || !name.endsWith(".csv")) return false;
    for (unsigned index = 4; index < 8; ++index) {
        if (name[index] < '0' || name[index] > '9') return false;
    }
    return true;
}

String logFilePath(const String &name) {
    return isSafeLogName(name) ? String(LOG_DIR) + "/" + name : String();
}

void setupLogManager(bool filesystemMounted) {
    if (!logMutex) logMutex = xSemaphoreCreateMutex();
    if (!takeLock()) return;
    mounted = filesystemMounted;
    if (mounted && !LittleFS.exists(LOG_DIR)) LittleFS.mkdir(LOG_DIR);
    if (!mounted) lastMessage = "LittleFS is unavailable";
    xSemaphoreGive(logMutex);
}

bool startLogRecording(unsigned seconds, String &message) {
    if (seconds != 1 && seconds != 30 && seconds != 60 && seconds != 300) {
        message = "Choose 1, 30, 60, or 300 seconds";
        return false;
    }
    if (!takeLock()) {
        message = "Logger is busy";
        return false;
    }
    if (!mounted) {
        message = "LittleFS is unavailable";
    } else if (recording) {
        message = "A recording is already running";
    } else if (logBytes() > LOG_BUDGET_BYTES - (sizeof(CSV_HEADER) - 1) ||
               LittleFS.totalBytes() - LittleFS.usedBytes() < MIN_FREE_BYTES + sizeof(CSV_HEADER) - 1) {
        message = "Recording storage is full. Download and delete older CSV files.";
    } else {
        activeName = nextName();
        if (activeName.isEmpty()) {
            message = "Maximum number of recordings reached";
        } else {
            activeFile = LittleFS.open(logFilePath(activeName), "w");
            if (!activeFile || activeFile.print(CSV_HEADER) != strlen(CSV_HEADER)) {
                if (activeFile) activeFile.close();
                LittleFS.remove(logFilePath(activeName));
                message = "Could not create CSV";
            } else {
                intervalS = seconds;
                startedMs = millis();
                lastSampleMs = startedMs - seconds * 1000UL;
                recording = true;
                pendingRows = 0;
                message = "Recording started";
            }
        }
    }
    lastMessage = message;
    xSemaphoreGive(logMutex);
    return recording;
}

void stopLogRecording() {
    if (!takeLock()) return;
    if (recording) {
        closeActive();
        lastMessage = "Recording stopped";
    }
    xSemaphoreGive(logMutex);
}

void recordLogSample(unsigned long nowMs, float pvV, float pvI,
                     float loadV, float loadI, bool loadAvailable, float duty) {
    if (!recording || !takeLock()) return;
    if (!recording || nowMs - lastSampleMs < intervalS * 1000UL) {
        xSemaphoreGive(logMutex);
        return;
    }
    lastSampleMs = nowMs;
    String row = String((nowMs - startedMs) / 1000.0f, 3) + "," +
                 String(pvV, 3) + "," + String(pvI, 5) + ",";
    if (loadAvailable) row += String(loadV, 3) + "," + String(loadI, 5);
    else row += ",";
    row += "," + String(duty, 4) + "\n";
    if (logBytes() + row.length() > LOG_BUDGET_BYTES ||
        LittleFS.totalBytes() - LittleFS.usedBytes() < MIN_FREE_BYTES + row.length() ||
        activeFile.print(row) != row.length()) {
        closeActive();
        lastMessage = "Recording stopped: storage limit or write error";
    } else if (++pendingRows >= 10) {
        activeFile.flush();
        pendingRows = 0;
    }
    xSemaphoreGive(logMutex);
}

String logStatusJson() {
    if (!takeLock()) return "{\"error\":\"Logger is busy\"}";
    String json = "{\"mounted\":" + String(mounted ? "true" : "false") +
                  ",\"recording\":" + String(recording ? "true" : "false") +
                  ",\"intervalS\":" + String(intervalS) +
                  ",\"active\":\"" + activeName + "\"" +
                  ",\"usedBytes\":" + String(mounted ? logBytes() : 0) +
                  ",\"budgetBytes\":" + String(LOG_BUDGET_BYTES) +
                  ",\"freeBytes\":" + String(mounted ? LittleFS.totalBytes() - LittleFS.usedBytes() : 0) +
                  ",\"message\":\"" + lastMessage + "\",\"files\":[";
    if (mounted) {
        File directory = LittleFS.open(LOG_DIR);
        if (directory && directory.isDirectory()) {
            File entry = directory.openNextFile();
            bool first = true;
            while (entry) {
                String name = String(entry.name());
                int slash = name.lastIndexOf('/');
                if (slash >= 0) name = name.substring(slash + 1);
                if (!entry.isDirectory() && isSafeLogName(name)) {
                    if (!first) json += ",";
                    json += "{\"name\":\"" + name + "\",\"bytes\":" + String(entry.size()) + "}";
                    first = false;
                }
                entry.close();
                entry = directory.openNextFile();
            }
        }
    }
    json += "]}";
    xSemaphoreGive(logMutex);
    return json;
}

bool deleteLogRecording(const String &name) {
    String path = logFilePath(name);
    if (path.isEmpty() || !takeLock()) return false;
    bool removed = mounted && (!recording || name != activeName) && LittleFS.remove(path);
    xSemaphoreGive(logMutex);
    return removed;
}

#endif
