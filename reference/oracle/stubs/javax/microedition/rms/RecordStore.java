package javax.microedition.rms;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * In-memory record store. Nothing exists at start-up, so the game sees "no saved
 * options / no records / no names" and falls back to its defaults; writes made during
 * a run (progress, options) are kept only for the lifetime of the process.
 */
public class RecordStore {
    private static final Map<String, List<byte[]>> STORES = new HashMap<>();

    private final String name;
    private boolean open = true;

    private RecordStore(String name) {
        this.name = name;
    }

    public static RecordStore openRecordStore(String name, boolean createIfNecessary) throws RecordStoreException {
        synchronized (STORES) {
            if (!STORES.containsKey(name)) {
                if (!createIfNecessary) {
                    throw new RecordStoreNotFoundException(name);
                }
                STORES.put(name, new ArrayList<>());
            }
        }
        return new RecordStore(name);
    }

    public static void deleteRecordStore(String name) throws RecordStoreException {
        synchronized (STORES) {
            if (STORES.remove(name) == null) {
                throw new RecordStoreNotFoundException(name);
            }
        }
    }

    public static String[] listRecordStores() {
        synchronized (STORES) {
            return STORES.keySet().toArray(new String[0]);
        }
    }

    private List<byte[]> records() throws RecordStoreException {
        if (!open) {
            throw new RecordStoreException("closed: " + name);
        }
        List<byte[]> r;
        synchronized (STORES) {
            r = STORES.get(name);
        }
        if (r == null) {
            throw new RecordStoreNotFoundException(name);
        }
        return r;
    }

    public void closeRecordStore() throws RecordStoreException {
        open = false;
    }

    public String getName() {
        return name;
    }

    public int getNumRecords() throws RecordStoreException {
        return records().size();
    }

    public int getSize() throws RecordStoreException {
        int n = 0;
        for (byte[] b : records()) n += b.length;
        return n;
    }

    public int getSizeAvailable() throws RecordStoreException {
        return 1 << 20;
    }

    public int getNextRecordID() throws RecordStoreException {
        return records().size() + 1;
    }

    public int addRecord(byte[] data, int offset, int numBytes) throws RecordStoreException {
        byte[] copy = new byte[numBytes];
        if (numBytes > 0) System.arraycopy(data, offset, copy, 0, numBytes);
        List<byte[]> r = records();
        r.add(copy);
        return r.size();
    }

    public void setRecord(int recordId, byte[] data, int offset, int numBytes) throws RecordStoreException {
        List<byte[]> r = records();
        if (recordId < 1 || recordId > r.size()) {
            throw new RecordStoreException("no record " + recordId);
        }
        byte[] copy = new byte[numBytes];
        if (numBytes > 0) System.arraycopy(data, offset, copy, 0, numBytes);
        r.set(recordId - 1, copy);
    }

    public byte[] getRecord(int recordId) throws RecordStoreException {
        List<byte[]> r = records();
        if (recordId < 1 || recordId > r.size()) {
            throw new RecordStoreException("no record " + recordId);
        }
        return r.get(recordId - 1).clone();
    }

    public int getRecord(int recordId, byte[] buffer, int offset) throws RecordStoreException {
        byte[] b = getRecord(recordId);
        System.arraycopy(b, 0, buffer, offset, b.length);
        return b.length;
    }

    public int getRecordSize(int recordId) throws RecordStoreException {
        return getRecord(recordId).length;
    }

    public void deleteRecord(int recordId) throws RecordStoreException {
        List<byte[]> r = records();
        if (recordId < 1 || recordId > r.size()) {
            throw new RecordStoreException("no record " + recordId);
        }
        r.remove(recordId - 1);
    }
}
