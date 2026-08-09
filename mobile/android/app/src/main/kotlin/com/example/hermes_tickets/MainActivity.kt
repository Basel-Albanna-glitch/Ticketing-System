package com.example.hermes_tickets

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * Hosts a document picker implemented directly against Android's
 * ACTION_OPEN_DOCUMENT.
 *
 * The obvious choice would be the file_picker plugin, but it pins Kotlin Gradle
 * Plugin 1.8.22 and applies it itself, which conflicts with Flutter's built-in
 * Kotlin — its classes silently fail to compile. Doing it here means the code
 * builds with the app's own Kotlin and cannot drift out of step with the
 * toolchain.
 *
 * Picked documents arrive as content:// URIs, which Dart's File and multipart
 * upload cannot read. Each one is therefore copied into the app's cache and a
 * real filesystem path is handed back.
 */
class MainActivity : FlutterActivity() {

    private companion object {
        const val CHANNEL = "hermes/documents"
        const val REQUEST_PICK = 4711
    }

    private var pending: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result -> onMethodCall(call, result) }
    }

    private fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        if (call.method != "pick") {
            result.notImplemented()
            return
        }
        if (pending != null) {
            result.error("busy", "A picker is already open", null)
            return
        }

        val allowMultiple = call.argument<Boolean>("allowMultiple") ?: true
        val mimeTypes = call.argument<List<String>>("mimeTypes")

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple)
            if (!mimeTypes.isNullOrEmpty()) {
                putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toTypedArray())
            }
        }

        pending = result
        try {
            startActivityForResult(intent, REQUEST_PICK)
        } catch (e: Exception) {
            pending = null
            result.error("unavailable", "No document picker available", e.message)
        }
    }

    @Deprecated("startActivityForResult is the supported path for FlutterActivity")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_PICK) {
            super.onActivityResult(requestCode, resultCode, data)
            return
        }

        val result = pending
        pending = null

        if (result == null) return
        if (resultCode != Activity.RESULT_OK || data == null) {
            // Cancelled — an empty list, not an error.
            result.success(emptyList<Map<String, Any?>>())
            return
        }

        val uris = mutableListOf<Uri>()
        data.clipData?.let { clip ->
            for (i in 0 until clip.itemCount) uris.add(clip.getItemAt(i).uri)
        }
        if (uris.isEmpty()) data.data?.let { uris.add(it) }

        val picked = uris.mapNotNull { uri ->
            try {
                copyToCache(uri)
            } catch (e: Exception) {
                // Skip anything unreadable rather than failing the whole batch.
                null
            }
        }
        result.success(picked)
    }

    /** Copy [uri] into the cache directory and describe it for Dart. */
    private fun copyToCache(uri: Uri): Map<String, Any?> {
        var name = "document"
        var size = 0L

        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (cursor.moveToFirst()) {
                if (nameIndex >= 0 && !cursor.isNull(nameIndex)) {
                    name = cursor.getString(nameIndex)
                }
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
                    size = cursor.getLong(sizeIndex)
                }
            }
        }

        val dir = File(cacheDir, "picked").apply { mkdirs() }
        // Prefix with a timestamp so picking two files of the same name works.
        val target = File(dir, "${System.currentTimeMillis()}_$name")
        contentResolver.openInputStream(uri)?.use { input ->
            target.outputStream().use { output -> input.copyTo(output) }
        } ?: throw IllegalStateException("cannot open $uri")

        if (size == 0L) size = target.length()

        return mapOf(
            "path" to target.absolutePath,
            "name" to name,
            "size" to size,
            "mimeType" to (contentResolver.getType(uri) ?: ""),
        )
    }
}
