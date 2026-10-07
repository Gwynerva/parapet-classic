package com.nokia.mid.sound;

/** Headless stand-in for the Nokia 1.x sound API: plays nothing. */
public class Sound {
    public static final int FORMAT_TONE = 1;
    public static final int FORMAT_WAV = 5;
    public static final int SOUND_PLAYING = 0;
    public static final int SOUND_STOPPED = 1;
    public static final int SOUND_UNINITIALIZED = 3;

    private int state = SOUND_STOPPED;
    private int gain = 255;

    public Sound(byte[] data, int type) {}

    public Sound(int freq, long duration) {}

    public void init(byte[] data, int type) {}

    public void init(int freq, long duration) {}

    public void play(int loop) {
        state = SOUND_PLAYING;
    }

    public void stop() {
        state = SOUND_STOPPED;
    }

    public void resume() {}

    public void release() {
        state = SOUND_UNINITIALIZED;
    }

    public int getState() {
        return state;
    }

    public void setGain(int g) {
        gain = g;
    }

    public int getGain() {
        return gain;
    }

    public static int getConcurrentSoundCount(int type) {
        return 1;
    }

    public static int[] getSupportedFormats() {
        return new int[] {FORMAT_TONE, FORMAT_WAV};
    }
}
