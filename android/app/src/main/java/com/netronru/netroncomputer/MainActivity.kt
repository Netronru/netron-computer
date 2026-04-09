package com.netronru.netroncomputer

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.view.LayoutInflater
import android.view.WindowManager
import android.widget.ArrayAdapter
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import com.netronru.netroncomputer.databinding.ActivityMainBinding
import com.netronru.netroncomputer.databinding.DialogLoginBinding
import com.netronru.netroncomputer.databinding.DialogSettingsBinding
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var appSettings: AppSettings
    private var vpnWarningDialog: AlertDialog? = null
    private var settings: StoredSettings = StoredSettings(
        host = "127.0.0.1",
        port = 3001,
        autoSearch = true,
        language = AppLanguage.EN,
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableImmersiveMode()
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        appSettings = AppSettings(this)
        settings = appSettings.load()

        binding.connectButton.setOnClickListener {
            startConnectFlow()
        }
        binding.settingsButton.setOnClickListener {
            openSettingsDialog()
        }

        applyLanguage()
    }

    override fun onResume() {
        super.onResume()
        enableImmersiveMode()
        showVpnWarningIfNeeded()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enableImmersiveMode()
        }
    }

    private fun applyLanguage() {
        title = UiStrings.appTitle(settings.language)
        binding.titleText.text = UiStrings.appTitle(settings.language)
        binding.connectButton.text = UiStrings.connect(settings.language)
        binding.statusText.text = UiStrings.connectIdle(settings.language)
    }

    private fun enableImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun showVpnWarningIfNeeded() {
        if (!isVpnEnabled()) {
            vpnWarningDialog?.dismiss()
            vpnWarningDialog = null
            return
        }

        if (vpnWarningDialog?.isShowing == true) {
            return
        }

        vpnWarningDialog = AlertDialog.Builder(this)
            .setTitle(UiStrings.vpnWarningTitle(settings.language))
            .setMessage(UiStrings.vpnWarningMessage(settings.language))
            .setPositiveButton(UiStrings.ok(settings.language), null)
            .create()

        vpnWarningDialog?.show()
    }

    private fun isVpnEnabled(): Boolean {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
    }

    private fun startConnectFlow() {
        binding.connectButton.isEnabled = false
        binding.statusText.text = UiStrings.connectSearching(settings.language)

        lifecycleScope.launch {
            runCatching {
                Discovery.discover(settings)
            }.onSuccess { endpoint ->
                binding.connectButton.isEnabled = true
                binding.statusText.text = UiStrings.connectIdle(settings.language)
                openLoginDialog(endpoint)
            }.onFailure {
                binding.connectButton.isEnabled = true
                binding.statusText.text = UiStrings.connectFailed(settings.language)
            }
        }
    }

    private fun openLoginDialog(endpoint: ServerEndpoint) {
        val dialogBinding = DialogLoginBinding.inflate(LayoutInflater.from(this))
        val dialog = AlertDialog.Builder(this)
            .setView(dialogBinding.root)
            .setCancelable(true)
            .create()
        dialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        dialogBinding.loginTitle.text = UiStrings.signIn(settings.language)
        dialogBinding.usernameLabel.text = UiStrings.username(settings.language)
        dialogBinding.passwordLabel.text = UiStrings.password(settings.language)
        dialogBinding.cancelButton.text = UiStrings.back(settings.language)
        dialogBinding.openButton.text = UiStrings.open(settings.language)
        dialogBinding.usernameInput.setText("admin")
        dialogBinding.passwordInput.setText("admin")

        dialogBinding.cancelButton.setOnClickListener {
            dialog.dismiss()
        }

        dialogBinding.openButton.setOnClickListener {
            dialogBinding.statusText.text = UiStrings.loginInProgress(settings.language)
            lifecycleScope.launch {
                runCatching {
                    Discovery.login(
                        endpoint = endpoint,
                        username = dialogBinding.usernameInput.text?.toString().orEmpty(),
                        password = dialogBinding.passwordInput.text?.toString().orEmpty(),
                    )
                }.onSuccess { login ->
                    dialog.dismiss()
                    openViewer(endpoint.baseUrl, login.token, login.audioEnabled)
                }.onFailure {
                    dialogBinding.statusText.text = UiStrings.loginFailed(settings.language)
                }
            }
        }

        dialog.show()
    }

    private fun openViewer(baseUrl: String, token: String, audioEnabled: Boolean) {
        startActivity(
            Intent(this, ViewerActivity::class.java)
                .putExtra(ViewerActivity.EXTRA_BASE_URL, baseUrl)
                .putExtra(ViewerActivity.EXTRA_TOKEN, token)
                .putExtra(ViewerActivity.EXTRA_LANGUAGE, settings.language.code())
                .putExtra(ViewerActivity.EXTRA_AUDIO_ENABLED, audioEnabled),
        )
    }

    private fun openSettingsDialog() {
        val dialogBinding = DialogSettingsBinding.inflate(LayoutInflater.from(this))
        val dialog = AlertDialog.Builder(this)
            .setView(dialogBinding.root)
            .setCancelable(true)
            .create()
        dialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        val languageOptions = listOf(
            AppLanguage.EN to UiStrings.english(settings.language),
            AppLanguage.RU to UiStrings.russian(settings.language),
            AppLanguage.ES to UiStrings.spanish(settings.language),
        )

        dialogBinding.settingsTitle.text = UiStrings.settings(settings.language)
        dialogBinding.languageLabel.text = UiStrings.language(settings.language)
        dialogBinding.autoSearchLabel.text = UiStrings.autoSearch(settings.language)
        dialogBinding.hostLabel.text = UiStrings.host(settings.language)
        dialogBinding.portLabel.text = UiStrings.port(settings.language)
        dialogBinding.applyButton.text = UiStrings.apply(settings.language)
        dialogBinding.closeButton.text = UiStrings.close(settings.language)
        dialogBinding.autoSearchToggle.isChecked = settings.autoSearch
        dialogBinding.hostInput.setText(settings.host)
        dialogBinding.portInput.setText(settings.port.toString())

        dialogBinding.languageSpinner.adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            languageOptions.map { it.second },
        )
        dialogBinding.languageSpinner.setSelection(
            languageOptions.indexOfFirst { it.first == settings.language }.coerceAtLeast(0),
        )

        dialogBinding.closeButton.setOnClickListener {
            dialog.dismiss()
        }

        dialogBinding.applyButton.setOnClickListener {
            val selectedLanguage = languageOptions[dialogBinding.languageSpinner.selectedItemPosition].first
            val selectedPort = dialogBinding.portInput.text?.toString()?.toIntOrNull() ?: 3001
            settings = settings.copy(
                host = dialogBinding.hostInput.text?.toString().orEmpty().ifBlank { "127.0.0.1" },
                port = selectedPort,
                autoSearch = dialogBinding.autoSearchToggle.isChecked,
                language = selectedLanguage,
            )
            appSettings.save(settings)
            applyLanguage()
            dialog.dismiss()
        }

        dialog.show()
    }
}
