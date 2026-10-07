package com.nokia.mid.ui;

import javax.microedition.lcdui.Graphics;
import javax.microedition.lcdui.Image;

/** Headless stand-in: returns a DirectGraphics whose drawing calls do nothing. */
public final class DirectUtils {
    private DirectUtils() {}

    public static DirectGraphics getDirectGraphics(Graphics g) {
        return NOOP;
    }

    public static Image createImage(byte[] data, int off, int len) {
        return Image.createImage(data, off, len);
    }

    public static Image createImage(int w, int h, int argb) {
        return Image.createImage(w, h);
    }

    private static final DirectGraphics NOOP = new DirectGraphics() {
        public void setARGBColor(int argb) {}

        public int getAlphaComponent() {
            return 255;
        }

        public int getNativePixelFormat() {
            return TYPE_USHORT_565_RGB;
        }

        public void drawImage(Image img, int x, int y, int anchor, int manipulation) {}

        public void drawTriangle(int x1, int y1, int x2, int y2, int x3, int y3, int argb) {}

        public void fillTriangle(int x1, int y1, int x2, int y2, int x3, int y3, int argb) {}

        public void drawPolygon(int[] x, int xOff, int[] y, int yOff, int n, int argb) {}

        public void fillPolygon(int[] x, int xOff, int[] y, int yOff, int n, int argb) {}

        public void drawPixels(byte[] p, byte[] a, int o, int s, int x, int y, int w, int h, int m, int f) {}

        public void drawPixels(short[] p, boolean a, int o, int s, int x, int y, int w, int h, int m, int f) {}

        public void drawPixels(int[] p, boolean a, int o, int s, int x, int y, int w, int h, int m, int f) {}

        public void getPixels(byte[] p, byte[] a, int o, int s, int x, int y, int w, int h, int f) {}

        public void getPixels(short[] p, int o, int s, int x, int y, int w, int h, int f) {}

        public void getPixels(int[] p, int o, int s, int x, int y, int w, int h, int f) {}
    };
}
