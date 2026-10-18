import { sys } from '../tokens';
const luminance=(color:string)=>{const c=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;};
const ratio=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
it.each(Object.entries(sys.status))('%s status text passes AA on its own material',(_name,pair)=>{
  expect(ratio(pair.foreground,pair.background)).toBeGreaterThanOrEqual(4.5);
});
it.each([sys.color.surface,sys.color.wash,...Object.values(sys.status).map(p=>p.background)])('body and secondary text remain readable on %s',background=>{
  expect(ratio(sys.color.ink,background)).toBeGreaterThanOrEqual(4.5);
  expect(ratio(sys.color.muted,background)).toBeGreaterThanOrEqual(4.5);
});
it('primary and attention actions have readable labels; selection is not color alone',()=>{
  expect(ratio(sys.color.onGreen,sys.color.green)).toBeGreaterThanOrEqual(4.5);
  expect(ratio(sys.color.onOrange,sys.color.orange)).toBeGreaterThanOrEqual(4.5);
  expect(ratio(sys.color.orangeInk,sys.color.surface)).toBeGreaterThanOrEqual(4.5);
  expect(ratio(sys.color.lineStrong,sys.color.surface)).toBeGreaterThanOrEqual(3);
});
