package de.tobsob.geoquizarcade;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Vollbild („Immersive Mode") — App-Feedback: Status- und Navigationsleiste
 * fraßen oben und unten je einen Streifen weg, die App wirkte wie eine
 * Website im Browser statt wie ein Spielautomat.
 *
 * Bewusst NICHT über ein Theme-Flag (android:windowFullscreen) gelöst: das
 * versteckt nur die Statusleiste, die Navigationsleiste bleibt.
 */
public class MainActivity extends BridgeActivity {

    /** Höhe der Kamera-Aussparung in CSS-Pixeln; siehe publishCutoutInset(). */
    private int cutoutTopCssPx = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemBars();
        observeInsets();
    }

    /**
     * Android blendet die Leisten nach einigen Systemereignissen von sich aus
     * wieder ein (Benachrichtigungs-Shade, App-Wechsel, Berechtigungsdialog).
     * Ohne dieses erneute Verstecken bliebe die App danach im Fenstermodus,
     * bis man sie neu startet.
     */
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
            // Zweiter Anlauf für den Fall, dass die Insets schon anlagen,
            // bevor die Seite geladen war (siehe publishCutoutInset()).
            publishCutoutInset();
        }
    }

    private void hideSystemBars() {
        // Die WebView soll bis in jede Ecke reichen — auch unter die
        // Kamera-Aussparung, die das Theme per windowLayoutInDisplayCutoutMode
        // freigibt. Ohne das bekäme die WebView den Cutout als Inset und
        // darüber bliebe der Fenster-Hintergrund sichtbar (ein weißer Streifen,
        // weil das Capacitor-Theme von Theme.AppCompat.DayNight erbt).
        // Die Tastatur bleibt dank windowSoftInputMode="adjustResize" im
        // Manifest bedienbar.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());

        // Wischen von der Kante holt die Leisten kurz zurück und lässt sie
        // danach von selbst wieder verschwinden — der Nutzer kommt also
        // jederzeit an Uhr und Zurück-Geste, ohne das Spiel zu verlassen.
        // BEHAVIOR_DEFAULT würde sie stattdessen dauerhaft einblenden.
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);

        // Type.systemBars() = Status- + Navigationsleiste, ausdrücklich NICHT
        // die Tastatur (Type.ime()) — die Eingabefelder in Profil und
        // Gruppen-Panel funktionieren unverändert.
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }

    /**
     * Reicht die Höhe der Kamera-Aussparung als CSS-Variable an die Seite
     * durch.
     *
     * Warum nicht einfach `env(safe-area-inset-top)`: Die Android-WebView
     * meldet dafür 0, auch mit `viewport-fit=cover` und freigegebenem Cutout —
     * im Emulator (Pixel 7, 136 px Aussparung) nachgemessen, der Inhalt rutschte
     * um exakt die volle Aussparungshöhe nach oben statt stehen zu bleiben.
     * Ohne diesen Umweg läge die Kopfzeile also unter der Kamera.
     */
    private void observeInsets() {
        final View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, insets) -> {
            Insets cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            cutoutTopCssPx = Math.round(cutout.top / getResources().getDisplayMetrics().density);
            publishCutoutInset();

            // Tastatur: setDecorFitsSystemWindows(false) schaltet das
            // automatische Verkleinern des Fensters ab — das IME-Inset kommt
            // nur noch hier an und muss selbst angewendet werden. Ohne das
            // bleibt die WebView in voller Höhe, die Tastatur legt sich
            // darüber, und Chromium scrollt das fokussierte Feld nicht mehr
            // ins Bild (im Emulator gegen die Vorgängerversion nachgestellt:
            // Passwortfeld lag unter der Tastatur).
            int ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
            view.setPadding(0, 0, 0, ime);
            return insets;
        });
    }

    private void publishCutoutInset() {
        if (getBridge() == null) {
            return;
        }
        final WebView webView = getBridge().getWebView();
        if (webView == null) {
            return;
        }
        final String js =
                "document.documentElement.style.setProperty('--android-inset-top','"
                        + cutoutTopCssPx
                        + "px')";
        webView.post(new Runnable() {
            @Override
            public void run() {
                android.util.Log.d("GeoQuizInset", "inject url=" + webView.getUrl() + " js=" + js);
                webView.evaluateJavascript(js, null);
            }
        });
    }
}
