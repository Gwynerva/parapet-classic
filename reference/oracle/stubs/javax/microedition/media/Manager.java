package javax.microedition.media;

import java.io.IOException;
import java.io.InputStream;
import javax.microedition.media.control.VolumeControl;

/** Headless stand-in: every createPlayer returns a silent dummy Player. */
public final class Manager {
    public static final String TONE_DEVICE_LOCATOR = "device://tone";

    private Manager() {}

    public static Player createPlayer(InputStream stream, String type) throws IOException, MediaException {
        return new DummyPlayer();
    }

    public static Player createPlayer(String locator) throws IOException, MediaException {
        return new DummyPlayer();
    }

    public static String[] getSupportedContentTypes(String protocol) {
        return new String[] {"audio/midi"};
    }

    public static String[] getSupportedProtocols(String contentType) {
        return new String[0];
    }

    public static void playTone(int note, int duration, int volume) throws MediaException {}

    /** Silent player whose only state is the loop count and the volume level. */
    static final class DummyPlayer implements Player, VolumeControl {
        private int state = UNREALIZED;
        private int level = 100;
        private boolean muted;

        public void realize() {
            if (state == UNREALIZED) state = REALIZED;
        }

        public void prefetch() {
            if (state < PREFETCHED) state = PREFETCHED;
        }

        public void start() {
            state = STARTED;
        }

        public void stop() {
            if (state == STARTED) state = PREFETCHED;
        }

        public void deallocate() {
            state = REALIZED;
        }

        public void close() {
            state = CLOSED;
        }

        public void setLoopCount(int count) {}

        public int getState() {
            return state;
        }

        public long getDuration() {
            return TIME_UNKNOWN;
        }

        public long setMediaTime(long now) {
            return 0;
        }

        public long getMediaTime() {
            return 0;
        }

        public String getContentType() {
            return "audio/midi";
        }

        public void addPlayerListener(PlayerListener l) {}

        public void removePlayerListener(PlayerListener l) {}

        public Control getControl(String controlType) {
            return this;
        }

        public Control[] getControls() {
            return new Control[] {this};
        }

        public void setMute(boolean mute) {
            muted = mute;
        }

        public boolean isMuted() {
            return muted;
        }

        public int setLevel(int l) {
            level = Math.max(0, Math.min(100, l));
            return level;
        }

        public int getLevel() {
            return level;
        }
    }
}
