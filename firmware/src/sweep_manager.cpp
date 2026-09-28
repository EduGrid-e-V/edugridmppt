#include "config.h"

#ifdef ESP32

#include "sweep_manager.h"
#include "pwm_manager.h"
#include <ArduinoJson.h>
#include <vector>

// Measurements from main.cpp
extern Mode mode;
extern float PanelVoltage;
extern float PanelCurrent;
extern float PanelPower;
extern float LoadVoltage;
extern float LoadCurrent;
extern float LoadPower;
extern bool LoadSensorAvailable;

static bool _sweeping = false;
static float _sweepDuty = PWM_MIN_DUTY;
static unsigned long _lastSweepStep = 0;
static Mode _preSweepMode;

struct SweepPoint {
    float v;
    float i;
    float p;
    float loadV;
    float loadI;
    float loadP;
    bool loadSensor;
};

static std::vector<SweepPoint> _sweepData;

void startSweep() {
    if (_sweeping) return;
    _preSweepMode = mode;
    mode = MODE_MANUAL; // Take control
    _sweeping = true;
    _sweepDuty = PWM_MIN_DUTY;
    _sweepData.clear();
    setDuty(_sweepDuty);
    _lastSweepStep = millis();
}

void cancelSweep() {
    if (!_sweeping) return;
    _sweeping = false;
    mode = _preSweepMode;
}

bool updateSweep() {
    if (!_sweeping) return false;
    
    if (millis() - _lastSweepStep > 50) { // 50ms per step
        // Record data
        SweepPoint p;
        p.v = PanelVoltage;
        p.i = PanelCurrent;
        p.p = PanelPower;
        p.loadV = LoadVoltage;
        p.loadI = LoadCurrent;
        p.loadP = LoadPower;
        p.loadSensor = LoadSensorAvailable;
        _sweepData.push_back(p);
        
        // Include both 0% and 100% endpoints before finishing.
        if (_sweepDuty >= PWM_MAX_DUTY) {
            // End sweep
            _sweeping = false;
            mode = _preSweepMode; // Restore mode
            // Optionally set duty back to something safe
            _lastSweepStep = millis();
            return true;
        } else {
            _sweepDuty += 0.02f;
            if (_sweepDuty > PWM_MAX_DUTY) _sweepDuty = PWM_MAX_DUTY;
            setDuty(_sweepDuty);
        }
        _lastSweepStep = millis();
    }

    return false;
}

bool isSweeping() {
    return _sweeping;
}

String getSweepData() {
    JsonDocument doc;
    JsonArray voltage = doc["v"].to<JsonArray>();
    JsonArray current = doc["i"].to<JsonArray>();
    JsonArray power = doc["p"].to<JsonArray>();
    JsonArray loadVoltage = doc["loadV"].to<JsonArray>();
    JsonArray loadCurrent = doc["loadI"].to<JsonArray>();
    JsonArray loadPower = doc["loadP"].to<JsonArray>();
    doc["loadSensor"] = LoadSensorAvailable;
    
    for (const auto& p : _sweepData) {
        voltage.add(p.v);
        current.add(p.i);
        power.add(p.p);
        loadVoltage.add(p.loadV);
        loadCurrent.add(p.loadI);
        loadPower.add(p.loadP);
    }
    
    String output;
    serializeJson(doc, output);
    return output;
}

#endif
