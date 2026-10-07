package javax.microedition.lcdui;

import javax.microedition.midlet.MIDlet;

/** Headless stand-in: one display, nothing is ever shown. */
public class Display {
    private static final Display INSTANCE = new Display();

    private Display() {}

    public static Display getDisplay(MIDlet m) {
        return INSTANCE;
    }

    public void setCurrent(Displayable d) {}

    public Displayable getCurrent() {
        return null;
    }

    public boolean vibrate(int duration) {
        return true;
    }

    public boolean flashBacklight(int duration) {
        return true;
    }
}
