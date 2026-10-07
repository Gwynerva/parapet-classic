package javax.microedition.midlet;

/** Headless stand-in for the MIDP MIDlet base class. Lifecycle calls are no-ops. */
public abstract class MIDlet {
    protected MIDlet() {}

    protected abstract void startApp() throws MIDletStateChangeException;

    protected abstract void pauseApp();

    protected abstract void destroyApp(boolean unconditional) throws MIDletStateChangeException;

    public final void notifyDestroyed() {}

    public final void notifyPaused() {}

    public final void resumeRequest() {}

    public final String getAppProperty(String key) {
        return null;
    }
}
