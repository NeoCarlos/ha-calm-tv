package io.github.neocarlos.hacalmtv

import android.graphics.Bitmap
import android.webkit.WebChromeClient

/**
 * Hides Android's grey play-button placeholder, which the web view otherwise shows behind a
 * video (a camera saying "Connecting…", the doorbell window, a video background) until its first
 * frame arrives. A transparent pixel lets the page's own black background show instead.
 */
open class NoPosterChromeClient : WebChromeClient() {
    override fun getDefaultVideoPoster(): Bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
}
