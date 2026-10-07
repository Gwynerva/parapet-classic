package javax.microedition.lcdui.game;

import javax.microedition.lcdui.Canvas;
import javax.microedition.lcdui.Graphics;

/** Headless stand-in. The game class d extends this with super(false). */
public abstract class GameCanvas extends Canvas {
    public static final int UP_PRESSED = 1 << Canvas.UP;
    public static final int DOWN_PRESSED = 1 << Canvas.DOWN;
    public static final int LEFT_PRESSED = 1 << Canvas.LEFT;
    public static final int RIGHT_PRESSED = 1 << Canvas.RIGHT;
    public static final int FIRE_PRESSED = 1 << Canvas.FIRE;

    private final Graphics graphics = new Graphics();

    protected GameCanvas(boolean suppressKeyEvents) {}

    protected Graphics getGraphics() {
        return graphics;
    }

    public int getKeyStates() {
        return 0;
    }

    public void flushGraphics() {}

    public void flushGraphics(int x, int y, int w, int h) {}
}
