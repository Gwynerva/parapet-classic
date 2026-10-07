package com.nokia.mid.ui;

/** Headless stand-in: lights and vibration are ignored. */
public final class DeviceControl {
    private DeviceControl() {}

    public static void setLights(int num, int level) {}

    public static void flashLights(long duration) {}

    public static void startVibra(int freq, long duration) {}

    public static void stopVibra() {}
}
