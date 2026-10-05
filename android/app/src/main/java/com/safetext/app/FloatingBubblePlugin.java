package com.safetext.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * "FloatingBubble" plugin — side me tairta taala (overlay bubble) chalu/band
 * kare khatir. Ii plugin FloatingBubbleService ke saath kaam karela.
 *
 * JS se: window.Capacitor.Plugins.FloatingBubble.{hasPermission, requestPermission, show, hide}
 */
@CapacitorPlugin(name = "FloatingBubble")
public class FloatingBubblePlugin extends Plugin {

    /** "Display over other apps" permission ba ki na. */
    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", canDrawOverlays());
        call.resolve(ret);
    }

    /** Permission mange khatir system ke settings screen khol de. */
    @PluginMethod
    public void requestPermission(PluginCall call) {
        boolean granted = canDrawOverlays();

        // Android 13+ pe notification permission bhi mange — taaki bubble ke
        // foreground notification dikhe.
        requestNotificationPermissionIfNeeded();

        if (!granted) {
            try {
                Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception e) {
                // ignore — user hath se settings me ja ke de sakela
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < 33) return;
        try {
            Activity activity = getActivity();
            if (activity == null) return;
            if (activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    activity,
                    new String[] { Manifest.permission.POST_NOTIFICATIONS },
                    9911
                );
            }
        } catch (Exception e) {
            // ignore
        }
    }

    /** Bubble (foreground service) chalu kar de. */
    @PluginMethod
    public void show(PluginCall call) {
        if (!canDrawOverlays()) {
            JSObject ret = new JSObject();
            ret.put("showing", false);
            ret.put("reason", "permission");
            call.resolve(ret);
            return;
        }
        try {
            Intent intent = new Intent(getContext(), FloatingBubbleService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            JSObject ret = new JSObject();
            ret.put("showing", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Bubble na chalu ho paal: " + e.getMessage());
        }
    }

    /** Bubble band kar de. */
    @PluginMethod
    public void hide(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), FloatingBubbleService.class);
            intent.setAction(FloatingBubbleService.ACTION_STOP);
            getContext().startService(intent);
        } catch (Exception e) {
            // ignore
        }
        JSObject ret = new JSObject();
        ret.put("showing", false);
        call.resolve(ret);
    }

    private boolean canDrawOverlays() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.canDrawOverlays(getContext());
        }
        return true;
    }
}
