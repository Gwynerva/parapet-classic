package javax.microedition.lcdui;

/** Headless stand-in: every drawing call is a no-op; colour/clip/font are only stored. */
public class Graphics {
    public static final int HCENTER = 1;
    public static final int VCENTER = 2;
    public static final int LEFT = 4;
    public static final int RIGHT = 8;
    public static final int TOP = 16;
    public static final int BOTTOM = 32;
    public static final int BASELINE = 64;
    public static final int SOLID = 0;
    public static final int DOTTED = 1;

    private int color;
    private int clipX, clipY, clipW = 240, clipH = 320;
    private int tx, ty;
    private Font font = Font.getDefaultFont();

    public Graphics() {}

    public void setColor(int rgb) {
        color = rgb & 0xFFFFFF;
    }

    public void setColor(int r, int g, int b) {
        color = ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
    }

    public int getColor() {
        return color;
    }

    public int getRedComponent() {
        return (color >> 16) & 0xFF;
    }

    public int getGreenComponent() {
        return (color >> 8) & 0xFF;
    }

    public int getBlueComponent() {
        return color & 0xFF;
    }

    public void setGrayScale(int v) {
        setColor(v, v, v);
    }

    public int getGrayScale() {
        return (getRedComponent() + getGreenComponent() + getBlueComponent()) / 3;
    }

    public void setFont(Font f) {
        font = f;
    }

    public Font getFont() {
        return font;
    }

    public void setStrokeStyle(int style) {}

    public int getStrokeStyle() {
        return SOLID;
    }

    public void setClip(int x, int y, int w, int h) {
        clipX = x;
        clipY = y;
        clipW = w;
        clipH = h;
    }

    public void clipRect(int x, int y, int w, int h) {
        setClip(x, y, w, h);
    }

    public int getClipX() {
        return clipX;
    }

    public int getClipY() {
        return clipY;
    }

    public int getClipWidth() {
        return clipW;
    }

    public int getClipHeight() {
        return clipH;
    }

    public void translate(int x, int y) {
        tx += x;
        ty += y;
    }

    public int getTranslateX() {
        return tx;
    }

    public int getTranslateY() {
        return ty;
    }

    public void drawLine(int x1, int y1, int x2, int y2) {}

    public void fillRect(int x, int y, int w, int h) {}

    public void drawRect(int x, int y, int w, int h) {}

    public void drawRoundRect(int x, int y, int w, int h, int aw, int ah) {}

    public void fillRoundRect(int x, int y, int w, int h, int aw, int ah) {}

    public void fillArc(int x, int y, int w, int h, int sa, int aa) {}

    public void drawArc(int x, int y, int w, int h, int sa, int aa) {}

    public void drawString(String str, int x, int y, int anchor) {}

    public void drawSubstring(String str, int off, int len, int x, int y, int anchor) {}

    public void drawChar(char c, int x, int y, int anchor) {}

    public void drawChars(char[] data, int off, int len, int x, int y, int anchor) {}

    public void drawImage(Image img, int x, int y, int anchor) {}

    public void drawRegion(Image src, int xs, int ys, int w, int h, int transform, int xd, int yd, int anchor) {}

    public void drawRGB(int[] rgb, int off, int scan, int x, int y, int w, int h, boolean alpha) {}

    public void fillTriangle(int x1, int y1, int x2, int y2, int x3, int y3) {}

    public void copyArea(int xs, int ys, int w, int h, int xd, int yd, int anchor) {}
}
