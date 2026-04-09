package com.netronru.netroncomputer

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.netronru.netroncomputer.databinding.ActivityViewerBinding
import java.net.URLEncoder

class ViewerActivity : AppCompatActivity() {
    companion object {
        const val EXTRA_BASE_URL = "extra_base_url"
        const val EXTRA_TOKEN = "extra_token"
        const val EXTRA_LANGUAGE = "extra_language"
        const val EXTRA_AUDIO_ENABLED = "extra_audio_enabled"
    }

    private lateinit var binding: ActivityViewerBinding

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableImmersiveMode()
        binding = ActivityViewerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val baseUrl = intent.getStringExtra(EXTRA_BASE_URL).orEmpty()
        val token = intent.getStringExtra(EXTRA_TOKEN).orEmpty()
        val language = intent.getStringExtra(EXTRA_LANGUAGE).orEmpty().ifBlank { "en" }
        val audioEnabled = intent.getBooleanExtra(EXTRA_AUDIO_ENABLED, true)

        configureWebView(binding.viewerWebView)

        val viewerUrl = buildString {
            append("file:///android_asset/viewer.html")
            append("?baseUrl=")
            append(URLEncoder.encode(baseUrl, Charsets.UTF_8.name()))
            append("&token=")
            append(URLEncoder.encode(token, Charsets.UTF_8.name()))
            append("&lang=")
            append(URLEncoder.encode(language, Charsets.UTF_8.name()))
            append("&audio=")
            append(if (audioEnabled) "1" else "0")
        }

        binding.viewerWebView.loadUrl(viewerUrl)
    }

    override fun onResume() {
        super.onResume()
        enableImmersiveMode()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enableImmersiveMode()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(webView: WebView) {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = true
        webView.settings.allowContentAccess = true
        webView.settings.allowFileAccessFromFileURLs = true
        webView.settings.allowUniversalAccessFromFileURLs = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
    }

    private fun enableImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onDestroy() {
        binding.viewerWebView.destroy()
        super.onDestroy()
    }
}
