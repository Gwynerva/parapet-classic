package javax.microedition.media;

public interface Player {
    int UNREALIZED = 100;
    int REALIZED = 200;
    int PREFETCHED = 300;
    int STARTED = 400;
    int CLOSED = 0;
    long TIME_UNKNOWN = -1L;

    void realize() throws MediaException;

    void prefetch() throws MediaException;

    void start() throws MediaException;

    void stop() throws MediaException;

    void deallocate();

    void close();

    void setLoopCount(int count);

    int getState();

    long getDuration();

    long setMediaTime(long now) throws MediaException;

    long getMediaTime();

    String getContentType();

    void addPlayerListener(PlayerListener l);

    void removePlayerListener(PlayerListener l);

    Control getControl(String controlType);

    Control[] getControls();
}
