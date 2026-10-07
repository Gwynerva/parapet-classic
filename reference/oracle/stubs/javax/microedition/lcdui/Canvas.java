package javax.microedition.lcdui;

/**
 * Headless stand-in. repaint()/serviceRepaints() do nothing: the harness never paints.
 * (The game's loading-progress path spins on a paint completing, which is why the
 * driver never sets the "loading UI enabled" flag; see Oracle.java.)
 */
public abstract class Canvas extends Displayable {
    public static final int UP = 1;
    public static final int DOWN = 6;
    public static final int LEFT = 2;
    public static final int RIGHT = 5;
    public static final int FIRE = 8;
    public static final int GAME_A = 9;
    public static final int GAME_B = 10;
    public static final int GAME_C = 11;
    public static final int GAME_D = 12;
    public static final int KEY_NUM0 = 48;
    public static final int KEY_NUM1 = 49;
    public static final int KEY_NUM2 = 50;
    public static final int KEY_NUM3 = 51;
    public static final int KEY_NUM4 = 52;
    public static final int KEY_NUM5 = 53;
    public static final int KEY_NUM6 = 54;
    public static final int KEY_NUM7 = 55;
    public static final int KEY_NUM8 = 56;
    public static final int KEY_NUM9 = 57;
    public static final int KEY_STAR = 42;
    public static final int KEY_POUND = 35;

    protected Canvas() {}

    protected abstract void paint(Graphics g);

    public final void repaint() {}

    public final void repaint(int x, int y, int w, int h) {}

    public final void serviceRepaints() {}

    public void setFullScreenMode(boolean mode) {}

    public boolean hasPointerEvents() {
        return false;
    }

    public boolean hasRepeatEvents() {
        return false;
    }

    public boolean isDoubleBuffered() {
        return true;
    }

    public int getGameAction(int keyCode) {
        return 0;
    }

    public int getKeyCode(int gameAction) {
        return 0;
    }

    public String getKeyName(int keyCode) {
        return "";
    }

    protected void keyPressed(int keyCode) {}

    protected void keyReleased(int keyCode) {}

    protected void keyRepeated(int keyCode) {}

    protected void pointerPressed(int x, int y) {}

    protected void pointerReleased(int x, int y) {}

    protected void pointerDragged(int x, int y) {}

    protected void showNotify() {}

    protected void hideNotify() {}

    protected void sizeChanged(int w, int h) {}
}
