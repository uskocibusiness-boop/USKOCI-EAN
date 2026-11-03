import { PGlite } from '@electric-sql/pglite';
import { readFileSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const source=JSON.parse(readFileSync(new URL('./live-functions.json',import.meta.url),'utf8'));
const db=new PGlite();
await db.exec(`CREATE SCHEMA private; CREATE TABLE public.needs(mode text,requester_price_rsd integer,price_basis text,required_slots integer); CREATE TABLE private.agreement_reviews(target_account_id uuid,rating integer);`);
await db.exec(source.price.definition);
await db.exec(source.rep.definition);
const result={scope:'isolated PGlite executing actual captured DEV function bodies; minimal fixtures, no live business mutations',checks:[]};
await db.exec(`SELECT private.assert_application_price_v5(ROW('MY_PRICE',6000,'TOTAL',3)::public.needs,2,4000);`);
result.checks.push({case:'TOTAL 6000 / 3 people, offer for 2 people = 4000',result:'accepted'});
try { await db.exec(`SELECT private.assert_application_price_v5(ROW('MY_PRICE',1000,'HOURLY',2)::public.needs,2,1000);`); throw new Error('Expected current HOURLY gap'); }
catch(e){assert.match(e.message,/UNKNOWN_PRICE_BASIS/);result.checks.push({case:'MY_PRICE HOURLY 1000 per person per hour',result:e.message});}
const uid='00000000-0011-4111-8111-000000000003';
await db.query('INSERT INTO private.agreement_reviews VALUES($1,5)',[uid]);
const reputation=await db.query('SELECT private.account_reputation($1::uuid) AS value',[uid]);
assert.equal(reputation.rows[0].value.reviewCount,1);
assert.equal(reputation.rows[0].value.averageRating,5);
result.checks.push({case:'single review, no publication/completion/two-party check in actual aggregate',result:reputation.rows[0].value});
writeFileSync(new URL('./reproduction-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
await db.close();
