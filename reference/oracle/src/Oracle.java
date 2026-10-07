import java.io.BufferedWriter;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;
import java.util.TreeSet;

/**
 * Headless driver for the original Playman Extreme Running class files.
 *
 * It initialises the obfuscated game class {@code d} exactly far enough to have the data
 * tables, a level and a player entity in the "playing" screen state (aM == 5), then drives
 * the physics step {@code m(I)I} (CFR: int_m) directly, one step at a time, with scripted
 * presses, and writes one JSON object per step. Everything is accessed through reflection
 * by the real obfuscated member names and descriptors (CFR's renamed names such as
 * {@code var_int_arr_J} are {@code J:[I} in the class file).
 *
 * Usage: {@code java Oracle <level 0-11> <missionType 0-5> <script.txt> <out.jsonl>}
 */
public final class Oracle {
    static final int SCHEMA = 4;
    static final int STEP_UNITS = 30;
    static final int ANIM_UNITS = 30720; // 30 << 10, what the frame loop passes to z(I)V

    // ---------------------------------------------------------------- reflection helpers

    static Class<?> D, E, C, F, G;

    static Field field(Class<?> cls, String name, Class<?> type) {
        for (Field f : cls.getDeclaredFields()) {
            if (f.getName().equals(name) && f.getType() == type) {
                f.setAccessible(true);
                return f;
            }
        }
        throw new IllegalStateException("no field " + cls.getName() + "." + name + " : " + type.getName());
    }

    static Method method(Class<?> cls, String name, Class<?> ret, Class<?>... params) {
        for (Method m : cls.getDeclaredMethods()) {
            if (m.getName().equals(name) && m.getReturnType() == ret && Arrays.equals(m.getParameterTypes(), params)) {
                m.setAccessible(true);
                return m;
            }
        }
        throw new IllegalStateException("no method " + cls.getName() + "." + name + " ret " + ret.getName()
                + " params " + Arrays.toString(params));
    }

    static Object call(Method m, Object... args) {
        try {
            return m.invoke(null, args);
        } catch (InvocationTargetException e) {
            Throwable c = e.getCause();
            throw new RuntimeException("game threw in " + m.getName() + Arrays.toString(m.getParameterTypes()), c);
        } catch (IllegalAccessException e) {
            throw new RuntimeException(e);
        }
    }

    static int geti(Field f, Object o) {
        try {
            return f.getInt(o);
        } catch (IllegalAccessException e) {
            throw new RuntimeException(e);
        }
    }

    static boolean getz(Field f, Object o) {
        try {
            return f.getBoolean(o);
        } catch (IllegalAccessException e) {
            throw new RuntimeException(e);
        }
    }

    static Object get(Field f, Object o) {
        try {
            return f.get(o);
        } catch (IllegalAccessException e) {
            throw new RuntimeException(e);
        }
    }

    static void seti(Field f, Object o, int v) {
        try {
            f.setInt(o, v);
        } catch (IllegalAccessException e) {
            throw new RuntimeException(e);
        }
    }

    static void setz(Field f, Object o, boolean v) {
        try {
            f.setBoolean(o, v);
        } catch (IllegalAccessException e) {
            throw new RuntimeException(e);
        }
    }

    static void set(Field f, Object o, Object v) {
        try {
            f.set(o, v);
        } catch (IllegalAccessException e) {
            throw new RuntimeException(e);
        }
    }

    // ---------------------------------------------------------------- game members (real names)

    // static fields of d
    static Field dInstance;      // a:Ld;            CFR var_d_a        the canvas instance (resource loading goes through its class)
    static Field dEntities;      // a:[Le;           var_e_arr_a        entities, player = [ay]
    static Field dProbes;        // a:[Lc;           var_c_arr_a        3 probes per entity: hands, body, feet
    static Field dScores;        // a:[Lf;           var_f_arr_a        scoring struct per player
    static Field dRandom;        // a:Ljava/util/Random;                 only used by cosmetics; seeded for determinism
    static Field dMoveTable;     // I:[I             var_int_arr_I      state table
    static Field dMoveId;        // J:[I             var_int_arr_J      current state per entity
    static Field dMoveTimer;     // K:[I             var_int_arr_K      state timer per entity
    static Field dMissionTable;  // z:[I             var_int_arr_z      12 x 28 mission data
    static Field dPressed;       // bB:I             presses collected this frame
    static Field dScreenState;   // aM:I             5 = playing
    static Field dMissionType;   // aN:I
    static Field dAx;            // ax:I             entity being stepped
    static Field dAy;            // ay:I             player index
    static Field dLevel;         // ci:I
    static Field dMissionIndex;  // cj:I
    static Field dPlayerCount;   // ck:I             0 in single player
    static Field dTheme;         // bn:I             level / 3 (music theme)
    static Field dGoalKind;      // aQ:I             0 time limit, 1 score target, 2 sprint
    static Field dGoalValue;     // aR:I
    static Field dAccumulator;   // cf:I
    static Field dClock;         // cg:I
    static Field dMeter;         // bz:I             flow meter 0..5120
    static Field dMapW, dMapH;   // bP:I bQ:I
    static Field dStartX, dStartY; // bR:I bS:I     start cell
    static Field dFinishX, dFinishY; // bT:I bU:I   finish cell
    static Field dFlagBits;      // bM:I
    static Field dMultiplayer;   // K:Z              var_boolean_K
    static Field dLoadingUi;     // f:Z              var_boolean_f (must stay false: progress painting would spin)
    static Field dScreenW;       // r:I              240
    static Field dRivalDelay;    // aG:I             rival start delay in ms (z[level*28+7]), set by Y()
    static Field dTimeUp;        // H:Z              var_boolean_H: the run ended on the time limit
    static Field dAnims;         // a:[Lg;           var_g_arr_a      animation state per entity
    static Field dAnimBlob;      // h:[S             var_short_arr_h  blob 17: clip lengths and keyframe ids
    // camera (k(II)V line 9370 init, l(II)V target, a(Le;)V 9351 follow, b(IZ)V 9436 update, aP()/Q(I)V flyover)
    static Field dCamX, dCamY;   // bD:I bE:I        camera top-left in world units (clamped to the map)
    static Field dCamTX, dCamTY; // bF:I bG:I        camera target
    static Field dCamVX, dCamVY; // bH:I bI:I        spring velocity per update
    static Field dCamFly;        // U:Z              var_boolean_U: flyover mode (checkpoint tour before a Sprint)
    static Field dCamLeg;        // bJ:I             flyover leg index (0 start, 1..bX checkpoints, bX+1 finish)
    static Field dCamProg;       // bK:I             flyover progress along the leg
    static Field dCamLen;        // bL:I             flyover leg length

    // static methods of d
    static Method mLoadConfig;     // l()V          "i": 16 bytes, 593 shorts (var_short_arr_a), 166 ints (var_int_arr_d)
    static Method mTimingInit;     // g()V          CFR void_g
    static Method mOptions;        // j()V          CFR void_j, RecordStore "ropt" -> defaults
    static Method mSoundBank;      // e(I)V         CFR void_e(int)
    static Method mMenuFlags;      // y()V
    static Method mBaseInit;       // bf()V         ay = 0, sine table, particles
    static Method mStrings;        // j(I)V         CFR void_j(int), "l"
    static Method mSprites;        // c(I)V         CFR void_c(int), "g<n>" + palettes "p"
    static Method mMenuEntry;      // at()V         menu entry: k0 background, names G(), af() animation, mission table z,
                                   //               high-score records bc(), music, unlock flags, menu cursor b(true)
    static Method mLevelStart;     // bg()V         full level/mode setup (calls m(II)V loadLevel inside)
    static Method mAdvanceScreen;  // ad()V         screen-state flow; from 1/2/3 (or 4) it enters 5 = play
    static Method mRecord;         // a(B)V         input recorder
    static Method mStep;           // m(I)I         CFR int_m: one physics step for entity ax
    static Method mCheckEnd;       // c()Z          CFR boolean_c: mission end / checkpoints
    static Method mAnimate;        // z(I)V         animation update (cosmetic)
    static Method mScore;          // aG()V         per-step scoring for the player
    static Method mParticles;      // q(I)V         CFR void_q
    static Method mCameraFollow;   // a(Le;)V       CFR void_a(e)
    static Method mCameraUpdate;   // b(IZ)V
    static Method mReplayInput;    // a(I)B         CFR byte_a: next recorded press of rival n (-1 when exhausted)
    static Method mEnterMove;      // O(I)V         enter state
    static Method mPhysInit;       // a(Le;IIIII)V  CFR a(e,int,int,int,int,int): z-type init (z, B, C, D, duration)
    static Method mDuration;       // p(I)I         CFR int_p: state duration (-1 -> 100 + (w >> 3))

    // entity (class e) fields
    static Field eSubStep, eContact, eAccelX, eAccelY; // int a, b, c, d
    static Field eHandsPinned, eFacingRight, eHandsAnchored, eFacingLocked; // boolean a, b, c, d
    static Field eK, eL, eG, eH, eQ, eR, eU, eV, eT, eO, eP, eQbuf, eE, eF, eKimp, eLimp, eM, eN, eW, eX, eZ;
    static Field eM_, eN_, eO_, eP_; // render coordinates m, n, o, p

    // probe (class c) fields
    static Field cHit, cIsHands; // boolean a, b
    static Field cPx, cPy, cK, cTile; // int a, b, k, h

    // score (class f) fields
    static Field fScore, fMult; // int a, int b

    // animation (class g) fields, see c(III)V line 5702, z(I)V 5786 and aj() 5886:
    //   a:I  var_int_a   frame count of the current clip (var_short_arr_h[clip])
    //   b:I  var_int_b   current frame index
    //   c:I  var_int_c   current clip's first keyframe index in blob 17 (clip + 1)
    //   d    playback mode (state table [7])
    //   e    frame count of the previous clip (blend source)
    //   f    previous frame index, -1 = no blend source
    //   g    previous clip's first keyframe index
    //   a:Z  var_boolean_a  facing the clip was set for, stored inverted (= !facingRight at set time)
    //   h, i anchor snapshot (render position incl. hands offset when hands-anchored) for the tween
    //   j    blend/tween progress 0..255
    //   b:Z  var_boolean_b  previous hands-anchored flag;  c:Z var_boolean_c  current hands-anchored flag
    //   k    clip time accumulator (time units)
    //   l    clip duration (state timer at entry)
    //   m, n emote id and the clock at which it expires
    static Field gA, gB, gC, gD, gE, gF, gG, gH, gI, gJ, gK, gL, gM, gN;
    static Field gBa, gBb, gBc;

    static void bind() throws ClassNotFoundException {
        D = Class.forName("d");
        E = Class.forName("e");
        C = Class.forName("c");
        F = Class.forName("f");
        G = Class.forName("g");

        dInstance = field(D, "a", D);
        dEntities = field(D, "a", arrayOf(E));
        dProbes = field(D, "a", arrayOf(C));
        dScores = field(D, "a", arrayOf(F));
        dRandom = field(D, "a", Random.class);
        dMoveTable = field(D, "I", int[].class);
        dMoveId = field(D, "J", int[].class);
        dMoveTimer = field(D, "K", int[].class);
        dMissionTable = field(D, "z", int[].class);
        dPressed = field(D, "bB", int.class);
        dScreenState = field(D, "aM", int.class);
        dMissionType = field(D, "aN", int.class);
        dAx = field(D, "ax", int.class);
        dAy = field(D, "ay", int.class);
        dLevel = field(D, "ci", int.class);
        dMissionIndex = field(D, "cj", int.class);
        dPlayerCount = field(D, "ck", int.class);
        dTheme = field(D, "bn", int.class);
        dGoalKind = field(D, "aQ", int.class);
        dGoalValue = field(D, "aR", int.class);
        dAccumulator = field(D, "cf", int.class);
        dClock = field(D, "cg", int.class);
        dMeter = field(D, "bz", int.class);
        dMapW = field(D, "bP", int.class);
        dMapH = field(D, "bQ", int.class);
        dStartX = field(D, "bR", int.class);
        dStartY = field(D, "bS", int.class);
        dFinishX = field(D, "bT", int.class);
        dFinishY = field(D, "bU", int.class);
        dFlagBits = field(D, "bM", int.class);
        dMultiplayer = field(D, "K", boolean.class);
        dLoadingUi = field(D, "f", boolean.class);
        dScreenW = field(D, "r", int.class);
        dRivalDelay = field(D, "aG", int.class);
        dTimeUp = field(D, "H", boolean.class);
        dAnims = field(D, "a", arrayOf(G));
        dAnimBlob = field(D, "h", short[].class);
        dCamX = field(D, "bD", int.class);
        dCamY = field(D, "bE", int.class);
        dCamTX = field(D, "bF", int.class);
        dCamTY = field(D, "bG", int.class);
        dCamVX = field(D, "bH", int.class);
        dCamVY = field(D, "bI", int.class);
        dCamFly = field(D, "U", boolean.class);
        dCamLeg = field(D, "bJ", int.class);
        dCamProg = field(D, "bK", int.class);
        dCamLen = field(D, "bL", int.class);

        mLoadConfig = method(D, "l", void.class);
        mTimingInit = method(D, "g", void.class);
        mOptions = method(D, "j", void.class);
        mSoundBank = method(D, "e", void.class, int.class);
        mMenuFlags = method(D, "y", void.class);
        mBaseInit = method(D, "bf", void.class);
        mStrings = method(D, "j", void.class, int.class);
        mSprites = method(D, "c", void.class, int.class);
        mMenuEntry = method(D, "at", void.class);
        mLevelStart = method(D, "bg", void.class);
        mAdvanceScreen = method(D, "ad", void.class);
        mRecord = method(D, "a", void.class, byte.class);
        mStep = method(D, "m", int.class, int.class);
        mCheckEnd = method(D, "c", boolean.class);
        mAnimate = method(D, "z", void.class, int.class);
        mScore = method(D, "aG", void.class);
        mParticles = method(D, "q", void.class, int.class);
        mCameraFollow = method(D, "a", void.class, E);
        mCameraUpdate = method(D, "b", void.class, int.class, boolean.class);
        mReplayInput = method(D, "a", byte.class, int.class);
        mEnterMove = method(D, "O", void.class, int.class);
        mPhysInit = method(D, "a", void.class, E, int.class, int.class, int.class, int.class, int.class);
        mDuration = method(D, "p", int.class, int.class);

        eSubStep = field(E, "a", int.class);
        eContact = field(E, "b", int.class);
        eAccelX = field(E, "c", int.class);
        eAccelY = field(E, "d", int.class);
        eHandsPinned = field(E, "a", boolean.class);
        eFacingRight = field(E, "b", boolean.class);
        eHandsAnchored = field(E, "c", boolean.class);
        eFacingLocked = field(E, "d", boolean.class);
        eK = field(E, "k", int.class);
        eL = field(E, "l", int.class);
        eG = field(E, "g", int.class);
        eH = field(E, "h", int.class);
        eQ = field(E, "q", int.class);
        eR = field(E, "r", int.class);
        eU = field(E, "u", int.class);
        eV = field(E, "v", int.class);
        eT = field(E, "t", int.class);
        eO = field(E, "O", int.class);
        eP = field(E, "P", int.class);
        eQbuf = field(E, "Q", int.class);
        eE = field(E, "E", int.class);
        eF = field(E, "F", int.class);
        eKimp = field(E, "K", int.class);
        eLimp = field(E, "L", int.class);
        eM = field(E, "M", int.class);
        eN = field(E, "N", int.class);
        eW = field(E, "w", int.class);
        eX = field(E, "x", int.class);
        eZ = field(E, "z", int.class);
        eM_ = field(E, "m", int.class);
        eN_ = field(E, "n", int.class);
        eO_ = field(E, "o", int.class);
        eP_ = field(E, "p", int.class);

        cHit = field(C, "a", boolean.class);
        cIsHands = field(C, "b", boolean.class);
        cPx = field(C, "a", int.class);
        cPy = field(C, "b", int.class);
        cK = field(C, "k", int.class);
        cTile = field(C, "h", int.class);

        fScore = field(F, "a", int.class);
        fMult = field(F, "b", int.class);

        gA = field(G, "a", int.class);
        gB = field(G, "b", int.class);
        gC = field(G, "c", int.class);
        gD = field(G, "d", int.class);
        gE = field(G, "e", int.class);
        gF = field(G, "f", int.class);
        gG = field(G, "g", int.class);
        gH = field(G, "h", int.class);
        gI = field(G, "i", int.class);
        gJ = field(G, "j", int.class);
        gK = field(G, "k", int.class);
        gL = field(G, "l", int.class);
        gM = field(G, "m", int.class);
        gN = field(G, "n", int.class);
        gBa = field(G, "a", boolean.class);
        gBb = field(G, "b", boolean.class);
        gBc = field(G, "c", boolean.class);
    }

    static Class<?> arrayOf(Class<?> c) {
        return java.lang.reflect.Array.newInstance(c, 0).getClass();
    }

    // ---------------------------------------------------------------- initialisation

    static int missionIndex;

    /**
     * Brings the game to screen state 5 (playing) in level {@code level}, mission type
     * {@code missionType}, with the data tables loaded and the player entity placed at the
     * level's start cell. Mirrors run() -> l(), v() and the menu's level selection, then
     * bg() (level start) and ad() (screen flow) — without the UI thread and without the
     * loading-progress painting.
     */
    static void init(int level, int missionType) throws Exception {
        bind();

        // d() is the public no-arg constructor (super(false)); the game normally uses d(S),
        // which additionally creates (and S starts) the game thread. We never start it.
        Object canvas = D.getConstructor().newInstance();
        set(dInstance, null, canvas);
        // var_boolean_f gates the loading-progress repaint (u()) which busy-waits for paint();
        // leaving it false makes every progress callback return immediately.
        setz(dLoadingUi, null, false);

        // run(): l() then v()
        call(mLoadConfig);          // "i": config shorts + offset table
        call(mTimingInit);          // g()
        call(mOptions);             // j(): RecordStore "ropt" absent -> default options
        call(mSoundBank, 0);        // e(0): sound bank 0 (Manager / Sound stubs)
        call(mMenuFlags);           // y()
        call(mBaseInit);            // bf(): ay = 0, sine table, particle arrays
        call(mStrings, 0);          // j(0): string table from "l"
        call(mSprites, 0);          // c(0): sprite sheet g0 via Image.createImage (needs "p" palettes)

        // menu entry at() (line 7216): k0 background shorts (used by the animation frame lookup
        // ah()), player/rival names G() (RecordStore "str" absent -> defaults), af() animation
        // blob + class g state per entity (O(int) needs it), the mission table z (blob 39 of b2),
        // the high-score records bc() (RecordStore "accession" absent -> defaults from the
        // mission table; the results screen x(7) reads them when a mission ends), menu music
        // and the unlock flags. The seeded Random goes first so anything cosmetic it feeds
        // (particles/emotes) is reproducible.
        set(dRandom, null, new Random(0));
        call(mMenuEntry);
        int[] missions = (int[]) get(dMissionTable, null);

        // menu selection (line 6782 in the decompiled source)
        int missionCount = missions[level * 28 + 2];
        missionIndex = -1;
        for (int m = 0; m < missionCount; m++) {
            if (((missions[level * 28 + 3] >> (m << 2)) & 0xF) == missionType) {
                missionIndex = m;
                break;
            }
        }
        if (missionIndex < 0) {
            throw new IllegalArgumentException("level " + level + " has no mission of type " + missionType
                    + " (types " + Integer.toHexString(missions[level * 28 + 3]) + ", count " + missionCount + ")");
        }
        seti(dLevel, null, level);
        seti(dMissionIndex, null, missionIndex);
        seti(dMissionType, null, missionType);
        int goal = missions[level * 28 + 13 + missionIndex * 3];
        if (goal == -2) {
            seti(dGoalKind, null, 2);
            seti(dGoalValue, null, -1);
        } else if ((goal & Integer.MIN_VALUE) != 0) {
            seti(dGoalKind, null, 0);
            seti(dGoalValue, null, goal & Integer.MAX_VALUE);
        } else {
            seti(dGoalKind, null, 1);
            seti(dGoalValue, null, goal);
        }
        seti(dPlayerCount, null, 0);     // ck = bw = 0: single player
        seti(dTheme, null, level / 3);   // bn
        setz(dMultiplayer, null, false); // var_boolean_K

        // level start: strings/sprites/sounds for the level, loadLevel m(ci, aN), state table,
        // entities + probes, scoring, recorder, particles, camera, mode setup -> screen state 0 -> ad()
        call(mLevelStart);

        // screen flow: 0 -> 1 (warm-up tutorial) / 2 (briefing) / 3 -> (4 flyover for Sprint) -> 5 play
        for (int guard = 0; geti(dScreenState, null) != 5; guard++) {
            if (guard > 4) {
                throw new IllegalStateException("could not reach screen state 5, stuck at " + geti(dScreenState, null));
            }
            call(mAdvanceScreen);
        }
    }

    // ---------------------------------------------------------------- input script

    static final class Entry {
        final int ticks;
        final String key;

        Entry(int ticks, String key) {
            this.ticks = ticks;
            this.key = key;
        }
    }

    static List<Entry> parseScript(Path path) throws IOException {
        List<Entry> out = new ArrayList<>();
        int lineNo = 0;
        for (String raw : Files.readAllLines(path, StandardCharsets.UTF_8)) {
            lineNo++;
            String line = raw;
            int hash = line.indexOf('#');
            if (hash >= 0) line = line.substring(0, hash);
            line = line.trim();
            if (line.isEmpty()) continue;
            String[] parts = line.split("\\s+");
            if (parts.length != 2) {
                throw new IllegalArgumentException(path + ":" + lineNo + ": expected '<ticks> <keys>', got '" + raw + "'");
            }
            int ticks = Integer.parseInt(parts[0]);
            if (ticks < 1) {
                throw new IllegalArgumentException(path + ":" + lineNo + ": ticks must be >= 1");
            }
            String key = parts[1].toUpperCase();
            if (!key.matches("-|[UDLRFB]+|0X[0-9A-F]+|[0-9]+")) {
                throw new IllegalArgumentException(path + ":" + lineNo + ": bad key '" + parts[1] + "'");
            }
            out.add(new Entry(ticks, key));
        }
        return out;
    }

    /**
     * Converts an abstract key to the game's press byte the way boolean_f(int) (line 5173)
     * does: UP 1, DOWN 2, RIGHT = 4 | (facingRight ? FWD 16 : BACK 32),
     * LEFT = 8 | (facingRight ? BACK 32 : FWD 16). F and B are literal FWD/BACK bits.
     */
    static int bitsFor(String key, boolean facingRight) {
        if (key.equals("-")) return 0;
        if (key.startsWith("0X")) return Integer.parseInt(key.substring(2), 16);
        if (Character.isDigit(key.charAt(0))) return Integer.parseInt(key);
        int bits = 0;
        for (char ch : key.toCharArray()) {
            switch (ch) {
                case 'U': bits |= 1; break;
                case 'D': bits |= 2; break;
                case 'R': bits |= 4 | (facingRight ? 16 : 32); break;
                case 'L': bits |= 8 | (facingRight ? 32 : 16); break;
                case 'F': bits |= 16; break;
                case 'B': bits |= 32; break;
                default: throw new IllegalArgumentException("bad key char " + ch);
            }
        }
        return bits;
    }

    // ---------------------------------------------------------------- stepping

    static Object entity(int i) {
        Object[] ents = (Object[]) get(dEntities, null);
        return ents[i];
    }

    static Object player() {
        return entity(geti(dAy, null));
    }

    static Object probe(int entityIndex, int i) {
        Object[] probes = (Object[]) get(dProbes, null);
        return probes[3 * entityIndex + i];
    }

    static Object scoreStruct() {
        Object[] scores = (Object[]) get(dScores, null);
        return scores[geti(dAy, null)];
    }

    /** Per-step rival inputs: the byte returned by byte_a, or null when the rival was not stepped. */
    static Integer[] rivalInputs = new Integer[0];

    /**
     * One frame-step, in the order of the frame loop boolean_d() (line 10473).
     * Rivals 0..ay-1 first (lines 10498-10503): skipped while cg < aG (start delay, Sprint single
     * player); otherwise bB = byte_a(n); a rival whose recording ran out (-1) is forced into
     * state 5 with its z-type re-initialised; then int_m(30), z(30720), void_q(30), bB = 0 —
     * no scoring, no end check, no camera. Then the player: bB = presses; a((byte)bB) records;
     * cg += 30; int_m(30); boolean_c() end check; z(30720) animation; aG() scoring;
     * void_q(30) particles; bB = 0; camera. Returns true when the mission ended during this step.
     */
    static boolean step(int bits) {
        int ay = geti(dAy, null);
        int[] moveId = (int[]) get(dMoveId, null);
        int[] table = (int[]) get(dMoveTable, null);
        boolean sprintSingle = geti(dMissionType, null) == 0 && geti(dPlayerCount, null) <= 1;
        int delay = geti(dRivalDelay, null);
        rivalInputs = new Integer[ay];
        for (int n = 0; n < ay; n++) {
            seti(dAx, null, n);
            if (sprintSingle && geti(dClock, null) < delay) {
                rivalInputs[n] = null;
                continue;
            }
            int in = (Byte) call(mReplayInput, n); // sign-extended, exactly like "bB = byte_a(n3)"
            rivalInputs[n] = in;
            seti(dPressed, null, in);
            if (in == -1 && moveId[n] != 5) {
                call(mEnterMove, 5);
                int j = moveId[n];
                call(mPhysInit, entity(n), table[j * 14 + 2], table[j * 14 + 3], table[j * 14 + 4], table[j * 14 + 5],
                        call(mDuration, j));
            }
            call(mStep, STEP_UNITS);
            call(mAnimate, ANIM_UNITS);
            call(mParticles, STEP_UNITS);
            seti(dPressed, null, 0);
        }

        seti(dAx, null, ay);
        seti(dPressed, null, bits);
        call(mRecord, (byte) bits);
        seti(dClock, null, geti(dClock, null) + STEP_UNITS);
        call(mStep, STEP_UNITS);
        boolean ended = (Boolean) call(mCheckEnd);
        if (ended) {
            seti(dAccumulator, null, 0);
            return true;
        }
        call(mAnimate, ANIM_UNITS);
        call(mScore);
        call(mParticles, STEP_UNITS);
        seti(dPressed, null, 0);
        call(mCameraFollow, player());
        call(mCameraUpdate, ANIM_UNITS, true);
        return false;
    }

    // ---------------------------------------------------------------- JSON output

    static void writeMeta(BufferedWriter w, int level, int missionType, String scriptName, int steps) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"meta\":{");
        sb.append("\"schema\":").append(SCHEMA);
        sb.append(",\"game\":\"Playman Extreme Running 1.0.8 240x320\"");
        sb.append(",\"level\":").append(level);
        sb.append(",\"missionType\":").append(missionType);
        sb.append(",\"missionIndex\":").append(missionIndex);
        sb.append(",\"script\":\"").append(escape(scriptName)).append('"');
        sb.append(",\"steps\":").append(steps);
        sb.append(",\"stepUnits\":").append(STEP_UNITS);
        sb.append(",\"mapW\":").append(geti(dMapW, null));
        sb.append(",\"mapH\":").append(geti(dMapH, null));
        sb.append(",\"startX\":").append(geti(dStartX, null));
        sb.append(",\"startY\":").append(geti(dStartY, null));
        sb.append(",\"finishX\":").append(geti(dFinishX, null));
        sb.append(",\"finishY\":").append(geti(dFinishY, null));
        sb.append(",\"gravity\":").append(geti(eAccelY, player()));
        sb.append(",\"playerIndex\":").append(geti(dAy, null));
        sb.append(",\"rivalStartDelay\":").append(geti(dRivalDelay, null));
        sb.append(",\"screenState\":").append(geti(dScreenState, null));
        sb.append("}}");
        w.write(sb.toString());
        w.write('\n'); // always LF so traces are byte-identical across platforms
    }

    static void writeStep(BufferedWriter w, int step, int bits, String key, boolean ended) throws IOException {
        Object f = scoreStruct();
        int ay = geti(dAy, null);
        StringBuilder sb = new StringBuilder(1024);
        sb.append('{');
        sb.append("\"step\":").append(step);
        sb.append(",\"input\":").append(bits);
        sb.append(",\"key\":\"").append(escape(key)).append('"');
        appendEntity(sb, ay);
        appendInt(sb, "score", geti(fScore, f));
        appendInt(sb, "mult", geti(fMult, f));
        appendInt(sb, "meter", geti(dMeter, null));
        appendInt(sb, "clock", geti(dClock, null));
        appendInt(sb, "flags", geti(dFlagBits, null));
        appendBool(sb, "ended", ended);
        if (ended) sb.append(",\"endReason\":\"").append(endReason()).append('"');
        // camera statics as left by a(e) + b(30720, true) at the end of the player's part
        // (at step 0: as set by bg() -> k(k - 3840, l - 5120), plus aP()/Q(1) in Sprint)
        sb.append(",\"cam\":{\"x\":").append(geti(dCamX, null)).append(",\"y\":").append(geti(dCamY, null));
        sb.append(",\"tx\":").append(geti(dCamTX, null)).append(",\"ty\":").append(geti(dCamTY, null));
        sb.append(",\"vx\":").append(geti(dCamVX, null)).append(",\"vy\":").append(geti(dCamVY, null));
        sb.append(",\"U\":").append(getz(dCamFly, null)).append(",\"bJ\":").append(geti(dCamLeg, null));
        sb.append(",\"bK\":").append(geti(dCamProg, null)).append(",\"bL\":").append(geti(dCamLen, null)).append('}');
        sb.append(",\"rivals\":[");
        for (int n = 0; n < ay; n++) {
            if (n > 0) sb.append(',');
            sb.append("{\"input\":").append(n < rivalInputs.length && rivalInputs[n] != null ? rivalInputs[n].toString() : "null");
            appendEntity(sb, n);
            sb.append('}');
        }
        sb.append(']');
        sb.append('}');
        w.write(sb.toString());
        w.write('\n');
    }

    /**
     * Why boolean_c() ended the run, from the screen state it switched to (ad() from 5).
     * Score run sets var_boolean_H on the time limit; Challenge (case 3) ends on
     * "aR > 0 && aR - cg <= 0" without a flag, so the clock is checked here (the results screen
     * x(7) makes the same test to pick the "Time up" text).
     */
    static String endReason() {
        int aM = geti(dScreenState, null);
        if (getz(dTimeUp, null)) return "time-up";
        int aN = geti(dMissionType, null), aR = geti(dGoalValue, null), cg = geti(dClock, null);
        if (aN == 3 && aR > 0 && aR - cg <= 0) return "time-up";
        if (aM == 6) return "warm-up-complete";
        if (aM == 7 || aM == 10) return "finished";
        return "screen-" + aM;
    }

    /** The per-entity fields (same set for the player and for rivals), appended as ",\"move\":..,...". */
    static void appendEntity(StringBuilder sb, int idx) {
        Object e = entity(idx);
        int[] moveId = (int[]) get(dMoveId, null);
        int[] moveTimer = (int[]) get(dMoveTimer, null);
        appendInt(sb, "move", moveId[idx]);
        appendInt(sb, "timer", moveTimer[idx]);
        appendInt(sb, "k", geti(eK, e));
        appendInt(sb, "l", geti(eL, e));
        appendInt(sb, "g", geti(eG, e));
        appendInt(sb, "h", geti(eH, e));
        appendInt(sb, "q", geti(eQ, e));
        appendInt(sb, "r", geti(eR, e));
        appendInt(sb, "u", geti(eU, e));
        appendInt(sb, "v", geti(eV, e));
        appendInt(sb, "t", geti(eT, e));
        appendInt(sb, "O", geti(eO, e));
        appendInt(sb, "P", geti(eP, e));
        appendInt(sb, "Q", geti(eQbuf, e));
        appendInt(sb, "E", geti(eE, e));
        appendInt(sb, "F", geti(eF, e));
        appendInt(sb, "K", geti(eKimp, e));
        appendInt(sb, "L", geti(eLimp, e));
        appendInt(sb, "M", geti(eM, e));
        appendInt(sb, "N", geti(eN, e));
        appendInt(sb, "w", geti(eW, e));
        appendInt(sb, "x", geti(eX, e));
        appendInt(sb, "z", geti(eZ, e));
        appendBool(sb, "a", getz(eHandsPinned, e));
        appendBool(sb, "b", getz(eFacingRight, e));
        appendBool(sb, "c", getz(eHandsAnchored, e));
        appendBool(sb, "d", getz(eFacingLocked, e));
        appendInt(sb, "contact", geti(eContact, e));
        sb.append(",\"probes\":[");
        for (int i = 0; i < 3; i++) {
            Object p = probe(idx, i);
            if (i > 0) sb.append(',');
            sb.append("{\"hit\":").append(getz(cHit, p));
            sb.append(",\"k\":").append(geti(cK, p));
            sb.append(",\"tile\":").append(geti(cTile, p));
            sb.append(",\"x\":").append(geti(cPx, p));
            sb.append(",\"y\":").append(geti(cPy, p));
            sb.append('}');
        }
        sb.append(']');
        appendAnim(sb, idx, e);
    }

    /**
     * The entity's animation state (class g, var_g_arr_a[idx]) as left by z(30720) this step, and
     * the draw parameters computed exactly as aj() (line 5886) computes them before calling
     * b(0, s, s2, tween, screenX, screenY, 1024, flip): x/y = render position (hands-anchored adds the
     * hands offset), flip = facing with the 0x1000 rule (true = drawn facing right), blend = a blend
     * source exists and the state has no 0x20, s/s2 = previous/current keyframe ids, the anchor tween
     * applied to x/y when blending across an anchor change, t = blend ? j << 8 : -1.
     */
    static void appendAnim(StringBuilder sb, int idx, Object e) {
        Object g = ((Object[]) get(dAnims, null))[idx];
        int[] table = (int[]) get(dMoveTable, null);
        int[] moveId = (int[]) get(dMoveId, null);
        short[] blob = (short[]) get(dAnimBlob, null);
        int a = geti(gA, g), b = geti(gB, g), c = geti(gC, g), d = geti(gD, g), ee = geti(gE, g), f = geti(gF, g),
                gg = geti(gG, g), h = geti(gH, g), i = geti(gI, g), j = geti(gJ, g), k = geti(gK, g), l = geti(gL, g),
                m = geti(gM, g), n = geti(gN, g);
        boolean ba = getz(gBa, g), bb = getz(gBb, g), bc = getz(gBc, g);
        sb.append(",\"anim\":{");
        sb.append("\"a\":").append(a).append(",\"b\":").append(b).append(",\"c\":").append(c).append(",\"d\":").append(d);
        sb.append(",\"e\":").append(ee).append(",\"f\":").append(f).append(",\"g\":").append(gg).append(",\"h\":").append(h);
        sb.append(",\"i\":").append(i).append(",\"j\":").append(j).append(",\"k\":").append(k).append(",\"l\":").append(l);
        sb.append(",\"m\":").append(m).append(",\"n\":").append(n);
        sb.append(",\"ba\":").append(ba).append(",\"bb\":").append(bb).append(",\"bc\":").append(bc);
        sb.append('}');

        // aj()
        int x = geti(eO_, e);
        int y = geti(eP_, e);
        if (getz(eHandsAnchored, e)) {
            x += geti(eM_, e);
            y += geti(eN_, e);
        }
        int flags = table[moveId[idx] * 14 + 8];
        boolean facing = getz(eFacingRight, e);
        if ((flags & 0x1000) != 0 && facing != ba) {
            facing ^= true;
        }
        boolean blend = f != -1 && (flags & 0x20) == 0;
        String s = keyframe(blob, f, ee, gg);
        String s2 = keyframe(blob, b, a, c);
        if (blend && bc != bb) {
            x = x * j + h * (256 - j) >> 8;
            y = y * j + i * (256 - j) >> 8;
        }
        int t = blend ? j << 8 : -1;
        sb.append(",\"draw\":{\"x\":").append(x).append(",\"y\":").append(y);
        sb.append(",\"flip\":").append(facing).append(",\"blend\":").append(blend);
        sb.append(",\"s\":").append(s).append(",\"s2\":").append(s2).append(",\"t\":").append(t).append('}');
    }

    /** var_short_arr_h[frame % count + first] with Java semantics; null if the game itself would throw. */
    static String keyframe(short[] blob, int frame, int count, int first) {
        try {
            return Integer.toString(blob[frame % count + first]);
        } catch (ArithmeticException | ArrayIndexOutOfBoundsException ex) {
            return "null";
        }
    }

    static void appendInt(StringBuilder sb, String name, int v) {
        sb.append(",\"").append(name).append("\":").append(v);
    }

    static void appendBool(StringBuilder sb, String name, boolean v) {
        sb.append(",\"").append(name).append("\":").append(v);
    }

    static String escape(String s) {
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (c == '"' || c == '\\') sb.append('\\').append(c);
            else if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
            else sb.append(c);
        }
        return sb.toString();
    }

    // ---------------------------------------------------------------- main

    public static void main(String[] args) throws Exception {
        if (args.length != 4) {
            System.err.println("usage: java Oracle <level 0-11> <missionType 0-5> <script.txt> <out.jsonl>");
            System.exit(2);
        }
        int level = Integer.parseInt(args[0]);
        int missionType = Integer.parseInt(args[1]);
        Path script = Paths.get(args[2]);
        Path out = Paths.get(args[3]);
        List<Entry> entries = parseScript(script);
        int totalSteps = 0;
        for (Entry en : entries) totalSteps += en.ticks;

        init(level, missionType);

        // sanity checks against known values
        Object e = player();
        int startX = geti(dStartX, null), startY = geti(dStartY, null);
        check(geti(dScreenState, null) == 5, "screen state is 5");
        check(geti(dMissionType, null) == missionType, "mission type set");
        check(geti(dScreenW, null) == 240, "screen width 240");
        check(geti(eAccelY, e) == 8800, "entity gravity 8800");
        check(geti(eK, e) == startX * 1024, "player x == startX*1024");
        check(geti(eL, e) == startY * 1024 + 1024, "player y == startY*1024+1024");
        check(((int[]) get(dMoveTable, null)).length == 2366, "state table has 2366 ints");
        check(geti(eO, e) == 65536 && geti(eP, e) == 65536, "jump power full");

        if (out.getParent() != null) Files.createDirectories(out.getParent());
        int ay = geti(dAy, null);
        TreeSet<Integer> movesSeen = new TreeSet<>();
        TreeSet<Integer> rivalMovesSeen = new TreeSet<>();
        int minQ = Integer.MAX_VALUE, maxQ = Integer.MIN_VALUE, minL = Integer.MAX_VALUE, maxL = Integer.MIN_VALUE;
        int pitSteps = 0, rivalExhaustedAt = -1, rivalFirstStep = -1;
        try (BufferedWriter w = Files.newBufferedWriter(out, StandardCharsets.UTF_8)) {
            writeMeta(w, level, missionType, script.getFileName().toString(), totalSteps);
            writeStep(w, 0, 0, "-", false);
            int step = 0;
            boolean ended = false;
            outer:
            for (Entry en : entries) {
                for (int t = 0; t < en.ticks; t++) {
                    String key = t == 0 ? en.key : "-";
                    int bits = bitsFor(key, getz(eFacingRight, player()));
                    ended = step(bits);
                    step++;
                    writeStep(w, step, bits, key, ended);
                    int[] moveId = (int[]) get(dMoveId, null);
                    movesSeen.add(moveId[ay]);
                    if (moveId[ay] == 11) pitSteps++;
                    for (int n = 0; n < ay; n++) {
                        if (rivalInputs[n] == null) continue;
                        if (rivalFirstStep < 0) rivalFirstStep = step;
                        rivalMovesSeen.add(moveId[n]);
                        if (rivalInputs[n] == -1 && rivalExhaustedAt < 0) rivalExhaustedAt = step;
                    }
                    int q = geti(eQ, player()), l = geti(eL, player());
                    minQ = Math.min(minQ, q); maxQ = Math.max(maxQ, q);
                    minL = Math.min(minL, l); maxL = Math.max(maxL, l);
                    if (ended) {
                        System.err.println("mission ended at step " + step + ": " + endReason()
                                + " (screen state " + geti(dScreenState, null) + ")");
                        break outer;
                    }
                }
            }
            System.err.println("wrote " + out + ": " + step + " steps, moves seen " + movesSeen
                    + ", q in [" + minQ + ", " + maxQ + "], l in [" + minL + ", " + maxL + "]"
                    + ", final move " + ((int[]) get(dMoveId, null))[ay]
                    + ", score " + geti(fScore, scoreStruct()) + ", meter " + geti(dMeter, null)
                    + ", pit-safety steps " + pitSteps
                    + (ay > 0 ? ", rival first stepped at " + rivalFirstStep + ", recording exhausted at "
                            + rivalExhaustedAt + ", rival moves " + rivalMovesSeen : ", no rivals"));
        }
    }

    static void check(boolean ok, String what) {
        if (!ok) throw new IllegalStateException("sanity check failed: " + what);
        System.err.println("ok: " + what);
    }
}
