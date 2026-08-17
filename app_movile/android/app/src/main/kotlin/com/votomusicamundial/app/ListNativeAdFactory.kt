package com.votomusicamundial.app

import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import com.google.android.gms.ads.nativead.MediaView
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdView
import io.flutter.plugins.googlemobileads.NativeAdFactory

class ListNativeAdFactory(
    private val layoutInflater: LayoutInflater,
) : NativeAdFactory {
    override fun createNativeAd(
        nativeAd: NativeAd,
        customOptions: MutableMap<String, Any>?,
    ): NativeAdView {
        val adView = layoutInflater.inflate(
            R.layout.list_native_ad,
            null,
        ) as NativeAdView

        val mediaView = adView.findViewById<MediaView>(R.id.ad_media)
        val headlineView = adView.findViewById<TextView>(R.id.ad_headline)
        val bodyView = adView.findViewById<TextView>(R.id.ad_body)
        val callToActionView = adView.findViewById<Button>(R.id.ad_call_to_action)
        val iconView = adView.findViewById<ImageView>(R.id.ad_app_icon)
        val advertiserView = adView.findViewById<TextView>(R.id.ad_advertiser)

        adView.mediaView = mediaView
        adView.headlineView = headlineView
        adView.bodyView = bodyView
        adView.callToActionView = callToActionView
        adView.iconView = iconView
        adView.advertiserView = advertiserView

        headlineView.text = nativeAd.headline
        mediaView.mediaContent = nativeAd.mediaContent

        if (nativeAd.body.isNullOrEmpty()) {
            bodyView.visibility = View.GONE
        } else {
            bodyView.visibility = View.VISIBLE
            bodyView.text = nativeAd.body
        }

        if (nativeAd.callToAction.isNullOrEmpty()) {
            callToActionView.visibility = View.GONE
        } else {
            callToActionView.visibility = View.VISIBLE
            callToActionView.text = nativeAd.callToAction
        }

        val icon = nativeAd.icon
        if (icon == null) {
            iconView.visibility = View.GONE
        } else {
            iconView.visibility = View.VISIBLE
            iconView.setImageDrawable(icon.drawable)
        }

        if (nativeAd.advertiser.isNullOrEmpty()) {
            advertiserView.visibility = View.GONE
        } else {
            advertiserView.visibility = View.VISIBLE
            advertiserView.text = nativeAd.advertiser
        }

        adView.setNativeAd(nativeAd)
        return adView
    }
}
