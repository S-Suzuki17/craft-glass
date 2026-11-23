package com.craftglass.app;

import android.app.Activity;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.View;
import android.widget.FrameLayout;

import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Google Mobile Ads (play-services-ads-lite 25.3.0) + UMP 4.0.0 Consent integration.
 * - Free tier: Non-focus anchored adaptive bottom banner + optional Rewarded Ad for +1 HD Craft Pass.
 * - Craft Pro: 100% Ad-Free (banner destroyed & hidden immediately).
 * - Focus Room active timer: Banner suppressed so concentration is never disturbed.
 */
public final class AdManager {
    public interface Listener {
        void onAdEvent(String jsonPayload);
        void onBannerVisibilityChanged(boolean visible);
    }

    // Official Google AdMob Test Ad Unit IDs (replace before Production rollout; see android/admob-config.json)
    public static final String BANNER_AD_UNIT_ID = "ca-app-pub-3940256099942544/9214589741";
    public static final String REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";

    private final Activity activity;
    private final FrameLayout bannerContainer;
    private final Listener listener;
    private final AtomicBoolean sdkInitialized = new AtomicBoolean(false);

    private AdView adView;
    private RewardedAd rewardedAd;
    private boolean isPro = false;
    private boolean focusSuppressed = false;
    private boolean bannerLoaded = false;

    public AdManager(Activity activity, FrameLayout bannerContainer, Listener listener) {
        this.activity = activity;
        this.bannerContainer = bannerContainer;
        this.listener = listener;
        startConsentAndInit();
    }

    private void startConsentAndInit() {
        try {
            final ConsentInformation consentInfo = UserMessagingPlatform.getConsentInformation(activity);
            ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
            consentInfo.requestConsentInfoUpdate(
                    activity,
                    params,
                    () -> {
                        try {
                            UserMessagingPlatform.loadAndShowConsentFormIfRequired(
                                    activity,
                                    formError -> {
                                        if (consentInfo.canRequestAds()) {
                                            initMobileAdsSdk();
                                        }
                                    }
                            );
                        } catch (Throwable ignored) {
                            initMobileAdsSdk();
                        }
                    },
                    requestConsentError -> {
                        if (consentInfo.canRequestAds()) {
                            initMobileAdsSdk();
                        } else {
                            // Fallback initialize in non-EEA or offline test contexts
                            initMobileAdsSdk();
                        }
                    }
            );
            if (consentInfo.canRequestAds()) {
                initMobileAdsSdk();
            }
        } catch (Throwable ignored) {
            initMobileAdsSdk();
        }
    }

    private void initMobileAdsSdk() {
        if (!sdkInitialized.compareAndSet(false, true)) {
            return;
        }
        try {
            MobileAds.initialize(activity, initializationStatus -> activity.runOnUiThread(() -> {
                refreshBannerState();
                preloadRewardedAd();
            }));
        } catch (Throwable ignored) {
        }
    }

    public void setProActive(boolean pro) {
        activity.runOnUiThread(() -> {
            if (this.isPro == pro) return;
            this.isPro = pro;
            if (pro) {
                destroyBanner();
                rewardedAd = null;
            }
            refreshBannerState();
        });
    }

    public void setFocusSuppressed(boolean suppressed) {
        activity.runOnUiThread(() -> {
            if (this.focusSuppressed == suppressed) return;
            this.focusSuppressed = suppressed;
            refreshBannerState();
        });
    }

    private void refreshBannerState() {
        if (isPro || focusSuppressed) {
            if (bannerContainer.getVisibility() != View.GONE) {
                bannerContainer.setVisibility(View.GONE);
                if (listener != null) listener.onBannerVisibilityChanged(false);
            }
            return;
        }
        if (!sdkInitialized.get()) return;

        bannerContainer.setVisibility(View.VISIBLE);
        if (listener != null) listener.onBannerVisibilityChanged(true);

        if (adView == null) {
            bannerContainer.post(this::loadAdaptiveBanner);
        }
    }

    private void loadAdaptiveBanner() {
        if (isPro || focusSuppressed) return;
        try {
            adView = new AdView(activity);
            adView.setAdUnitId(BANNER_AD_UNIT_ID);
            adView.setAdSize(computeAdaptiveSize());
            bannerContainer.removeAllViews();
            bannerContainer.addView(adView);
            AdRequest request = new AdRequest.Builder().build();
            adView.loadAd(request);
            bannerLoaded = true;
        } catch (Throwable ignored) {
        }
    }

    private AdSize computeAdaptiveSize() {
        Display display = activity.getWindowManager().getDefaultDisplay();
        DisplayMetrics outMetrics = new DisplayMetrics();
        display.getMetrics(outMetrics);
        float density = Math.max(1f, outMetrics.density);
        float adWidthPx = bannerContainer.getWidth();
        if (adWidthPx <= 0) {
            adWidthPx = outMetrics.widthPixels;
        }
        int adWidthDp = Math.max(320, (int) (adWidthPx / density));
        return AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, adWidthDp);
    }

    public void preloadRewardedAd() {
        if (isPro || !sdkInitialized.get() || rewardedAd != null) return;
        try {
            AdRequest request = new AdRequest.Builder().build();
            RewardedAd.load(
                    activity,
                    REWARDED_AD_UNIT_ID,
                    request,
                    new RewardedAdLoadCallback() {
                        @Override
                        public void onAdLoaded(RewardedAd ad) {
                            rewardedAd = ad;
                        }

                        @Override
                        public void onAdFailedToLoad(LoadAdError loadAdError) {
                            rewardedAd = null;
                        }
                    }
            );
        } catch (Throwable ignored) {
        }
    }

    public void showRewardedAd() {
        activity.runOnUiThread(() -> {
            if (isPro) return;
            if (rewardedAd == null) {
                preloadRewardedAd();
                emitEvent("{\"type\":\"rewarded_unavailable\"}");
                return;
            }
            try {
                RewardedAd ad = rewardedAd;
                rewardedAd = null;
                ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                    @Override
                    public void onAdDismissedFullScreenContent() {
                        preloadRewardedAd();
                    }
                });
                ad.show(activity, rewardItem -> {
                    emitEvent("{\"type\":\"rewarded\",\"amount\":1}");
                });
            } catch (Throwable ignored) {
                preloadRewardedAd();
                emitEvent("{\"type\":\"rewarded_unavailable\"}");
            }
        });
    }

    private void emitEvent(String json) {
        if (listener != null) {
            listener.onAdEvent(json);
        }
    }

    private void destroyBanner() {
        try {
            if (adView != null) {
                adView.destroy();
                adView = null;
            }
            bannerContainer.removeAllViews();
            bannerLoaded = false;
        } catch (Throwable ignored) {
        }
    }

    public void onResume() {
        try {
            if (adView != null && !isPro && !focusSuppressed) adView.resume();
        } catch (Throwable ignored) {
        }
    }

    public void onPause() {
        try {
            if (adView != null) adView.pause();
        } catch (Throwable ignored) {
        }
    }

    public void onDestroy() {
        destroyBanner();
        rewardedAd = null;
    }
}
