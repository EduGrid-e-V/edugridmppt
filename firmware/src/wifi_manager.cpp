#ifdef ESP32
#include "wifi_manager.h"
#include "config.h"
#include "input_manager.h"
#include "mppt_alg.h"
#include "sweep_manager.h"
#include <Arduino.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>

// Measurements from main.cpp
extern float PanelVoltage;
extern float PanelCurrent;
extern float PanelPower;
extern float LoadVoltage;
extern float LoadCurrent;
extern float LoadPower;
extern bool LoadSensorAvailable;
extern Mode mode;
extern Algorithm currentAlgorithm;

AsyncWebServer server(WEB_PORT);
AsyncWebSocket ws("/ws");

static bool webManualDutyActive = false;
static float webManualDuty = PWM_MIN_DUTY;

void broadcastMpptData(float v, float i, float p) {
    if (ws.count() == 0) return;
    String json = "{";
    json += "\"v\":" + String(v, 2) + ",";
    json += "\"i\":" + String(i, 4) + ",";
    json += "\"p\":" + String(p, 2) + ",";
    json += "\"loadV\":" + String(LoadVoltage, 2) + ",";
    json += "\"loadI\":" + String(LoadCurrent, 4) + ",";
    json += "\"loadP\":" + String(LoadPower, 2) + ",";
    json += "\"loadSensor\":" + String(LoadSensorAvailable ? "true" : "false") + ",";
    json += "\"d\":" + String(getConverterDutyCycle(), 3) + ",";
    json += "\"pot\":" + String(readPotentiometerRaw()) + ",";
    json += "\"m\":\"" + String(mode == MODE_AUTO ? "AUTO" : "MANUAL") + "\",";
    json += "\"algo\":\"" + String(currentAlgorithm == ALGORITHM_INCCOND ? "INCCOND" : "PNO") + "\"";
    json += "}";
    ws.textAll(json);
}

void broadcastSweepDone() {
    if (ws.count() == 0) return;
    ws.textAll("{\"event\":\"sweep_done\"}");
}

void setWebMode(Mode requestedMode) {
    mode = requestedMode;
    if (requestedMode == MODE_MANUAL) {
        webManualDutyActive = false;
    } else {
        webManualDutyActive = false;
    }
}

void setWebAlgorithm(Algorithm requestedAlgorithm) {
    currentAlgorithm = requestedAlgorithm;
}

void setWebDuty(float duty) {
    webManualDutyActive = true;
    webManualDuty = constrain(duty, PWM_MIN_DUTY, PWM_MAX_DUTY);
    mode = MODE_MANUAL;
    rememberCurrentPotentiometerPositionAsBaseline();
    setConverterDutyCycle(webManualDuty);
}

void clearWebManualDuty() {
    webManualDutyActive = false;
}

bool isWebManualDutyActive() {
    return webManualDutyActive;
}

float getWebManualDuty() {
    return webManualDuty;
}

void setupWiFi() {
  // Start Open Access Point (No Password)
  WiFi.softAP(WIFI_SSID);
  Serial.print("AP IP Address: ");
  Serial.println(WiFi.softAPIP());

  if(!LittleFS.begin()){
    Serial.println("An Error has occurred while mounting LittleFS");
  } else {
    server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
  }

  ws.onEvent([](AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len){
      // Handle WebSocket events if needed
  });
  server.addHandler(&ws);

  server.on("/api/data", HTTP_GET, [](AsyncWebServerRequest *request){
    String json = "{";
    json += "\"vin\":" + String(PanelVoltage, 2) + ",";
    json += "\"iin\":" + String(PanelCurrent, 4) + ",";
    json += "\"pin\":" + String(PanelPower, 2) + ",";
    json += "\"loadV\":" + String(LoadVoltage, 2) + ",";
    json += "\"loadI\":" + String(LoadCurrent, 4) + ",";
    json += "\"loadP\":" + String(LoadPower, 2) + ",";
    json += "\"loadSensor\":" + String(LoadSensorAvailable ? "true" : "false") + ",";
    json += "\"duty\":" + String(getConverterDutyCycle() * 100, 1) + ",";
    json += "\"pot\":" + String(readPotentiometerRaw()) + ",";
    json += "\"mode\":\"" + String(mode == MODE_AUTO ? "AUTO" : "MANUAL") + "\",";
    json += "\"algo\":\"" + String(currentAlgorithm == ALGORITHM_INCCOND ? "INCCOND" : "PNO") + "\"";
    json += "}";
    request->send(200, "application/json", json);
  });

  server.on("/api/set", HTTP_GET, [](AsyncWebServerRequest *request){
    if (request->hasParam("mode")) {
        String m = request->getParam("mode")->value();
        if (m == "AUTO") setWebMode(MODE_AUTO);
        else if (m == "MANUAL") setWebMode(MODE_MANUAL);
    }
    if (request->hasParam("algo")) {
        String a = request->getParam("algo")->value();
        if (a == "INCCOND") setWebAlgorithm(ALGORITHM_INCCOND);
        else if (a == "PNO") setWebAlgorithm(ALGORITHM_PNO);
    }
    if (request->hasParam("duty")) {
        setWebDuty(request->getParam("duty")->value().toFloat());
    }
    request->send(200, "text/plain", "OK");
  });

  server.on("/api/sweep", HTTP_GET, [](AsyncWebServerRequest *request){
      startSweep();
      request->send(200, "text/plain", "Sweep Started");
  });
  
  server.on("/api/sweepdata", HTTP_GET, [](AsyncWebServerRequest *request){
      request->send(200, "application/json", getSweepData());
  });

  server.begin();
}

void handleWiFi() {
    ws.cleanupClients();
}

#endif
