"""Petra Radko: her own looks (pr_her.py), her twin brother's (pr_looks.py) and her effect
(pr_fx.py, which also keeps `effect` in boss.json)."""
import pr_her
import pr_looks  # noqa: F401  (her brother's looks)
import pr_fx  # noqa: F401  (the effect)

# Her looks are written on demand (`python pr_her.py kate` draws one); here all of them.
for write_look in pr_her.LOOKS.values():
    write_look()
