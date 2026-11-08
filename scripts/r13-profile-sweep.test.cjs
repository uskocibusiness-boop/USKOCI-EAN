'use strict';
const test=require('node:test');
const {fixture,cases}=require('./r13-profile-sweep-fixture.cjs');
for(const [name,scenario]of cases)test('R13 profile step: '+name,async()=>{
 const f=await fixture();try{await scenario(f);}finally{await f.db.close();}
});
