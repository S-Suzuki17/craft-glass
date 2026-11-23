package com.craftglass.app;

import android.app.Activity;
import android.content.Context;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Google Play Billing Library 7.1.1 integration for Craft Pro subscriptions & one-time lifetime unlock.
 */
public final class BillingManager {
    public interface Listener {
        void onBillingUpdate(String jsonPayload);
    }

    private static final List<String> SUBS_IDS = Arrays.asList("craft_pro_yearly", "craft_pro_monthly");
    private static final List<String> INAPP_IDS = Arrays.asList("craft_pro_lifetime");

    private final BillingClient client;
    private final Listener listener;
    private final Map<String, ProductDetails> productMap = new HashMap<>();
    private boolean connected = false;
    private boolean isPro = false;
    private String activeSku = null;

    public BillingManager(Context context, Listener listener) {
        this.listener = listener;
        PendingPurchasesParams pendingParams = PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .enablePrepaidPlans()
                .build();
        this.client = BillingClient.newBuilder(context.getApplicationContext())
                .enablePendingPurchases(pendingParams)
                .setListener((billingResult, purchases) -> {
                    if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
                        handlePurchases(purchases, "purchase");
                    } else {
                        emitUpdate("purchase_cancel", billingResult.getDebugMessage());
                    }
                })
                .build();
        connectAndRefresh("init");
    }

    public void connectAndRefresh(final String action) {
        if (client.isReady()) {
            queryAllProducts();
            queryActivePurchases(action);
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    connected = true;
                    queryAllProducts();
                    queryActivePurchases(action);
                } else {
                    connected = false;
                    emitUpdate(action, billingResult.getDebugMessage());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                connected = false;
            }
        });
    }

    public void queryAllProducts() {
        if (!client.isReady()) {
            connectAndRefresh("query");
            return;
        }
        queryCatalog(SUBS_IDS, BillingClient.ProductType.SUBS);
        queryCatalog(INAPP_IDS, BillingClient.ProductType.INAPP);
    }

    private void queryCatalog(List<String> ids, String type) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String id : ids) {
            products.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(type)
                    .build());
        }
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(products)
                .build();
        client.queryProductDetailsAsync(params, (result, list) -> {
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null) {
                synchronized (productMap) {
                    for (ProductDetails pd : list) {
                        productMap.put(pd.getProductId(), pd);
                    }
                }
                emitUpdate("catalog", "");
            }
        });
    }

    public void restorePurchases() {
        connectAndRefresh("restore");
    }

    private void queryActivePurchases(final String action) {
        if (!client.isReady()) return;
        final List<Purchase> collected = new ArrayList<>();
        client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (res1, subsPurchases) -> {
                    if (res1.getResponseCode() == BillingClient.BillingResponseCode.OK && subsPurchases != null) {
                        collected.addAll(subsPurchases);
                    }
                    client.queryPurchasesAsync(
                            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                            (res2, inappPurchases) -> {
                                if (res2.getResponseCode() == BillingClient.BillingResponseCode.OK && inappPurchases != null) {
                                    collected.addAll(inappPurchases);
                                }
                                handlePurchases(collected, action);
                            }
                    );
                }
        );
    }

    private void handlePurchases(List<Purchase> purchases, String action) {
        boolean foundPro = false;
        String foundSku = null;
        for (Purchase p : purchases) {
            if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                if (!p.isAcknowledged()) {
                    AcknowledgePurchaseParams ack = AcknowledgePurchaseParams.newBuilder()
                            .setPurchaseToken(p.getPurchaseToken())
                            .build();
                    client.acknowledgePurchase(ack, result -> { });
                }
                for (String pid : p.getProducts()) {
                    if (SUBS_IDS.contains(pid) || INAPP_IDS.contains(pid)) {
                        foundPro = true;
                        foundSku = pid;
                    }
                }
            }
        }
        this.isPro = foundPro;
        this.activeSku = foundSku;
        emitUpdate(action, "");
    }

    public void launchPurchase(Activity activity, String productId, String productType) {
        if (activity == null) return;
        if (!client.isReady()) {
            connectAndRefresh("query");
            emitUpdate("purchase_error", "Billing service connecting, please retry.");
            return;
        }
        ProductDetails pd;
        synchronized (productMap) {
            pd = productMap.get(productId);
        }
        if (pd == null) {
            queryAllProducts();
            emitUpdate("purchase_error", "Product catalog loading or SKU not yet configured in Play Console.");
            return;
        }

        BillingFlowParams.ProductDetailsParams.Builder prodBuilder =
                BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd);

        if (BillingClient.ProductType.SUBS.equals(productType) || pd.getSubscriptionOfferDetails() != null) {
            List<ProductDetails.SubscriptionOfferDetails> offers = pd.getSubscriptionOfferDetails();
            if (offers != null && !offers.isEmpty()) {
                prodBuilder.setOfferToken(offers.get(0).getOfferToken());
            }
        }

        BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Arrays.asList(prodBuilder.build()))
                .build();
        client.launchBillingFlow(activity, flowParams);
    }

    private void emitUpdate(String action, String message) {
        if (listener == null) return;
        try {
            JSONObject obj = new JSONObject();
            obj.put("connected", connected);
            obj.put("action", action);
            obj.put("isPro", isPro);
            if (activeSku != null) obj.put("activeSku", activeSku);
            if (message != null && !message.isEmpty()) obj.put("message", message);

            JSONArray arr = new JSONArray();
            synchronized (productMap) {
                for (ProductDetails pd : productMap.values()) {
                    JSONObject item = new JSONObject();
                    item.put("productId", pd.getProductId());
                    item.put("title", pd.getTitle());
                    String price = "";
                    if (pd.getOneTimePurchaseOfferDetails() != null) {
                        price = pd.getOneTimePurchaseOfferDetails().getFormattedPrice();
                    } else if (pd.getSubscriptionOfferDetails() != null && !pd.getSubscriptionOfferDetails().isEmpty()) {
                        List<ProductDetails.PricingPhase> phases =
                                pd.getSubscriptionOfferDetails().get(0).getPricingPhases().getPricingPhaseList();
                        if (!phases.isEmpty()) {
                            price = phases.get(phases.size() - 1).getFormattedPrice();
                        }
                    }
                    item.put("price", price);
                    arr.put(item);
                }
            }
            obj.put("products", arr);
            listener.onBillingUpdate(obj.toString());
        } catch (Exception ignored) {
        }
    }

    public void destroy() {
        try {
            client.endConnection();
        } catch (Exception ignored) {
        }
    }
}
