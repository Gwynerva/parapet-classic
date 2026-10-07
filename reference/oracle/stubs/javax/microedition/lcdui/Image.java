package javax.microedition.lcdui;

/**
 * Headless stand-in. The game assembles PNG files itself in memory and calls
 * createImage(byte[], int, int); only the dimensions are ever read back, so the
 * stub parses them from the IHDR chunk and keeps nothing else.
 */
public class Image {
    private final int width;
    private final int height;

    private Image(int width, int height) {
        this.width = width;
        this.height = height;
    }

    public static Image createImage(byte[] data, int offset, int length) {
        if (data == null || length < 24 || offset < 0 || offset + length > data.length) {
            throw new IllegalArgumentException("createImage: bad buffer");
        }
        int o = offset;
        boolean png = (data[o] & 0xFF) == 0x89 && data[o + 1] == 'P' && data[o + 2] == 'N' && data[o + 3] == 'G'
                && data[o + 4] == 0x0D && data[o + 5] == 0x0A && data[o + 6] == 0x1A && data[o + 7] == 0x0A;
        if (!png || data[o + 12] != 'I' || data[o + 13] != 'H' || data[o + 14] != 'D' || data[o + 15] != 'R') {
            throw new IllegalArgumentException("createImage: not a PNG");
        }
        int w = readInt(data, o + 16);
        int h = readInt(data, o + 20);
        if (w <= 0 || h <= 0) {
            throw new IllegalArgumentException("createImage: bad IHDR");
        }
        return new Image(w, h);
    }

    public static Image createImage(int width, int height) {
        return new Image(width, height);
    }

    public static Image createImage(Image source) {
        return new Image(source.width, source.height);
    }

    public static Image createImage(String name) {
        throw new IllegalArgumentException("createImage(String) is not supported by the stub");
    }

    public static Image createRGBImage(int[] rgb, int width, int height, boolean alpha) {
        return new Image(width, height);
    }

    private static int readInt(byte[] b, int i) {
        return ((b[i] & 0xFF) << 24) | ((b[i + 1] & 0xFF) << 16) | ((b[i + 2] & 0xFF) << 8) | (b[i + 3] & 0xFF);
    }

    public int getWidth() {
        return width;
    }

    public int getHeight() {
        return height;
    }

    public boolean isMutable() {
        return false;
    }

    public Graphics getGraphics() {
        return new Graphics();
    }

    public void getRGB(int[] rgb, int off, int scan, int x, int y, int w, int h) {}
}
