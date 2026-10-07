package javax.microedition.lcdui;

/** Headless stand-in. The screen is always 240x320. */
public abstract class Displayable {
    Displayable() {}

    public int getWidth() {
        return 240;
    }

    public int getHeight() {
        return 320;
    }

    public boolean isShown() {
        return true;
    }

    public void setTitle(String s) {}

    public String getTitle() {
        return null;
    }
}
