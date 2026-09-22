#if defined(ESP32)

#include "berry_manager.h"
#include "config.h"
#include "mppt_alg.h"
#include "pwm_manager.h"
#include <Arduino.h>
#include <LittleFS.h>
#include <math.h>

extern "C" {
#include "berry.h"
}

static const char *PROGRAM_PATH = "/student.be";
static const char *TEMP_PROGRAM_PATH = "/student.be.tmp";
static const char *BACKUP_PROGRAM_PATH = "/student.be.bak";

static bvm *studentVm = nullptr;
static SemaphoreHandle_t vmMutex = nullptr;
static String activeSource;
static String diagnostic = "No Berry program installed";
static bool healthy = false;
static float proposedDuty = PWM_MIN_DUTY;
static unsigned long executionStartedMs = 0;
static unsigned long executionBudgetMs = 0;

static const char *studentApi =
    "class MeasurementPort\n"
    "  var load_side\n"
    "  def init(load_side) self.load_side = load_side end\n"
    "  def getVoltage() if self.load_side return _load_voltage() end return _pv_voltage() end\n"
    "  def getCurrent() if self.load_side return _load_current() end return _pv_current() end\n"
    "  def getPower() if self.load_side return _load_power() end return _pv_power() end\n"
    "  def isAvailable() if self.load_side return _load_available() end return true end\n"
    "end\n"
    "class DutyControl\n"
    "  def get() return _duty_get() end\n"
    "  def set(value) _duty_set(value) end\n"
    "  def change(delta) _duty_change(delta) end\n"
    "end\n"
    "PV = MeasurementPort(false)\n"
    "load = MeasurementPort(true)\n"
    "duty = DutyControl()\n";

static int pushReal(bvm *vm, float value) {
    be_pushreal(vm, value);
    return be_returnvalue(vm);
}

static int nativePvVoltage(bvm *vm) { return pushReal(vm, PV.getVoltage()); }
static int nativePvCurrent(bvm *vm) { return pushReal(vm, PV.getCurrent()); }
static int nativePvPower(bvm *vm) { return pushReal(vm, PV.getPower()); }
static int nativeLoadVoltage(bvm *vm) { return pushReal(vm, load.getVoltage()); }
static int nativeLoadCurrent(bvm *vm) { return pushReal(vm, load.getCurrent()); }
static int nativeLoadPower(bvm *vm) { return pushReal(vm, load.getPower()); }
static int nativeLoadAvailable(bvm *vm) {
    be_pushbool(vm, load.isAvailable());
    return be_returnvalue(vm);
}
static int nativeDutyGet(bvm *vm) { return pushReal(vm, proposedDuty); }
static int nativeDutySet(bvm *vm) {
    proposedDuty = be_toreal(vm, 1);
    return be_returnnilvalue(vm);
}
static int nativeDutyChange(bvm *vm) {
    proposedDuty += be_toreal(vm, 1);
    return be_returnnilvalue(vm);
}

static void observabilityHook(bvm *vm, int event, ...) {
    if (event == BE_OBS_VM_HEARTBEAT &&
        millis() - executionStartedMs > executionBudgetMs) {
        be_raise(vm, "timeout_error", "Student mppt() exceeded its execution limit");
    }
}

static void clearStack(bvm *vm) {
    int top = be_top(vm);
    if (top > 0) be_pop(vm, top);
}

static String stackError(bvm *vm, const char *fallback) {
    const char *message = be_top(vm) > 0 ? be_tostring(vm, -1) : nullptr;
    String result = message != nullptr ? message : fallback;
    clearStack(vm);
    return result;
}

static void registerApi(bvm *vm) {
    be_regfunc(vm, "_pv_voltage", nativePvVoltage);
    be_regfunc(vm, "_pv_current", nativePvCurrent);
    be_regfunc(vm, "_pv_power", nativePvPower);
    be_regfunc(vm, "_load_voltage", nativeLoadVoltage);
    be_regfunc(vm, "_load_current", nativeLoadCurrent);
    be_regfunc(vm, "_load_power", nativeLoadPower);
    be_regfunc(vm, "_load_available", nativeLoadAvailable);
    be_regfunc(vm, "_duty_get", nativeDutyGet);
    be_regfunc(vm, "_duty_set", nativeDutySet);
    be_regfunc(vm, "_duty_change", nativeDutyChange);
    be_set_obs_hook(vm, observabilityHook);
}

static bool runBuffer(bvm *vm, const char *name, const char *source, size_t length,
                      unsigned long budgetMs, String &error) {
    executionStartedMs = millis();
    executionBudgetMs = budgetMs;
    int result = be_loadbuffer(vm, name, source, length);
    if (result == BE_OK) result = be_pcall(vm, 0);
    if (result != BE_OK) {
        error = stackError(vm, "Berry compile error");
        return false;
    }
    clearStack(vm);
    return true;
}

static bool buildVm(const char *source, size_t length, bvm *&candidate, String &error) {
    candidate = be_vm_new();
    if (candidate == nullptr) {
        error = "Unable to allocate Berry VM";
        return false;
    }
    registerApi(candidate);
    if (!runBuffer(candidate, "student-api.be", studentApi, strlen(studentApi),
                   BERRY_COMPILE_TIMEOUT_MS, error) ||
        !runBuffer(candidate, "student.be", source, length,
                   BERRY_COMPILE_TIMEOUT_MS, error)) {
        be_vm_delete(candidate);
        candidate = nullptr;
        return false;
    }
    if (!be_getglobal(candidate, "mppt") || !be_isfunction(candidate, -1)) {
        error = "Define a function named mppt()";
        clearStack(candidate);
        be_vm_delete(candidate);
        candidate = nullptr;
        return false;
    }
    clearStack(candidate);
    return true;
}

static bool activateProgram(const char *source, size_t length, String &result,
                            bool persist) {
    if (source == nullptr || length == 0) {
        result = "Program is empty";
        return false;
    }
    if (length > BERRY_SOURCE_MAX_BYTES) {
        result = "Program exceeds the 4096-byte limit";
        return false;
    }
    if (ESP.getFreeHeap() < BERRY_MIN_FREE_HEAP_BYTES) {
        result = "Not enough free memory to install Berry program";
        return false;
    }

    bvm *candidate = nullptr;
    if (!buildVm(source, length, candidate, result)) return false;

    bvm *previous = studentVm;
    studentVm = candidate;
    activeSource = String(source).substring(0, length);
    diagnostic = "Berry program compiled and installed";
    healthy = true;
    if (previous != nullptr) be_vm_delete(previous);

    if (persist) {
        File file = LittleFS.open(TEMP_PROGRAM_PATH, "w");
        if (!file || file.write(reinterpret_cast<const uint8_t *>(source), length) != length) {
            if (file) file.close();
            LittleFS.remove(TEMP_PROGRAM_PATH);
            diagnostic = "Program is active, but could not be saved";
            result = diagnostic;
            return true;
        }
        file.close();
        LittleFS.remove(BACKUP_PROGRAM_PATH);
        bool hadSavedProgram = LittleFS.exists(PROGRAM_PATH);
        if (hadSavedProgram && !LittleFS.rename(PROGRAM_PATH, BACKUP_PROGRAM_PATH)) {
            LittleFS.remove(TEMP_PROGRAM_PATH);
            diagnostic = "Program is active, but the previous saved file could not be protected";
            result = diagnostic;
            return true;
        }
        if (!LittleFS.rename(TEMP_PROGRAM_PATH, PROGRAM_PATH)) {
            if (hadSavedProgram) LittleFS.rename(BACKUP_PROGRAM_PATH, PROGRAM_PATH);
            diagnostic = "Program is active, but saved-file replacement failed";
            result = diagnostic;
            return true;
        }
        LittleFS.remove(BACKUP_PROGRAM_PATH);
    }

    result = diagnostic;
    return true;
}

void setupBerryRuntime() {
    if (vmMutex == nullptr) vmMutex = xSemaphoreCreateMutex();
    if (!LittleFS.exists(PROGRAM_PATH)) return;
    File file = LittleFS.open(PROGRAM_PATH, "r");
    if (!file || file.size() == 0 || file.size() > BERRY_SOURCE_MAX_BYTES) {
        diagnostic = "Saved Berry program is invalid";
        return;
    }
    String source = file.readString();
    file.close();
    String result;
    if (!activateProgram(source.c_str(), source.length(), result, false)) diagnostic = result;
}

bool installBerryProgram(const char *source, size_t length, String &result) {
    if (vmMutex == nullptr) vmMutex = xSemaphoreCreateMutex();
    if (xSemaphoreTake(vmMutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        result = "Berry runtime is busy";
        return false;
    }
    bool installed = activateProgram(source, length, result, true);
    xSemaphoreGive(vmMutex);
    return installed;
}

bool runBerryMpptStep() {
    if (studentVm == nullptr || !healthy || vmMutex == nullptr) return false;
    if (xSemaphoreTake(vmMutex, 0) != pdTRUE) return false;

    proposedDuty = getConverterDutyCycle();
    executionStartedMs = millis();
    executionBudgetMs = BERRY_STEP_TIMEOUT_MS;
    bool succeeded = be_getglobal(studentVm, "mppt") && be_isfunction(studentVm, -1);
    int result = succeeded ? be_pcall(studentVm, 0) : BE_EXCEPTION;
    if (!succeeded || result != BE_OK) {
        diagnostic = stackError(studentVm, "Berry mppt() is unavailable");
        healthy = false;
        setConverterDutyCycle(PWM_MIN_DUTY);
        xSemaphoreGive(vmMutex);
        return false;
    }
    clearStack(studentVm);

    if (!std::isfinite(proposedDuty)) {
        diagnostic = "Berry produced a non-finite duty cycle";
        healthy = false;
        setConverterDutyCycle(PWM_MIN_DUTY);
        xSemaphoreGive(vmMutex);
        return false;
    }
    float currentDuty = getConverterDutyCycle();
    float safeDuty = constrain(proposedDuty,
                               currentDuty - BERRY_MAX_DUTY_CHANGE,
                               currentDuty + BERRY_MAX_DUTY_CHANGE);
    setConverterDutyCycle(safeDuty);
    xSemaphoreGive(vmMutex);
    return true;
}

void resetBerryMppt() {
    if (activeSource.isEmpty()) return;
    String sourceCopy = activeSource;
    String result;
    if (vmMutex != nullptr && xSemaphoreTake(vmMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
        activateProgram(sourceCopy.c_str(), sourceCopy.length(), result, false);
        xSemaphoreGive(vmMutex);
    }
}

void disableBerryProgram() {
    if (vmMutex != nullptr && xSemaphoreTake(vmMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
        if (studentVm != nullptr) be_vm_delete(studentVm);
        studentVm = nullptr;
        activeSource = "";
        healthy = false;
        diagnostic = "Berry program disabled";
        LittleFS.remove(PROGRAM_PATH);
        LittleFS.remove(TEMP_PROGRAM_PATH);
        LittleFS.remove(BACKUP_PROGRAM_PATH);
        xSemaphoreGive(vmMutex);
    }
    setConverterDutyCycle(PWM_MIN_DUTY);
}

bool isBerryProgramInstalled() { return studentVm != nullptr; }
bool isBerryProgramHealthy() { return studentVm != nullptr && healthy; }
const char *getBerryDiagnostic() { return diagnostic.c_str(); }
const char *getBerrySource() { return activeSource.c_str(); }

#endif
