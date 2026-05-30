import louis, os

TABLES_DIR = os.path.dirname(louis.listTables()[0])
print("Tables dir:", TABLES_DIR)
print("nemethdefs.cti exists:", os.path.exists(os.path.join(TABLES_DIR, "nemethdefs.cti")))
print("en-us-mathtext.ctb exists:", os.path.exists(os.path.join(TABLES_DIR, "en-us-mathtext.ctb")))
print("nemeth.ctb exists:", os.path.exists(os.path.join(TABLES_DIR, "nemeth.ctb")))

tests = ["x", "1 + 1 = 2", "x^2 + 3x + 2 = 0"]

print("\n--- en-us-mathtext.ctb ---")
for t in tests:
    try:
        r = louis.translateString(["unicode.dis", "en-us-mathtext.ctb"], t)
        codes = [hex(ord(c)) for c in r]
        in_braille = all(0x2800 <= ord(c) <= 0x283F for c in r)
        print(f"  {t!r} -> {repr(r)} braille={in_braille} cells={len(r)}")
    except Exception as e:
        print(f"  {t!r} -> ERROR: {e}")

print("\n--- nemethdefs.cti alone ---")
for t in tests[:1]:
    try:
        r = louis.translateString(["unicode.dis", "nemethdefs.cti"], t)
        print(f"  {t!r} -> {repr(r)} cells={len(r)}")
    except Exception as e:
        print(f"  {t!r} -> ERROR: {e}")
