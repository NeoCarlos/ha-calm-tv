package io.github.neocarlos.hacalmtv

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Finds calm-tv.json, the file that describes a home (rooms, devices, apps, calendars...).
 *
 * 1. Home Assistant's www folder, served at http://<ha>/local/calm-tv.json. Edit it in HA
 *    (e.g. with the File editor add-on) and reopen Calm TV. No rebuild, no computer.
 * 2. A file pushed onto the TV:
 *      adb push calm-tv.json /sdcard/Android/data/io.github.neocarlos.hacalmtv/files/calm-tv.json
 *
 * The page keeps the last good copy, so a home still shows if both are briefly unreachable.
 */
object ConfigFile {
    private const val TAG = "CalmTV"
    const val NAME = "calm-tv.json"
    private const val MAX_BYTES = 512 * 1024

    fun load(context: Context, haUrl: String): JSONObject {
        val errors = mutableListOf<String>()
        if (haUrl.isNotEmpty()) {
            try {
                val text = fetch("$haUrl/local/$NAME?t=${System.currentTimeMillis()}")
                if (text != null) return result("Home Assistant", text)
                errors.add("not in Home Assistant's www folder")
            } catch (e: Exception) {
                Log.w(TAG, "Config from Home Assistant failed", e)
                errors.add("Home Assistant: ${e.javaClass.simpleName}")
            }
        }
        val file = context.getExternalFilesDir(null)?.let { File(it, NAME) }
        if (file != null && file.isFile) {
            return try {
                result("this TV", file.readText().take(MAX_BYTES))
            } catch (e: Exception) {
                Log.w(TAG, "Config file on the TV unreadable", e)
                JSONObject().put("error", "The file on the TV couldn't be read")
            }
        }
        errors.add("no file on the TV")
        return JSONObject().put("error", errors.joinToString("; "))
    }

    private fun result(source: String, text: String) = JSONObject().put("source", source).put("text", text)

    /** The file's text, or null if Home Assistant says it doesn't exist. */
    private fun fetch(url: String): String? {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 4000
        c.readTimeout = 4000
        c.useCaches = false
        try {
            if (c.responseCode == 404) return null
            if (c.responseCode != 200) throw IllegalStateException("HTTP ${c.responseCode}")
            return c.inputStream.use { s -> String(s.readNBytes(MAX_BYTES)) }
        } finally {
            c.disconnect()
        }
    }
}
