import java.lang.instrument.ClassFileTransformer;
import java.lang.instrument.Instrumentation;
import java.security.ProtectionDomain;
import java.time.Instant;
import org.objectweb.asm.ClassAdapter;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.MethodAdapter;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;

/**
 * A Java agent that gives the original a phone's frame rate, on a clock a script can aim at.
 *
 * The game's loop never sleeps: it draws a frame, yields and goes on, and measures time by the
 * length of its frames, `ch = frame ms * 900 >> 10` (decompiled d.java 10477). On a phone a
 * frame took tens of milliseconds; in the emulator on a virtual screen it takes under one, so
 * `ch` rounds to 0 every frame: the race clock stays at 0:00.00, the flyover never moves and
 * the runner moves only when a key press happens to slow a frame down.
 *
 * The agent rewrites the game's class `d` as it loads:
 *
 * - `t()`, the method the loop calls once a frame to ask for a repaint, first calls `frame()`,
 *   which sleeps until the next tick of a grid of the chosen frame length laid on the wall clock
 *   (tick k at k frame lengths after the epoch);
 * - every `System.currentTimeMillis()` in `d` becomes `millis()`, the time of the last tick.
 *
 * So every frame lasts exactly one frame length in the game's eyes, whatever the frame really
 * took, and starts on a tick that record.sh can compute too: a press sent in the middle between
 * two ticks is read by the frame of the next tick, never one frame early or late. At 35 ms the
 * game advances `35 * 900 >> 10 = 30` ms a frame, exactly one physics step, so a route's step n
 * is read n frames after the press that started the race.
 *
 * With `unlock` it also makes `j(int)`, the level menu's lock check (`boolean_j`, d.java
 * 10355: enough missions done for the level), always answer yes, so a take can go to any level
 * from a fresh start. Nothing else of the game changes: the check is the menu's only use of it.
 *
 * The once-a-frame method is `t()` in the original kept here (1.0.8) and `s()` in the 1.0.4
 * build (the obfuscator named them apart; the code is the same): `frame=<name>` picks it.
 *
 * The jar itself is not changed. The ASM used here (the 3.x API) comes with MicroEmulator,
 * which rewrites MIDlets with it too. Started with
 * `-javaagent:pace.jar=<frame ms>[,frame=<method>][,unlock]`.
 */
public final class Pace implements ClassFileTransformer {
  private final long period;
  private final boolean unlock;
  private final String frameMethod;

  private Pace(long period, boolean unlock, String frameMethod) {
    this.period = period;
    this.unlock = unlock;
    this.frameMethod = frameMethod;
  }

  public static void premain(String args, Instrumentation instrumentation) {
    String[] parts = args == null || args.isEmpty() ? new String[] {"35"} : args.split(",");
    double ms = Double.parseDouble(parts[0]);
    boolean unlock = false;
    String frame = "t";
    for (int i = 1; i < parts.length; i++) {
      if ("unlock".equals(parts[i])) unlock = true;
      else if (parts[i].startsWith("frame=")) frame = parts[i].substring(6);
    }
    instrumentation.addTransformer(new Pace(Math.round(ms * 1_000_000), unlock, frame));
  }

  private static long now() {
    Instant now = Instant.now();
    return now.getEpochSecond() * 1_000_000_000L + now.getNano();
  }

  /*
   * The two methods below get the frame length with every call because the game's class loader
   * (MicroEmulator's MIDlet loader) loads its own copy of this class, which `premain` never ran in.
   */

  /** Called by the game once a frame, before it asks for the repaint: waits for the next tick. */
  public static void frame(long period) {
    long tick = (now() / period + 1) * period;
    for (long wait = tick - now(); wait > 0; wait = tick - now()) {
      try {
        Thread.sleep(wait / 1_000_000, (int) (wait % 1_000_000));
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return;
      }
    }
  }

  /** The game's clock: the time of the last tick, in milliseconds. */
  public static long millis(long period) {
    return now() / period * period / 1_000_000;
  }

  @Override
  public byte[] transform(
      ClassLoader loader, String name, Class<?> redefined, ProtectionDomain domain, byte[] bytes) {
    if (!"d".equals(name)) return null;
    ClassReader reader = new ClassReader(bytes);
    ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
    final Long length = period;
    final boolean open = unlock;
    final String framed = frameMethod;
    reader.accept(
        new ClassAdapter(writer) {
          @Override
          public MethodVisitor visitMethod(
              int access, String method, String desc, String signature, String[] exceptions) {
            final boolean paced = framed.equals(method) && "()V".equals(desc);
            final boolean lock = open && "j".equals(method) && "(I)Z".equals(desc);
            return new MethodAdapter(super.visitMethod(access, method, desc, signature, exceptions)) {
              @Override
              public void visitCode() {
                super.visitCode();
                if (lock) {
                  super.visitInsn(Opcodes.ICONST_1);
                  super.visitInsn(Opcodes.IRETURN);
                }
                if (!paced) return;
                super.visitLdcInsn(length);
                super.visitMethodInsn(Opcodes.INVOKESTATIC, "Pace", "frame", "(J)V");
              }

              @Override
              public void visitMethodInsn(int opcode, String owner, String called, String type) {
                if (opcode == Opcodes.INVOKESTATIC
                    && "java/lang/System".equals(owner)
                    && "currentTimeMillis".equals(called)) {
                  super.visitLdcInsn(length);
                  super.visitMethodInsn(Opcodes.INVOKESTATIC, "Pace", "millis", "(J)J");
                } else {
                  super.visitMethodInsn(opcode, owner, called, type);
                }
              }
            };
          }
        },
        0);
    System.err.println(
        "pace: d."
            + frameMethod
            + "() runs on a "
            + period / 1e6
            + " ms frame grid"
            + (unlock ? ", every level open" : ""));
    return writer.toByteArray();
  }
}
