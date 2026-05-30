import os, pathlib, louis

TABLES_DIR = os.path.dirname(louis.listTables()[0])
SCRIPTS_DIR = str(pathlib.Path(__file__).parent)
NEMETH_CTB = os.path.join(SCRIPTS_DIR, "nemeth.ctb")
UNICODE_DIS = os.path.join(TABLES_DIR, "unicode.dis")

print("nemeth.ctb:", NEMETH_CTB, "exists:", os.path.exists(NEMETH_CTB))
print("unicode.dis:", UNICODE_DIS, "exists:", os.path.exists(UNICODE_DIS))

# Test: pass ABSOLUTE PATHS directly to translateString
r = louis.translateString([UNICODE_DIS, NEMETH_CTB], "x^2 + 3x + 2 = 0")
all_braille = all(0x2800 <= ord(c) <= 0x283F for c in r)
print(f"Result: {repr(r)} cells={len(r)} braille={all_braille}")
print("PASSED" if all_braille and len(r) > 0 else "FAILED")
