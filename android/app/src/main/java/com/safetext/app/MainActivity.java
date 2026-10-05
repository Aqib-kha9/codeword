package com.safetext.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Apna native "FloatingBubble" plugin register karo — ii se
        // window.Capacitor.Plugins.FloatingBubble JS me mil jai.
        registerPlugin(FloatingBubblePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
