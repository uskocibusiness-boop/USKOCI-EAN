#!/usr/bin/env python3
"""Local regressions of document assembly, not tests of USKOČI or legal compliance."""
from __future__ import annotations
import hashlib, importlib.util, json, re, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('assembly',ROOT/'alati/sastavi.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)

def fixture_facts():
    f=a.load('podaci/cinjenice.json')
    for key in a.load('podaci/oznake.json'):f[key]='Potvrđeni tekst za lokalni tehnički test.'
    f.update(operator_name='Tehnički primer',public_email='podrska@example.com',base_url='https://example.com',effective_date='2026-10-08',
      retention_schedule='| Grupa | Rok i događaj |\n| --- | --- |\n| Primer za test | Prema potvrđenom testnom zapisu |')
    f['_odobrenje']={key:True for key in f['_odobrenje']}
    return f

class DocumentTests(unittest.TestCase):
    def test_01_exact_seven_public(self):self.assertEqual(len(a.load('podaci/dokumenti.json')),7)
    def test_02_real_facts_unapproved(self):self.assertTrue(a.fact_warnings(a.load('podaci/cinjenice.json')))
    def test_03_actual_retention_is_required(self):
        f=fixture_facts();f['retention_schedule']='';self.assertIn('Nedostaje: retention_schedule',a.fact_warnings(f))
    def test_04_old_retention_not_inserted(self):
        x,_=a.body('{{retention_schedule}}',a.load('podaci/cinjenice.json'),'privatnost');self.assertIn('data-field="retention_schedule"',x);self.assertNotIn('10 godina',x)
    def test_05_name_is_pending_until_confirmed(self):
        x,_=a.body('{{operator_name}}',a.load('podaci/cinjenice.json'),'operater');self.assertIn('potvrditi zvaničan zapis',x)
    def test_06_no_name_pending_when_confirmed(self):
        x,_=a.body('{{operator_name}}',fixture_facts(),'operater',release=True);self.assertNotIn('pending',x)
    def test_07_invalid_date(self):
        f=fixture_facts();f['effective_date']='2026-02-30';self.assertTrue(a.fact_warnings(f))
    def test_08_email_and_domain_guard(self):
        for field,val in [('public_email','x@host.invalid'),('public_email','bad'),('base_url','http://example.com'),('base_url','https://name:password@example.com')]:
            f=fixture_facts();f[field]=val;self.assertTrue(a.fact_warnings(f))
    def test_09_approval_not_truthy_string(self):
        f=fixture_facts();f['_odobrenje']['odobreno_javno_izdvajanje']='true';self.assertTrue(a.fact_warnings(f))
    def test_10_no_unresolved_marker_in_release(self):
        with self.assertRaises(ValueError):a.body('{{unknown_source_field}}',fixture_facts(),'p',release=True)
    def test_11_markers_in_facts(self):
        f=fixture_facts();f['providers_notice']='[POTVRDITI: servis]';self.assertTrue(a.fact_warnings(f))
    def test_12_html_input_sanitized(self):
        f=fixture_facts();f['providers_notice']='<script>alert(1)</script><img src="https://example.com/spy" onerror="alert(1)"><p onclick="x()">Text</p><a href="javascript:alert(1)">Bad</a>'
        x,_=a.body('{{providers_notice}}',f,'privatnost');s=BeautifulSoup(x,'html.parser')
        self.assertFalse(s.select('script,img'));self.assertNotIn('onclick',x);self.assertNotIn('javascript:',x)
    def test_13_combined_anchor(self):
        x,_=a.body('## Rokovi {#rokovi}\n\n[Drugo](doc:uslovi-koriscenja#status)',fixture_facts(),'privatnost',combined=True)
        self.assertIn('id="privatnost--rokovi"',x);self.assertIn('href="#uslovi-koriscenja--status"',x)
    def test_14_standalone_anchor(self):
        x,_=a.body('[Drugo](doc:uslovi-koriscenja#status)',fixture_facts(),'privatnost');self.assertIn('../uslovi-koriscenja/index.html#status',x)
    def test_15_source_placeholders_have_labels(self):
        labels=set(a.load('podaci/oznake.json'))|{'deletion_email_action'}
        for d in a.load('podaci/dokumenti.json'):
            self.assertFalse(set(re.findall(r'\{\{([a-z_]+)\}\}',(ROOT/d['source']).read_text()))-labels)
    def test_16_offline_form_has_every_field_once(self):
        s=BeautifulSoup((ROOT/'USKOCI_Dopuna_podataka_v4_3.html').read_text(),'html.parser');d=json.loads(s.find(id='data').string)
        fields=[k for g in d['groups'] for k in g['fields']]
        self.assertEqual(len(fields),len(set(fields)));self.assertEqual(set(fields),set(d['labels']));self.assertFalse(any(d['facts']['_odobrenje'].values()))
    def test_17_refuses_real_release_without_side_effect(self):
        with tempfile.TemporaryDirectory() as tmp:
            r=Path(tmp)/'package';shutil.copytree(ROOT,r)
            p=subprocess.run([sys.executable,str(r/'alati/sastavi.py'),'--javno'],text=True,capture_output=True)
            self.assertEqual(p.returncode,2);self.assertFalse((r/'javno_za_objavu').exists())
    def test_18_fixture_release_isolated_and_clean(self):
        with tempfile.TemporaryDirectory() as tmp:
            r=Path(tmp)/'package';shutil.copytree(ROOT,r)
            (r/'podaci/cinjenice.json').write_text(json.dumps(fixture_facts(),ensure_ascii=False))
            p=subprocess.run([sys.executable,str(r/'alati/sastavi.py'),'--javno'],text=True,capture_output=True)
            self.assertEqual(p.returncode,0,p.stderr+p.stdout)
            dest=r/'javno_za_objavu';htmls=list(dest.rglob('*.html'));self.assertEqual(len(htmls),8)
            self.assertFalse((dest/'index.html').exists());self.assertFalse((dest/'interno').exists());self.assertFalse(list(dest.rglob('*.json')))
            for h in htmls:
                s=BeautifulSoup(h.read_text(),'html.parser');self.assertFalse(s.select('.pending'));self.assertNotIn('{{',str(s))
            m=json.loads((r/'predaja/otisci_javnih_fajlova.json').read_text());self.assertEqual(m['package_version'],'4.3')
            for item in m['files']:self.assertEqual(item['local_file_sha256'],hashlib.sha256((dest/item['path']).read_bytes()).hexdigest())
    def test_19_all_current_public_sources_have_output(self):
        for d in a.load('podaci/dokumenti.json'):self.assertTrue((ROOT/'pregled/sajt'/d['slug']/'index.html').exists())
    def test_20_no_fake_permanent_suspension_or_blanket_waiver(self):
        text='\n'.join((ROOT/d['source']).read_text() for d in a.load('podaci/dokumenti.json'))
        self.assertIn('Sama oznaka „HITNO“',text);self.assertIn('sopstvene obaveze',text)

if __name__=='__main__':
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(DocumentTests)
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    report={'scope':'Offline package assembly ONLY. No app/device, legal, live URL or store approval.',
            'tests_run':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'passed':result.wasSuccessful(),
            'fixture_note':'Successful release path tested only with artificial data in an automatically removed temporary folder. Real facts remain unapproved.'}
    (ROOT/'provera').mkdir(exist_ok=True)
    (ROOT/'provera/alati_v4_3.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    sys.exit(0 if result.wasSuccessful() else 1)
