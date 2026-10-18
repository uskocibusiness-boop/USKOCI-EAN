import { StyleSheet } from 'react-native';
import { ruleWidth } from '../layout';
import { sys } from '../tokens';

// Historical file/count limits made new card families impossible. Divider choice is
// now a material decision; control edges and readable text have separate contrast tests.
it('supports a visible default divider and a real native optical hairline',()=>{
  expect(Number.isFinite(ruleWidth)).toBe(true);expect(ruleWidth).toBeGreaterThan(0);
  expect(Number.isFinite(StyleSheet.hairlineWidth)).toBe(true);expect(StyleSheet.hairlineWidth).toBeGreaterThan(0);
});
it('the default rule reads its shared color, independently of how many separators a screen needs',()=>{
  expect(sys.rule.width).toBe(ruleWidth);expect(sys.rule.color).toBe(sys.color.line);
  expect(sys.color.line).toMatch(/^#[0-9A-F]{6}$/);
});
