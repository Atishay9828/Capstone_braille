import louis, os

TABLES = '/usr/share/liblouis/tables'

# --- Which display tables exist? ---
dis_files = [f for f in os.listdir(TABLES) if f.endswith('.dis')]
print("Display tables:", dis_files)

# --- Try different approaches to get Unicode Braille ---
tests = [
    (['en-us-g1.ctb'], 'a', 0),
    (['en-us-g1.ctb'], 'hello', 0),
]

# Add display table variants if they exist
for dis in ['unicode.dis', 'en-us-brf.dis']:
    if os.path.exists(os.path.join(TABLES, dis)):
        tests.append(([dis, 'en-us-g1.ctb'], 'a', 0))

print()
for tables, text, mode in tests:
    try:
        r = louis.translateString(tables, text, mode)
        codes = [hex(ord(c)) for c in r]
        in_braille_block = all(0x2800 <= ord(c) <= 0x283F for c in r if c.strip())
        print(f"tables={tables} text={text!r} mode={mode}")
        print(f"  result={repr(r)}  codes={codes}  unicode_braille={in_braille_block}")
    except Exception as e:
        print(f"tables={tables} text={text!r} FAILED: {e}")
    print()

# --- Check constants ---
print("louis.dotsIO =", getattr(louis, 'dotsIO', 'N/A'))
print("louis.ucBrl  =", getattr(louis, 'ucBrl', 'N/A'))
print()

# --- listTables format ---
all_tables = louis.listTables()
print("listTables() first entry:", all_tables[0])
print("basename works:", 'en-us-g1.ctb' in [os.path.basename(t) for t in all_tables])
