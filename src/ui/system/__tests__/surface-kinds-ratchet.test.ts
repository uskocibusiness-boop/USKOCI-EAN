import { card, cardCompact, fieldBox, floating, raisedItem, sheetLift, sys } from '../tokens';
import type { ViewStyle } from 'react-native';

// Replaces the historical import-count ratchet. Central materials may be composed by
// new role-specific families; adding a valid family is not a design violation.
it.each(Object.entries({card,cardCompact,fieldBox,raisedItem}))('%s uses finite geometry and a shared readable surface',(_name,style)=>{
  expect(style.backgroundColor).toMatch(/^#[0-9A-F]{6}$/);
  for(const key of ['borderRadius','borderWidth','padding','minHeight'] as const){
    const value=(style as ViewStyle)[key]; if(value!==undefined){expect(Number.isFinite(value)).toBe(true);expect(value).toBeGreaterThanOrEqual(0);}
  }
});
it('touchable fields keep accessible minimum height independently of visual corner choice',()=>{
  expect(fieldBox.minHeight).toBeGreaterThanOrEqual(sys.touch.min);
});
it.each(Object.entries({floating,raisedItem,...sheetLift}))('%s has a native compatible elevation definition',(_name,style)=>{
  expect(typeof style.boxShadow==='string'||Array.isArray(style.boxShadow)||typeof style.elevation==='number').toBe(true);
  if(style.elevation!==undefined)expect(style.elevation).toBeGreaterThanOrEqual(0);
});
