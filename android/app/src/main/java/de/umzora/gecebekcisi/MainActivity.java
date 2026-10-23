package de.umzora.gecebekcisi;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

/**
 * Gece Bekcisi kabugu.
 *
 * Isi tek: sayfayi kendi penceresinde acmak ve ekranin kapanmasini
 * engellemek. Algilama, alarm ve Pushover katmani sayfanin kendisinde -
 * boylece sayfa guncellendiginde APK'yi yeniden kurmak gerekmiyor.
 */
public class MainActivity extends Activity {

    private static final String ADRES = "https://umzora.github.io/gece-bekcisi/?app=1";
    private static final String SUNUCU = "umzora.github.io";
    private static final int IZIN_KODU = 41;

    private WebView web;

    @Override
    protected void onCreate(Bundle durum) {
        super.onCreate(durum);

        // Ekran, uygulama ondeyken kapanmaz. Tarayicidaki Wake Lock'un aksine
        // bunu pil tasarrufu ya da sistem karari geri alamaz.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        setContentView(web);

        WebSettings a = web.getSettings();
        a.setJavaScriptEnabled(true);
        a.setDomStorageEnabled(true);   // localStorage: butun ayarlar burada duruyor
        a.setDatabaseEnabled(true);
        a.setMediaPlaybackRequiresUserGesture(false);
        a.setAllowFileAccess(false);
        a.setAllowContentAccess(false);

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest istek) {
                // Sayfaya yalnizca kamera ve mikrofon veriliyor, baska hicbir sey.
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        List<String> verilen = new ArrayList<>();
                        for (String kaynak : istek.getResources()) {
                            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(kaynak)
                                    || PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(kaynak)) {
                                verilen.add(kaynak);
                            }
                        }
                        if (verilen.isEmpty()) {
                            istek.deny();
                        } else {
                            istek.grant(verilen.toArray(new String[0]));
                        }
                    }
                });
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest istek) {
                Uri u = istek.getUrl();
                if (SUNUCU.equals(u.getHost())) {
                    return false;               // kendi sayfamiz uygulamada kalir
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (ActivityNotFoundException yok) {
                    Toast.makeText(MainActivity.this,
                            "Bu adresi acacak uygulama yok", Toast.LENGTH_SHORT).show();
                }
                return true;                   // digerleri tarayiciya
            }
        });

        izinleriIste();

        if (durum != null) {
            web.restoreState(durum);
        } else {
            web.loadUrl(ADRES);
        }
    }

    private void izinleriIste() {
        List<String> eksik = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            eksik.add(Manifest.permission.CAMERA);
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            eksik.add(Manifest.permission.RECORD_AUDIO);
        }
        if (!eksik.isEmpty()) {
            requestPermissions(eksik.toArray(new String[0]), IZIN_KODU);
        }
    }

    @Override
    public void onRequestPermissionsResult(int kod, String[] izinler, int[] sonuclar) {
        super.onRequestPermissionsResult(kod, izinler, sonuclar);
        if (kod != IZIN_KODU) {
            return;
        }
        for (int i = 0; i < izinler.length; i++) {
            if (sonuclar[i] != PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this,
                        "Kamera ve mikrofon izni verilmezse izleme yapilamaz",
                        Toast.LENGTH_LONG).show();
                return;
            }
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle disari) {
        super.onSaveInstanceState(disari);
        web.saveState(disari);
    }

    @Override
    public void onBackPressed() {
        // Yanlislikla geri tusuna basilinca uygulama KAPANMASIN: kapanirsa
        // izleme durur. Onun yerine arka plana aliyoruz.
        if (web.canGoBack()) {
            web.goBack();
        } else {
            moveTaskToBack(true);
        }
    }
}
