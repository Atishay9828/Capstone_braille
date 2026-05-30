import os, sys, pathlib, louis

# Get system tables dir before changing LOUIS_TABLEPATH
tables_dir = os.path.dirname(louis.listTables()[0])
scripts_dir = str(pathlib.Path(__file__).parent)

# Include both our scripts/ (for nemeth.ctb) AND the system dir (for unicode.dis etc.)
os.environ["LOUIS_TABLEPATH"] = scripts_dir + ":" + tables_dir
print("LOUIS_TABLEPATH:", os.environ["LOUIS_TABLEPATH"])
print("scripts_dir:", scripts_dir)
print("nemeth.ctb exists:", os.path.exists(os.path.join(scripts_dir, "nemeth.ctb")))

tables_basenames = {os.path.basename(t) for t in louis.listTables()}
print("nemeth.ctb in listTables:", "nemeth.ctb" in tables_basenames)

r = louis.translateString(["unicode.dis", "nemeth.ctb"], "x^2 + 3")
all_braille = all(0x2800 <= ord(c) <= 0x283F for c in r)
print(f"Result: {repr(r)} cells={len(r)} braille={all_braille}")
print("PASSED" if all_braille and len(r) > 0 else "FAILED")
