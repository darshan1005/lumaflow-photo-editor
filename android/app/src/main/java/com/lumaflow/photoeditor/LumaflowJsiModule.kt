package com.lumaflow.photoeditor

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LumaflowJsiModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "LumaflowJsiModule"

    companion object {
        init {
            try {
                System.loadLibrary("lumaflow_ffi")
                System.loadLibrary("lumaflow_jsi")
            } catch (e: UnsatisfiedLinkError) {
                // When running on platforms without compiled native binary, gracefully fallback
                android.util.Log.w("LumaflowJsi", "Native Lumaflow libraries not found: ${e.message}")
            }
        }

        @JvmStatic
        external fun nativeInstall(jsiPtr: Long)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun install(): Boolean {
        return try {
            val jsContext = reactApplicationContext.javaScriptContextHolder?.get()
            if (jsContext != null && jsContext != 0L) {
                nativeInstall(jsContext)
                true
            } else {
                false
            }
        } catch (e: Exception) {
            android.util.Log.e("LumaflowJsi", "Failed to install Lumaflow JSI bindings", e)
            false
        }
    }
}
