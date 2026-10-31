import { readPublicSupabaseConfig } from '../publicSupabaseConfig';

const beforeUrl=process.env.EXPO_PUBLIC_SUPABASE_URL, beforeKey=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
afterAll(()=>{
  if(beforeUrl===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_URL;else process.env.EXPO_PUBLIC_SUPABASE_URL=beforeUrl;
  if(beforeKey===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY=beforeKey;
});

describe('one public backend target across native SDK, Auth, AI stream and location',()=>{
  beforeEach(()=>{
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  });
  it('uses existing canonical DEV pair only when both variables are absent',()=>{
    const fallback=readPublicSupabaseConfig();
    expect(fallback).toEqual({url:'https://leqcwgzvjsxugfgzdmth.supabase.co',anonKey:expect.any(String)});
    expect(fallback?.anonKey).toMatch(/^sb_publishable_/);
  });
  it.each(['URL_ONLY','KEY_ONLY','BLANK_URL','BLANK_KEY'])('never mixes a custom target and DEV key: %s',variant=>{
    if(variant==='URL_ONLY')process.env.EXPO_PUBLIC_SUPABASE_URL='https://another.example.test';
    if(variant==='KEY_ONLY')process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='another-public-key';
    if(variant==='BLANK_URL'){
      process.env.EXPO_PUBLIC_SUPABASE_URL=' ';process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='another-public-key';
    }
    if(variant==='BLANK_KEY'){
      process.env.EXPO_PUBLIC_SUPABASE_URL='https://another.example.test';process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='';
    }
    expect(readPublicSupabaseConfig()).toBeNull();
  });
  it.each(['http://other.example.test','https://someone@example.test','https://example.test/path',
    'https://example.test/?token=x','https://example.test/#fragment','not-a-url'])('rejects invalid public endpoint %s',url=>{
    process.env.EXPO_PUBLIC_SUPABASE_URL=url;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='another-public-key';
    expect(readPublicSupabaseConfig()).toBeNull();
  });
  it('uses a complete normalized HTTPS pair without changing the publishable key',()=>{
    process.env.EXPO_PUBLIC_SUPABASE_URL=' https://another.example.test/ ';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY=' another-public-key ';
    expect(readPublicSupabaseConfig()).toEqual({url:'https://another.example.test',anonKey:'another-public-key'});
  });
  it('allows an explicit local HTTP target without permitting arbitrary insecure hosts',()=>{
    process.env.EXPO_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321/';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='local-public-key';
    expect(readPublicSupabaseConfig()).toEqual({url:'http://127.0.0.1:54321',anonKey:'local-public-key'});
  });
});
