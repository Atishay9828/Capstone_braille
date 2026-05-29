import os, sys
sys.path.insert(0, '/mnt/c/Users/Lenovo/Capstone_braille')
import louis
from backend.services.translator import translate_text, _table_list, check_tables_available

print("louis file:", louis.__file__)
print("tables available:", check_tables_available())
print("_table_list('en-us-g1.ctb'):", _table_list('en-us-g1.ctb'))
r = translate_text('a')
print("translate 'a':", repr(r.braille_unicode), "cell_count:", r.cell_count)
r2 = translate_text('hello')
print("translate 'hello':", repr(r2.braille_unicode), "cell_count:", r2.cell_count)
