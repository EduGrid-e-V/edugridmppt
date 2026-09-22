#include <Arduino.h>

extern "C" {
#include "berry.h"
#include "be_sys.h"
}

BERRY_API void be_writebuffer(const char *buffer, size_t length) {
    Serial.write(reinterpret_cast<const uint8_t *>(buffer), length);
}

BERRY_API char *be_readstring(char *buffer, size_t size) {
    if (buffer != nullptr && size > 0) buffer[0] = '\0';
    return buffer;
}

// File access is deliberately unavailable to student programs. Berry's core
// still links these port symbols even when the file module is disabled.
void *be_fopen(const char *, const char *) { return nullptr; }
int be_fclose(void *) { return -1; }
size_t be_fwrite(void *, const void *, size_t) { return 0; }
size_t be_fread(void *, void *, size_t) { return 0; }
char *be_fgets(void *, void *, int) { return nullptr; }
int be_fseek(void *, long) { return -1; }
long int be_ftell(void *) { return -1; }
long int be_fflush(void *) { return -1; }
size_t be_fsize(void *) { return 0; }
int be_isdir(const char *) { return 0; }
int be_isfile(const char *) { return 0; }
int be_isexist(const char *) { return 0; }
char *be_getcwd(char *buffer, size_t size) {
    if (buffer != nullptr && size > 0) buffer[0] = '\0';
    return buffer;
}
int be_chdir(const char *) { return -1; }
int be_mkdir(const char *) { return -1; }
int be_unlink(const char *) { return -1; }
int be_dirfirst(bdirinfo *, const char *) { return -1; }
int be_dirnext(bdirinfo *) { return -1; }
int be_dirclose(bdirinfo *) { return -1; }
