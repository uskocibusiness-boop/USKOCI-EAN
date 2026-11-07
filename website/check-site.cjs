#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const expected=['index','about','download','documents','privacy','terms','delete-account','privacy-choices','data-safety','safety','complaints','support','cookies','operator','404'];
const errors=[];
const text=(name)=>fs.readFileSync(path.join(root,name),'utf8');
const known=new Set(expected.map(x=>x==='index'?'/':'/'+x));
const localFiles=new Set(['styles.css','assets/mark.svg']);
const pages={};
for(const slug of expected){
 const file=slug+'.html';
 if(!fs.existsSync(path.join(root,file))){errors.push('Missing '+file);continue;}
 const data=pages[slug]=text(file);
 if(!data.includes('<html lang="sr-Latn">'))errors.push(file+': language');
 if(!data.includes('name="viewport"'))errors.push(file+': viewport');
 if(!data.includes('name="description"'))errors.push(file+': description');
 if(!data.includes('rel="canonical"'))errors.push(file+': canonical');
 if(!data.includes('name="robots" content="noindex,follow"'))errors.push(file+': staging robots (legal release not approved)');
 if(!data.includes('<header class="header">')||!data.includes('<footer class="footer">'))errors.push(file+': shared navigation');
 for(const m of data.matchAll(/(?:href|src)="(\/[^"]*)"/g)){
   const dest=m[1].split(/[?#]/)[0];
   if(!dest)continue;
   if(dest.startsWith('/assets/')||dest.endsWith('.css')){
     if(!localFiles.has(dest.slice(1))||!fs.existsSync(path.join(root,dest.slice(1))))errors.push(file+': missing '+dest);
   }else if(!known.has(dest))errors.push(file+': missing route '+dest);
   if(m[1].includes('#')){
     const hash=m[1].split('#')[1].split('?')[0];
     if(hash){
       const target=dest==='/'?'index':dest.slice(1);
       if(pages[target]&&!pages[target].includes('id="'+hash+'"'))errors.push(file+': broken anchor '+m[1]);
     }
   }
 }
}
if(!pages.privacy?.includes('10 godina')||!pages.privacy?.includes('30 dana'))errors.push('Privacy retention');
if(!pages['delete-account']?.includes('mailto:uskoci.support@gmail.com'))errors.push('Deletion contact');
if(!pages['delete-account']?.includes('sam')&&!pages['delete-account']?.includes('automatsko'))errors.push('Honest deletion disclosure');
const urls=Object.values(pages).join('\n');
if(/\bservice_role\b|sk-proj-|AIza[0-9A-Za-z_-]{30,}/i.test(urls))errors.push('Secret-like pattern');
if(/<script\b/i.test(urls))errors.push('Unexpected third-party scripts');
if(!fs.existsSync(path.join(root,'robots.txt'))||!text('robots.txt').includes('Disallow: /'))errors.push('Robots staging guard');
if(!fs.existsSync(path.join(root,'vercel.json'))||JSON.parse(text('vercel.json')).cleanUrls!==true)errors.push('Clean URL config');
if(!fs.existsSync(path.join(root,'sitemap.xml')))errors.push('Sitemap');
if(errors.length){console.error('USKOCI_SITE_CHECK: FAIL\n'+errors.map(e=>' - '+e).join('\n'));process.exit(1);}
console.log('USKOCI_SITE_CHECK: PASS ('+expected.length+' HTML pages, internal links, metadata, staging guard, deletion and retention)');
