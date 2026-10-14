#include <jni.h>
#include "LumaflowJSIModule.h"

extern "C" JNIEXPORT void JNICALL
Java_com_lumaflow_photoeditor_LumaflowJsiModule_nativeInstall(
    JNIEnv* env,
    jclass clazz,
    jlong jsiPtr
) {
    auto runtime = reinterpret_cast<facebook::jsi::Runtime*>(jsiPtr);
    if (runtime) {
        lumaflow::installLumaflowJSI(*runtime);
    }
}
