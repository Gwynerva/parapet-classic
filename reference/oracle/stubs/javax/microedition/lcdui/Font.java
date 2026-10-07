package javax.microedition.lcdui;

/** Headless stand-in with fixed metrics: height 12, every character 6 px wide. */
public final class Font {
    public static final int STYLE_PLAIN = 0;
    public static final int STYLE_BOLD = 1;
    public static final int STYLE_ITALIC = 2;
    public static final int STYLE_UNDERLINED = 4;
    public static final int SIZE_SMALL = 8;
    public static final int SIZE_MEDIUM = 0;
    public static final int SIZE_LARGE = 16;
    public static final int FACE_SYSTEM = 0;
    public static final int FACE_MONOSPACE = 32;
    public static final int FACE_PROPORTIONAL = 64;
    public static final int FONT_STATIC_TEXT = 0;
    public static final int FONT_INPUT_TEXT = 1;

    public static final int HEIGHT = 12;
    public static final int CHAR_WIDTH = 6;

    private final int face;
    private final int style;
    private final int size;

    private Font(int face, int style, int size) {
        this.face = face;
        this.style = style;
        this.size = size;
    }

    public static Font getFont(int face, int style, int size) {
        return new Font(face, style, size);
    }

    public static Font getDefaultFont() {
        return new Font(0, 0, 0);
    }

    public static Font getFont(int fontSpecifier) {
        return getDefaultFont();
    }

    public int getFace() {
        return face;
    }

    public int getStyle() {
        return style;
    }

    public int getSize() {
        return size;
    }

    public boolean isPlain() {
        return style == 0;
    }

    public boolean isBold() {
        return (style & STYLE_BOLD) != 0;
    }

    public boolean isItalic() {
        return (style & STYLE_ITALIC) != 0;
    }

    public boolean isUnderlined() {
        return (style & STYLE_UNDERLINED) != 0;
    }

    public int getHeight() {
        return HEIGHT;
    }

    public int getBaselinePosition() {
        return HEIGHT - 2;
    }

    public int charWidth(char ch) {
        return CHAR_WIDTH;
    }

    public int charsWidth(char[] ch, int offset, int length) {
        return CHAR_WIDTH * length;
    }

    public int stringWidth(String str) {
        return CHAR_WIDTH * str.length();
    }

    public int substringWidth(String str, int offset, int len) {
        return CHAR_WIDTH * len;
    }
}
