#include <jni.h>
#include <stdlib.h>

extern int InitTorrentEngine(char* storageDir, int port);

JNIEXPORT jint JNICALL Java_kkadogo_findstreamer_com_TorrentStreamer_init(
    JNIEnv* env,
    jclass clazz,
    jstring storageDir,
    jint port) {
    const char *nativePath = (*env)->GetStringUTFChars(env, storageDir, 0);
    int res = InitTorrentEngine((char*)nativePath, (int)port);
    (*env)->ReleaseStringUTFChars(env, storageDir, nativePath);
    return res;
}
