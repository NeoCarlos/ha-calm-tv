package io.github.neocarlos.hacalmtv

import android.content.Context
import android.net.Uri

/** Small settings shared by the home screen and the Home button service (same process). */
object Prefs {
    private const val FILE = "calmtv"
    private const val KEY_GOOGLE_HOME = "usingGoogleHome"
    private const val KEY_HA_URL = "haUrl"

    /**
     * True while you've switched to Google's home screen from Calm TV's Settings.
     * The Home button service leaves Google's home alone until you open Calm TV again.
     */
    fun usingGoogleHome(context: Context): Boolean =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(KEY_GOOGLE_HOME, false)

    fun setUsingGoogleHome(context: Context, value: Boolean) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(KEY_GOOGLE_HOME, value).apply()
    }

    /** Home Assistant's address, e.g. "http://192.168.1.20:8123" ("" until it's set up). */
    fun haUrl(context: Context): String =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY_HA_URL, "").orEmpty()

    /** Saves a cleaned-up address; returns it, or null if it isn't a plain http(s) address. */
    fun setHaUrl(context: Context, raw: String): String? {
        val url = normalizeUrl(raw) ?: return null
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(KEY_HA_URL, url).apply()
        return url
    }

    /** "192.168.1.20:8123/" → "http://192.168.1.20:8123". Only scheme, host and port are kept. */
    fun normalizeUrl(raw: String): String? {
        var s = raw.trim()
        if (s.isEmpty()) return null
        if (!s.contains("://")) s = "http://$s"
        val u = Uri.parse(s)
        if (u.scheme != "http" && u.scheme != "https") return null
        val host = u.host?.takeIf { it.isNotBlank() } ?: return null
        return "${u.scheme}://$host" + (if (u.port > 0) ":${u.port}" else "")
    }
}
