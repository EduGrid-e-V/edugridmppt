#include "config.h"

#ifdef ESP32

#include "sweep_manager.h"
#include "pwm_manager.h"
#include <ArduinoJson.h>
#include <vector>

// Externs from main.cpp
extern Mode mode;
extern float fVin, fIin, fPin;

static bool _sweeping = false;
static float _sweepDuty = 0.05f;
static unsigned long _lastSweepStep = 0;
static Mode _preSweepMode;

struct SweepPoint {
    float v;
    float i;
    float p;
};

static std::vector<SweepPoint> _sweepData;

void startSweep() {
    if (_sweeping) return;
    _preSweepMode = mode;
    mode = MODE_MANUAL; // Take control
    _sweeping = true;
    _sweepDuty = 0.05f;
    _sweepData.clear();
    setDuty(_sweepDuty);
    _lastSweepStep = millis();
}

void updateSweep() {
    if (!_sweeping) return;
    
    if (millis() - _lastSweepStep > 50) { // 50ms per step
        // Record data
        SweepPoint p;
        p.v = fVin;
        p.i = fIin;
        p.p = fPin;
        _sweepData.push_back(p);
        
        // Increment duty
        _sweepDuty += 0.02f;
        if (_sweepDuty > 0.95f) {
            // End sweep
            _sweeping = false;
            mode = _preSweepMode; // Restore mode
            // Optionally set duty back to something safe
        } else {
            setDuty(_sweepDuty);
        }
        _lastSweepStep = millis();
    }
}

bool isSweeping() {
    return _sweeping;
}

String getSweepData() {
    JsonDocument doc;
    JsonArray voltage = doc["v"].to<JsonArray>();
    JsonArray current = doc["i"].to<JsonArray>();
    JsonArray power = doc["p"].to<JsonArray>();
    
    for (const auto& p : _sweepData) {
        voltage.add(p.v);
        current.add(p.i);
        power.add(p.p);
    }
    
    String output;
    serializeJson(doc, output);
    return output;
}

#endif

