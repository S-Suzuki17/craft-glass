package com.craftglass.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final String VIRTUAL_HOST = "appassets.craftglass.local";
    private static final String START_URL = "https://" + VIRTUAL_HOST + "/index.html";
    private static final int REQ_CAMERA = 1001;
    private static final int REQ_FILE_CHOOSER = 1002;

    private WebView webView;
    private BillingManager billingManager;
    private PermissionRequest pendingPermissionRequest;
    private ValueCallback<Uri[]> filePathCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false);
        }
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 23) {
            View decor = window.getDecorView();
            int flags = decor.getSystemUiVisibility();
            decor.setSystemUiVisibility(flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#F4F9F6"));
        setContentView(webView);

        webView.setOnApplyWindowInsetsListener((v, insets) -> {
            int topPx = 0;
            int bottomPx = 0;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets sys = insets.getInsets(WindowInsets.Type.systemBars());
                topPx = sys.top;
                bottomPx = sys.bottom;
            } else {
                topPx = insets.getSystemWindowInsetTop();
                bottomPx = insets.getSystemWindowInsetBottom();
            }
            float density = getResources().getDisplayMetrics().density;
            int topDp = Math.round(topPx / Math.max(1f, density));
            int bottomDp = Math.round(bottomPx / Math.max(1f, density));
            String js = "document.documentElement.style.setProperty('--safe-top','" + topDp + "px');"
                    + "document.documentElement.style.setProperty('--safe-bottom','" + bottomDp + "px');";
            webView.post(() -> webView.evaluateJavascript(js, null));
            return insets;
        });

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);

        webView.addJavascriptInterface(new NativeBridge(), "CraftGlassNative");
        billingManager = new BillingManager(this, jsonPayload -> {
            if (webView != null) {
                String js = "typeof window.__onCraftGlassBillingUpdate==='function'&&window.__onCraftGlassBillingUpdate("
                        + org.json.JSONObject.quote(jsonPayload) + ");";
                webView.post(() -> webView.evaluateJavascript(js, null));
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (url == null || !VIRTUAL_HOST.equalsIgnoreCase(url.getHost())) {
                    // Block all third-party network loads inside WebView for strict privacy & offline integrity
                    return new WebResourceResponse(
                            "text/plain",
                            "utf-8",
                            403,
                            "Blocked",
                            null,
                            new ByteArrayInputStream(new byte[0])
                    );
                }
                String path = url.getPath();
                if (path == null || path.equals("/") || path.isEmpty()) {
                    path = "/index.html";
                }
                String assetPath = "www" + path;
                try {
                    InputStream is = getAssets().open(assetPath);
                    return new WebResourceResponse(guessMime(assetPath), "utf-8", is);
                } catch (Exception e) {
                    return new WebResourceResponse(
                            "text/plain",
                            "utf-8",
                            404,
                            "Not Found",
                            null,
                            new ByteArrayInputStream(new byte[0])
                    );
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (url != null && VIRTUAL_HOST.equalsIgnoreCase(url.getHost())) {
                    return false;
                }
                if (url != null && ("https".equalsIgnoreCase(url.getScheme()) || "http".equalsIgnoreCase(url.getScheme()))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, url));
                    } catch (Exception ignored) {
                    }
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    String[] resources = request.getResources();
                    boolean wantsCamera = false;
                    for (String r : resources) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                            wantsCamera = true;
                        }
                    }
                    if (!wantsCamera) {
                        request.deny();
                        return;
                    }
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        if (pendingPermissionRequest != null) {
                            pendingPermissionRequest.deny();
                        }
                        pendingPermissionRequest = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams fileChooserParams
            ) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    Intent intent = fileChooserParams.createIntent();
                    startActivityForResult(intent, REQ_FILE_CHOOSER);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }
        });

        webView.loadUrl(START_URL);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_CAMERA && pendingPermissionRequest != null) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted) {
                pendingPermissionRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                pendingPermissionRequest.deny();
            }
            pendingPermissionRequest = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_CHOOSER && filePathCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
        }
    }

    @Override
    protected void onDestroy() {
        if (billingManager != null) {
            billingManager.destroy();
            billingManager = null;
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                    "typeof window.__craftGlassBack==='function'?window.__craftGlassBack():false",
                    value -> {
                        if (!"true".equals(value)) {
                            runOnUiThread(() -> {
                                if (webView.canGoBack()) webView.goBack();
                                else MainActivity.super.onBackPressed();
                            });
                        }
                    }
            );
            return;
        }
        super.onBackPressed();
    }

    private static String guessMime(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".webmanifest")) return "application/manifest+json";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    private final class NativeBridge {
        @JavascriptInterface
        public void setKeepScreenOn(final boolean enabled) {
            runOnUiThread(() -> {
                if (enabled) {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }

        @JavascriptInterface
        public void vibrate(final int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    long dur = Math.max(5L, Math.min(300L, ms));
                    v.vibrate(VibrationEffect.createOneShot(dur, VibrationEffect.DEFAULT_AMPLITUDE));
                }
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void shareText(final String title, final String text) {
            runOnUiThread(() -> {
                try {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_SUBJECT, title != null ? title : "Craft Glass");
                    send.putExtra(Intent.EXTRA_TEXT, text != null ? text : "");
                    startActivity(Intent.createChooser(send, title != null ? title : "Share"));
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void shareBase64File(final String filename, final String mimeType, final String base64Data, final String title) {
            try {
                String safeName = new File(filename != null ? filename : "craft-proof.png").getName();
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                File sharedDir = new File(getCacheDir(), "shared");
                if (!sharedDir.exists()) sharedDir.mkdirs();
                File outFile = new File(sharedDir, safeName);
                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                    fos.write(bytes);
                }
                Uri contentUri = new Uri.Builder()
                        .scheme("content")
                        .authority(ShareFileProvider.AUTHORITY)
                        .appendPath(safeName)
                        .build();
                runOnUiThread(() -> {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType(mimeType != null && !mimeType.isEmpty() ? mimeType : "application/octet-stream");
                    send.putExtra(Intent.EXTRA_STREAM, contentUri);
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(send, title != null ? title : "Share"));
                });
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public boolean saveToDownloads(final String filename, final String mimeType, final String base64Data) {
            if (Build.VERSION.SDK_INT < 29) {
                return false;
            }
            try {
                String safeName = new File(filename != null ? filename : "craft-glass-export.bin").getName();
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                ContentResolver resolver = getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType != null && !mimeType.isEmpty() ? mimeType : "application/octet-stream");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/CraftGlass");
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) return false;
                try (OutputStream os = resolver.openOutputStream(uri)) {
                    if (os == null) return false;
                    os.write(bytes);
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void queryBillingProducts() {
            if (billingManager != null) {
                billingManager.queryAllProducts();
            }
        }

        @JavascriptInterface
        public void purchaseProduct(final String productId, final String productType) {
            if (billingManager != null) {
                runOnUiThread(() -> billingManager.launchPurchase(MainActivity.this, productId, productType));
            }
        }

        @JavascriptInterface
        public void restorePurchases() {
            if (billingManager != null) {
                billingManager.restorePurchases();
            }
        }

        @JavascriptInterface
        public String getAppInfo() {
            String verName = "1.0.0";
            long verCode = 1;
            try {
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                verName = info.versionName != null ? info.versionName : verName;
                verCode = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            } catch (Exception ignored) {
            }
            return "{\"platform\":\"android\",\"packageName\":\""
                    + getPackageName()
                    + "\",\"versionName\":\""
                    + verName
                    + "\",\"versionCode\":"
                    + verCode
                    + "}";
        }
    }
}
