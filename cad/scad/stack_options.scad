// =========================================================
// BRAILLIX COORDINATED STACK OPTIONS
//
// Default exports remain the audited legacy stack. Render the non-destructive
// shaft-preserving candidate with:
//
//   openscad -D stack_repair_raise=4 ...
//
// The 4 mm value is not arbitrary. With the motor mounting face at world z=41,
// the measured Ø9 x 2 mm collar ends at z=43. A 4 mm cam hub seated on that
// collar puts the cam underside at z=47 and its flat surface at z=49: exactly
// 4 mm above the legacy cam-flat datum. Base standoffs, top plate, cell shell,
// and pod therefore move together by the same amount.
//
// This is a candidate until the real cam/linkage/spring and Hall tests pass.
// =========================================================

stack_repair_raise = is_undef(stack_repair_raise) ? 0 : stack_repair_raise;

assert(stack_repair_raise == 0 || stack_repair_raise == 4,
       "stack_repair_raise must be 0 (legacy audit) or 4 (Option A candidate)");

stack_option_a = stack_repair_raise == 4;

