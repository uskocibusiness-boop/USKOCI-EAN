"""Proof assertion regressions; these are not substituted for Android pixels."""
import ast
import copy
import hashlib
import json
from pathlib import Path
import unittest
from tempfile import TemporaryDirectory
import xml.etree.ElementTree as ET
from unittest.mock import Mock, patch
from scripts import ai_review_android_journey as journey

journey.load_shared_helpers()


def tree(xml):
    root = ET.fromstring(xml)
    return root, {child: p for p in root.iter() for child in p}


class NativeAssertions(unittest.TestCase):
    @staticmethod
    def native108():
        return {'result':'PASS','unit':'NATIVE_MARKETPLACE_SOURCE108','source_sha':'a'*40,'source_migration_count':108,'original_history_count':106,'history_count':108,
                'localOnly':True,'original_history_preserved':True,'business_and_policy_rows_preserved':True,
                'live_access':False,'live_promotion':False,'provider_called':False,'policy_activated':False,'transport_enabled':False,'concurrency_proven':False,
                'history_sha256':'b'*64,'applied_successors':[{'ordinal':107},{'ordinal':108}],'input_sha256':{'synthetic_fixture':'c'*64}}

    def test_current_ai_login_waits_for_current_shell_without_core_history_flag(self):
        for scope in ('intake', 'marketplace'):
            with self.subTest(scope=scope), patch.dict(journey.os.environ, {'AI_REVIEW_SCOPE':scope}), \
                    patch.dict(journey.__dict__, {'PASSWORD':'local-fixture-only'}), \
                    patch.object(journey, 'core_mode', return_value=False), \
                    patch.object(journey, 'open_login_sheet') as open_sheet, \
                    patch.object(journey, 'edit_text') as edit, patch.object(journey, 'hide_keyboard'), \
                    patch.object(journey, 'tap') as tap, patch.object(journey, 'wait_visible') as wait:
                journey.login('fixture@example.invalid')
                open_sheet.assert_called_once_with()
                self.assertEqual(edit.call_args_list, [unittest.mock.call(0, 'fixture@example.invalid'), unittest.mock.call(1, 'local-fixture-only')])
                tap.assert_called_once_with(text='Prijavite se', prefer='bottom', timeout=30)
                wait.assert_called_once_with(desc='Zadaci', timeout=60)

    def test_unscoped_legacy_login_retains_its_exact_shell_anchor(self):
        with patch.dict(journey.os.environ, {}, clear=True), patch.dict(journey.__dict__, {'PASSWORD':'local-fixture-only'}), \
                patch.object(journey, 'core_mode', return_value=False), patch.object(journey, 'open_login_sheet'), \
                patch.object(journey, 'edit_text'), patch.object(journey, 'hide_keyboard'), \
                patch.object(journey, 'tap'), patch.object(journey, 'wait_visible') as wait:
            journey.login('fixture@example.invalid')
        wait.assert_called_once_with(text='MENI TREBA', timeout=60)

    @staticmethod
    def d03_switch_scope():
        # Compile the actual helper only, without executing the physical journey.
        source=Path(__file__).with_name('d03_chat_android_journey.py')
        functions=[node for node in ast.parse(source.read_text(encoding='utf-8')).body
                   if isinstance(node, ast.FunctionDef) and node.name=='switch_account']
        assert len(functions)==1
        names=('tap','assert_shell','core_profile','wait_visible','assert_signed_out_surface',
               'login','switch_to_worker_workspace','open_chat')
        flow=Mock(spec=names)
        scope={name:getattr(flow,name) for name in names}
        scope['core_mode']=lambda:True
        exec(compile(ast.Module(body=functions,type_ignores=[]),str(source),'exec'),scope)
        return scope,flow

    def test_d03_account_switch_uses_observed_open_auth_form_before_real_login(self):
        scope,flow=self.d03_switch_scope()
        scope['switch_account']('fixture@example.invalid','worker',to_worker=True)
        self.assertEqual(flow.mock_calls, [
            unittest.mock.call.tap(desc='Nazad'), unittest.mock.call.assert_shell('worker'),
            unittest.mock.call.core_profile(), unittest.mock.call.tap(desc='Odjavite se'),
            unittest.mock.call.wait_visible(desc='Prijavite se',timeout=60),
            unittest.mock.call.assert_signed_out_surface(form_open=True),
            unittest.mock.call.login('fixture@example.invalid',form_open=True),
            unittest.mock.call.assert_shell('requester'), unittest.mock.call.switch_to_worker_workspace(),
            unittest.mock.call.assert_shell('worker'), unittest.mock.call.open_chat()])

    def test_d03_missing_actual_auth_form_stops_before_login_or_chat(self):
        scope,flow=self.d03_switch_scope()
        flow.wait_visible.side_effect=RuntimeError('Actual Auth form not observed')
        with self.assertRaises(RuntimeError):
            scope['switch_account']('fixture@example.invalid','worker')
        flow.login.assert_not_called()
        flow.open_chat.assert_not_called()

    def test_current_requester_list_uses_selected_moji_and_preserves_three_zone_assertion(self):
        root, parents=tree('<hierarchy><node text="Zadaci"/><node text="Ono što ti je potrebno"/><node content-desc="Moji" selected="true" enabled="true" clickable="true" bounds="[20,200][200,300]"/></hierarchy>')
        with patch.object(journey,'clean_surface',return_value=(root,parents)) as surface, patch.object(journey,'screen_size',return_value=(1080,2400)), patch.object(journey,'assert_shell_tree') as zones:
            journey.assert_requester_list()
            surface.assert_called_once_with('Zadaci')
            zones.assert_called_once_with(root,parents,1080,2400,('Zadaci','Novi Zadatak','Dogovori'))
            next(n for n in root.iter() if n.attrib.get('content-desc')=='Moji').attrib['selected']='false'
            with self.assertRaises(AssertionError):
                journey.assert_requester_list()

    def test_saved_draft_is_revealed_only_through_actual_nacrti_tab_then_exact_card(self):
        # The older look of the list: the "Moji" button is selected and "Nacrti" is a tab that becomes selected.
        root, parents=tree('<hierarchy><node content-desc="Moji" selected="true" enabled="true" clickable="true" bounds="[20,200][200,300]"/><node content-desc="Nacrti" selected="false" enabled="true" clickable="true" bounds="[200,400][400,520]"/></hierarchy>')
        final=copy.deepcopy(root);next(n for n in final.iter() if n.attrib.get('content-desc')=='Nacrti').attrib['selected']='true'
        fp={child:p for p in final.iter() for child in p}
        with patch.object(journey,'dump_tree',return_value=(root,parents,None)),patch.object(journey,'assert_requester_list',side_effect=[(root,parents),(final,fp)]),patch.object(journey,'screen_size',return_value=(1080,2400)),patch.object(journey,'tap_node') as tap,patch.object(journey,'wait_visible') as wait:
            card=journey.reveal_saved_draft('Exact saved title')
            tap.assert_called_once_with(next(n for n in root.iter() if n.attrib.get('content-desc')=='Nacrti'),parents,hold_ms=120)
            wait.assert_called_once_with(desc='Otvorite Zadatak Exact saved title',timeout=60)
            self.assertEqual(card,{'desc':'Otvorite Zadatak Exact saved title'})
        final_unselected=copy.deepcopy(root);fu={child:p for p in final_unselected.iter() for child in p}
        with patch.object(journey,'dump_tree',return_value=(root,parents,None)),patch.object(journey,'assert_requester_list',side_effect=[(root,parents),(final_unselected,fu)]),patch.object(journey,'screen_size',return_value=(1080,2400)),patch.object(journey,'tap_node'),patch.object(journey,'wait_visible'):
            with self.assertRaises(AssertionError):
                journey.reveal_saved_draft('Exact saved title')

    def test_saved_draft_is_revealed_through_the_nacrti_row_of_the_current_list_then_exact_card_and_the_row_is_gone(self):
        # Since "Papir na stolu" (2026-10-08): Moji zadaci has its own bar and the quiet row "Nacrti, N nacrt/a" (no tab, no `selected`).
        for desc in ('Nacrti, 2 nacrta','Nacrti, 1 nacrt','Nacrti'):
            with self.subTest(desc=desc):
                root, parents=tree(f'<hierarchy><node text="Moji zadaci"/><node content-desc="Istorija, 3 zadatka" enabled="true" clickable="true" bounds="[20,900][600,1000]"/><node content-desc="{desc}" enabled="true" clickable="true" bounds="[200,400][400,520]"/></hierarchy>')
                opened, op=tree('<hierarchy><node text="Nacrti"/><node content-desc="Otvori zadatak Exact saved title, Objavljen" enabled="true" clickable="true" bounds="[20,300][600,700]"/></hierarchy>')
                with patch.object(journey,'dump_tree',return_value=(root,parents,None)),patch.object(journey,'assert_requester_list') as older,patch.object(journey,'clean_surface',side_effect=[(root,parents),(opened,op)]) as surface,patch.object(journey,'screen_size',return_value=(1080,2400)),patch.object(journey,'tap_node') as tap,patch.object(journey,'wait_visible') as wait:
                    card=journey.reveal_saved_draft('Exact saved title')
                    older.assert_not_called()
                    self.assertEqual([call.args for call in surface.call_args_list],[('Moji zadaci',),('Nacrti',)])
                    tap.assert_called_once_with(next(n for n in root.iter() if n.attrib.get('content-desc')==desc),parents,hold_ms=120)
                    wait.assert_called_once_with(contains='Otvori zadatak Exact saved title',timeout=60)
                    self.assertEqual(card,{'contains':'Otvori zadatak Exact saved title'})
        # A row that is still there after the press means the drafts did not open.
        root, parents=tree('<hierarchy><node text="Moji zadaci"/><node content-desc="Nacrti, 2 nacrta" enabled="true" clickable="true" bounds="[200,400][400,520]"/></hierarchy>')
        with patch.object(journey,'dump_tree',return_value=(root,parents,None)),patch.object(journey,'clean_surface',side_effect=[(root,parents),(root,parents)]),patch.object(journey,'screen_size',return_value=(1080,2400)),patch.object(journey,'tap_node'),patch.object(journey,'wait_visible'):
            with self.assertRaises(AssertionError):
                journey.reveal_saved_draft('Exact saved title')

    def test_the_way_to_the_drafts_is_exactly_one_actionable_control_in_either_look(self):
        for desc in ('Nacrti','Nacrti, 1 nacrt','Nacrti, 2 nacrta','Nacrti, 5 nacrta'):
            root, parents=tree(f'<hierarchy><node content-desc="{desc}" enabled="true" clickable="true" bounds="[200,400][400,520]"/><node content-desc="Istorija" enabled="true" clickable="true" bounds="[200,600][400,720]"/></hierarchy>')
            self.assertEqual(journey.drafts_way(root,parents).attrib['content-desc'],desc)
        for xml in ('<hierarchy/>',
                    '<hierarchy><node content-desc="Nacrti" enabled="true" clickable="true" bounds="[1,1][2,2]"/><node content-desc="Nacrti, 2 nacrta" enabled="true" clickable="true" bounds="[1,3][2,4]"/></hierarchy>',
                    '<hierarchy><node content-desc="Nacrti, 2 nacrta" enabled="false" clickable="true" bounds="[1,1][2,2]"/></hierarchy>',
                    '<hierarchy><node content-desc="Nacrti, 2 nacrta" enabled="true" clickable="false" bounds="[1,1][2,2]"/></hierarchy>',
                    '<hierarchy><node content-desc="Nacrti i istorija" enabled="true" clickable="true" bounds="[1,1][2,2]"/></hierarchy>'):
            root, parents=tree(xml)
            with self.assertRaises(AssertionError):
                journey.drafts_way(root,parents)

    def test_observed_core_profile_selects_current_moj_profil_without_legacy_retry(self):
        root, parents=tree('<hierarchy><node content-desc="Moj profil" enabled="true" clickable="true" bounds="[900,100][1030,230]"/></hierarchy>')
        with patch.object(journey,'dump_tree',return_value=(root,parents,None)),patch.object(journey,'tap') as tap:
            journey.core_profile()
        tap.assert_called_once_with(desc='Moj profil',prefer='top')

    def test_marketplace_native108_report_cannot_fall_back_to106_or_borrow_other_source(self):
        with TemporaryDirectory() as directory,patch.dict(journey.os.environ,{'AI_REVIEW_SCOPE':'marketplace','GITHUB_SHA':'a'*40}),patch.dict(journey.__dict__,{'ARTIFACT_DIR':Path(directory)}):
            Path(directory,'ai-review-admission.json').write_text(json.dumps({'sourceSha':'a'*40,'historyCount':106,'localOnly':True}),encoding='utf-8')
            report=self.native108();path=Path(directory,'native-successors-admission.json');path.write_text(json.dumps(report),encoding='utf-8')
            self.assertEqual(journey.core_native_admission(),report)
            for patch_value in ({'source_sha':'d'*40},{'history_count':106},{'original_history_preserved':False},{'policy_activated':True}):
                path.write_text(json.dumps({**report,**patch_value}),encoding='utf-8')
                with self.assertRaises(AssertionError):
                    journey.core_native_admission()

    def test_marketplace_core_requires_exact_original_publication_receipt_hash_and_same_need(self):
        publication = {'result':'PASS','sourceSha':'a'*40,'localOnly':True,'needId':'need','requesterId':'requester','workerId':'worker',
                       'actualNativePins':True,'actualB06':True,'actualB07':True,'publicationProof':True,'privateLocationHiddenFromWorker':True,
                       'providerProof':False,'productionPolicyActivation':False,'historyCount':108,'nativeBoundary':self.native108()}
        fixture = {'result':'PASS','sourceSha':'a'*40,'localOnly':True,'needId':'need','requesterId':'requester','workerId':'worker',
                   'publicationProof':True,'aiProof':True,'requiredSlots':3,'syntheticFixturePrecondition':False,'productionPolicyActivation':False,'nativeHistoryRequired':108}
        with TemporaryDirectory() as directory, patch.dict(journey.os.environ, {'AI_REVIEW_SCOPE':'marketplace','GITHUB_SHA':'a'*40}), patch.dict(journey.__dict__, {'ARTIFACT_DIR':Path(directory),'NEED_ID':'need','REQUESTER_USER_ID':'requester','WORKER_USER_ID':'worker'}):
            original=json.dumps(publication).encode();fixture['publicationSha256']=hashlib.sha256(original).hexdigest()
            Path(directory,'marketplace-publication.json').write_bytes(original)
            Path(directory,'core-fixture.json').write_text(json.dumps(fixture),encoding='utf-8')
            Path(directory,'ai-review-admission.json').write_text(json.dumps({'sourceSha':'a'*40,'historyCount':106,'localOnly':True}),encoding='utf-8')
            Path(directory,'native-successors-admission.json').write_text(json.dumps(self.native108()),encoding='utf-8')
            self.assertEqual(journey.core_fixture()['requiredSlots'],3)
            for mutation in ({'needId':'other'}, {'actualB07':False}, {'providerProof':True}):
                changed={**publication,**mutation};data=json.dumps(changed).encode()
                Path(directory,'marketplace-publication.json').write_bytes(data)
                with self.assertRaises(AssertionError):
                    journey.core_fixture()
                fixture['publicationSha256']=hashlib.sha256(data).hexdigest()
                Path(directory,'core-fixture.json').write_text(json.dumps(fixture),encoding='utf-8')
                with self.assertRaises(AssertionError):
                    journey.core_fixture()

    def test_neutral_map_touch_uses_observed_frame_and_actual_density(self):
        bounds = (84, 700, 996, 1540)
        x, y = journey.initial_world_touch(bounds, 2.625)
        self.assertTrue(84 < x < 996 and 700 < y < 1540)
        self.assertGreater(x, 540)
        self.assertLess(y, 1120)
        for frame, density in [((84, 700, 996, 800), 2.625), (bounds, 0), (bounds, 8)]:
            with self.assertRaises(AssertionError):
                journey.initial_world_touch(frame, density)

    @staticmethod
    def map_surface(bounds, clip='[0,286][1080,1975]'):
        root,parents=tree(f'<hierarchy><node scrollable="true" bounds="{clip}">'
                          f'<node content-desc="Mapa predložene lokacije" enabled="true" clickable="true" bounds="{bounds}"/>'
                          '</node></hierarchy>')
        return root,parents,next(n for n in root.iter() if n.attrib.get('content-desc'))

    def test_clipped_original_map_requires_full_native_height_and_stable_bounds_before_touch(self):
        source=Path(journey.__file__).parents[1]/'src/ui/location/ResolvedPinMap.tsx'
        self.assertEqual(journey.re.findall(r'frame:\s*\{\s*height:\s*(\d+)',source.read_text(encoding='utf-8')),['320'])
        # Original10177058152 map ends exactly at the form/footer clip. The
        # subsequent frames and density here are synthetic regression inputs.
        clipped=self.map_surface('[97,1288][983,1975]')
        moving=self.map_surface('[97,650][983,1490]')
        stable=self.map_surface('[97,620][983,1460]')
        self.assertTrue(journey.visible_node(clipped[2],clipped[1],1080,2400))
        with patch.object(journey,'seek',side_effect=[clipped,moving,stable,stable]) as seek, \
                patch.object(journey,'screen_size',return_value=(1080,2400)), \
                patch.object(journey,'adb') as adb,patch.object(journey.time,'sleep'):
            result=journey.full_map_surface(2.625)
        self.assertIs(result[2],stable[2]);self.assertEqual(seek.call_count,4)
        self.assertEqual(adb.call_count,1)
        gesture=adb.call_args.args
        self.assertEqual(gesture[:4],('shell','input','touchscreen','swipe'))
        self.assertTrue(0<int(gesture[4])<97);self.assertEqual(gesture[4],gesture[6])
        self.assertGreater(int(gesture[5]),int(gesture[7]))
        x,y=journey.initial_world_touch(journey.parse_bounds(result[2].attrib['bounds']),2.625)
        self.assertTrue(97<x<983 and 620<y<1460)

    def test_top_clipped_map_uses_upward_content_recovery_in_the_outer_gutter(self):
        clipped=self.map_surface('[97,286][983,900]')
        stable=self.map_surface('[97,620][983,1460]')
        with patch.object(journey,'seek',side_effect=[clipped,stable,stable]), \
                patch.object(journey,'screen_size',return_value=(1080,2400)), \
                patch.object(journey,'adb') as adb,patch.object(journey.time,'sleep'):
            journey.full_map_surface(2.625)
        gesture=adb.call_args.args
        self.assertTrue(0<int(gesture[4])<97)
        self.assertLess(int(gesture[5]),int(gesture[7]))

    def test_map_that_never_becomes_complete_fails_before_any_pin_input(self):
        clipped=self.map_surface('[97,1288][983,1975]')
        with patch.object(journey,'seek',return_value=clipped),patch.object(journey,'screen_size',return_value=(1080,2400)), \
                patch.object(journey,'adb') as adb,patch.object(journey.time,'sleep'),self.assertRaises(AssertionError):
            journey.full_map_surface(2.625,attempts=3)
        self.assertEqual(adb.call_count,3)
        self.assertTrue(all(call.args[2:4]==('touchscreen','swipe') for call in adb.call_args_list))

    def test_invalid_map_frame_or_absent_scroll_gutter_is_not_guessed(self):
        incomplete=self.map_surface('[97,650][983,1200]')
        with patch.object(journey,'seek',return_value=incomplete),patch.object(journey,'screen_size',return_value=(1080,2400)), \
                patch.object(journey,'adb') as adb,self.assertRaises(AssertionError):
            journey.full_map_surface(2.625)
        adb.assert_not_called()
        no_gutter=self.map_surface('[0,1288][1080,1975]')
        with patch.object(journey,'adb') as adb,self.assertRaises(AssertionError):
            journey.scroll_once(no_gutter[0],'down')
        adb.assert_not_called()

    def test_manual_point_reads_real_density_but_never_taps_before_full_frame(self):
        with patch.object(journey,'adb',return_value=Mock(stdout='Physical density: 420\n')) as adb, \
                patch.object(journey,'full_map_surface',side_effect=AssertionError('Clipped map')) as full, \
                self.assertRaises(AssertionError):
            journey.physical_manual_point('Polazište')
        adb.assert_called_once_with('shell','wm','density')
        full.assert_called_once_with(2.625)

    @staticmethod
    def pin_status(latitude='45.251234', longitude='19.831234'):
        return f'Predložena tačka na mapi. Geografska širina {latitude}; geografska dužina {longitude}.'

    def selected_map_surface(self, *, label=None, idle=True, duplicate=False):
        root, parents, node = self.map_surface('[97,620][983,1460]')
        scroll = parents[node]
        if label:
            ET.SubElement(scroll, 'node', {'content-desc': label, 'bounds': '[97,1480][983,1550]'})
            if duplicate:
                ET.SubElement(scroll, 'node', {'content-desc': label, 'bounds': '[97,1560][983,1630]'})
        if idle:
            ET.SubElement(scroll, 'node', {'text': 'Mapa je centrirana na izabranu tačku.', 'bounds': '[97,1650][983,1710]'})
        return root, {child: p for p in root.iter() for child in p}, node

    def test_precise_native_coordinate_status_is_strict_and_never_a_button_or_bitmap_claim(self):
        self.assertEqual(journey.native_pin_coordinates(self.pin_status()), {'latitudeE6':45_251_234, 'longitudeE6':19_831_234})
        for label in ('Predložena tačka na mapi', 'Pronađi adresu za ovaj pin',
                      self.pin_status().replace('Predložena', 'Približna'), self.pin_status('45.25'),
                      self.pin_status('NaN'), self.pin_status('45.2512345'), self.pin_status('90.000001'),
                      self.pin_status(longitude='180.000001'),
                      self.pin_status()+' extra'):
            with self.subTest(label=label), self.assertRaises(AssertionError):
                journey.native_pin_coordinates(label)

    def test_rough_global_coordinate_is_navigation_only_and_final_novi_sad_limits_remain_strict(self):
        for latitude,longitude in [('0.000000','0.000000'),('45.200000','19.831234'),('45.251234','19.900000'),('45.277831','19.737721')]:
            point=journey.native_pin_coordinates(self.pin_status(latitude,longitude))
            self.assertFalse(journey.inside_novi_sad(point))
        self.assertTrue(journey.inside_novi_sad(journey.native_pin_coordinates(self.pin_status())))

    def test_original_low_zoom_error_is_corrected_only_by_changed_sdk_points_and_physical_touches(self):
        # First point is actual10179265854; following SDK events are synthetic
        # regression inputs, not claimed physical evidence.
        point={'latitudeE6':45_277_831,'longitudeE6':19_737_721}
        frame=self.map_surface('[97,890][983,1730]')[2]
        next_points=[{**point,'longitudeE6':value} for value in (19_740_600,19_743_500,19_746_400,19_749_300,19_752_200)]
        with patch.object(journey,'observed_native_pin',side_effect=[(p,frame) for p in next_points]) as observe, \
                patch.object(journey,'adb') as adb,patch('builtins.print'):
            selected,_=journey.refine_native_pin(2.625,point,frame)
        self.assertEqual(selected,next_points[-1]);self.assertNotEqual(selected['longitudeE6'],19_755_000)
        self.assertEqual(adb.call_count,5)
        for call in adb.call_args_list:
            self.assertEqual(call.args[:3],('shell','input','tap'))
            self.assertTrue(540<int(call.args[3])<983);self.assertEqual(int(call.args[4]),1310)
        self.assertEqual([c.kwargs['different_from'] for c in observe.call_args_list],[point,*next_points[:-1]])
        # Measured frame and first point need about six full safe taps to the
        # nearest interior longitude19.755, not ~34 taps to distant19.835.
        safe_step=int(adb.call_args_list[0].args[3])-540
        remaining=(19.755-19.737721)/360*(512*(2**15)*2.625)
        self.assertEqual(journey.math.ceil(remaining/safe_step),6)
        self.assertLess(journey.math.ceil(remaining/safe_step),12)

    def test_correction_rejects_wrong_overview_nonprogress_and_unbounded_small_steps(self):
        point={'latitudeE6':45_277_831,'longitudeE6':19_737_721};frame=self.map_surface('[97,890][983,1730]')[2]
        with patch.object(journey,'adb') as adb,self.assertRaisesRegex(AssertionError,'neutral overview'):
            journey.refine_native_pin(2.625,{'latitudeE6':0,'longitudeE6':0},frame)
        adb.assert_not_called()
        wrong={**point,'longitudeE6':19_737_000}
        with patch.object(journey,'adb') as adb,patch.object(journey,'observed_native_pin',return_value=(wrong,frame)),self.assertRaisesRegex(AssertionError,'did not advance'):
            journey.refine_native_pin(2.625,point,frame)
        self.assertEqual(adb.call_count,1)
        tiny=[({**point,'longitudeE6':point['longitudeE6']+i},frame) for i in range(1,13)]
        with patch.object(journey,'adb') as adb,patch.object(journey,'observed_native_pin',side_effect=tiny),patch('builtins.print'),self.assertRaisesRegex(AssertionError,'Bounded physical'):
            journey.refine_native_pin(2.625,point,frame)
        self.assertEqual(adb.call_count,12)

    def test_point_still_outside_region_cannot_reach_confirmation_or_capture(self):
        frame=self.map_surface('[97,620][983,1460]');rough={'latitudeE6':45_277_831,'longitudeE6':19_737_721}
        with patch.object(journey,'adb',return_value=Mock(stdout='Physical density: 420\n')), \
                patch.object(journey,'full_map_surface',return_value=frame), \
                patch.object(journey,'observed_native_pin',return_value=(rough,frame[2])), \
                patch.object(journey,'refine_native_pin',return_value=(rough,frame[2])), \
                patch.object(journey,'capture') as capture,patch.object(journey,'tap_node') as confirm, \
                self.assertRaisesRegex(AssertionError,'final point must be in Novi Sad'):
            journey.physical_manual_point('Polazište')
        capture.assert_not_called();confirm.assert_not_called()

    def test_selected_pin_requires_native_idle_and_two_equal_observations_without_bitmap_descendant(self):
        pending = self.selected_map_surface(label=self.pin_status(), idle=False)
        ready = self.selected_map_surface(label=self.pin_status())
        self.assertFalse(any(n.attrib.get('content-desc')=='Predložena tačka na mapi' for n in ready[0].iter()))
        with patch.object(journey,'full_map_surface',side_effect=[pending,ready,ready]) as full, \
                patch.object(journey,'screen_size',return_value=(1080,2400)):
            point, node = journey.observed_native_pin(2.625)
        self.assertEqual(full.call_count,3)
        self.assertEqual(point, {'latitudeE6':45_251_234,'longitudeE6':19_831_234})
        self.assertIs(node, ready[2])

    def marker_surface(self, bounds='[482,914][598,1040]', *, duplicate=False, label=None):
        root, _, map_node = self.selected_map_surface(label=label or self.pin_status('45.277831','19.752165'))
        if bounds:
            ET.SubElement(map_node, 'node', {'content-desc':'Oznaka izabrane tačke na mapi','bounds':bounds})
            if duplicate:ET.SubElement(map_node, 'node', {'content-desc':'Oznaka izabrane tačke na mapi','bounds':bounds})
        return root, {child:p for p in root.iter() for child in p}, map_node

    def test_actual_marker_drag_uses_stable_native_hit_bounds_and_changed_sdk_readback(self):
        surface=self.marker_surface();before={'latitudeE6':45277831,'longitudeE6':19752165};after={**before,'longitudeE6':19752640}
        with patch.object(journey,'full_map_surface',return_value=surface) as full, \
                patch.object(journey,'screen_size',return_value=(1080,2400)),patch.object(journey,'adb') as adb, \
                patch.object(journey,'observed_native_pin',return_value=(after,surface[2])) as observe,patch.object(journey,'capture') as capture:
            self.assertEqual(journey.drag_native_marker(2.625,before)[0],after)
        self.assertEqual(full.call_count,2)
        adb.assert_called_once_with('shell','input','touchscreen','swipe','540','977','598','977','600')
        observe.assert_called_once_with(2.625,different_from=before)
        capture.assert_called_once_with('MARKETPLACE_pin_start_dragged','Mesto Zadatka')

    def test_marker_missing_clipped_wrong_size_or_ambiguous_stops_before_any_physical_drag(self):
        before={'latitudeE6':45277831,'longitudeE6':19752165}
        for surface in [self.marker_surface(None),self.marker_surface('[482,570][598,696]'),
                        self.marker_surface('[482,914][590,1040]'),self.marker_surface(duplicate=True),
                        self.marker_surface(label=self.pin_status('45.277831','19.752166'))]:
            with patch.object(journey,'full_map_surface',return_value=surface), \
                    patch.object(journey,'screen_size',return_value=(1080,2400)),patch.object(journey,'adb') as adb, \
                    patch.object(journey,'capture') as capture,self.assertRaises(AssertionError):
                journey.drag_native_marker(2.625,before)
            adb.assert_not_called();capture.assert_not_called()

    def test_marker_drag_without_changed_native_result_or_outside_strict_region_cannot_claim_success(self):
        surface=self.marker_surface();before={'latitudeE6':45277831,'longitudeE6':19752165}
        for result in [AssertionError('No changed native coordinate'),({'latitudeE6':45277831,'longitudeE6':19749999},surface[2])]:
            with patch.object(journey,'full_map_surface',return_value=surface), \
                    patch.object(journey,'screen_size',return_value=(1080,2400)),patch.object(journey,'adb'), \
                    patch.object(journey,'observed_native_pin',side_effect=[result]),patch.object(journey,'capture') as capture, \
                    self.assertRaises(AssertionError):
                journey.drag_native_marker(2.625,before)
            capture.assert_not_called()

    def test_end_camera_cannot_accept_previous_pin_and_duplicate_or_missing_status_fails_closed(self):
        old = self.selected_map_surface(label=self.pin_status())
        new = self.selected_map_surface(label=self.pin_status('45.251100'))
        point = journey.native_pin_coordinates(self.pin_status())
        with patch.object(journey,'full_map_surface',side_effect=[old,new,new]) as full, \
                patch.object(journey,'screen_size',return_value=(1080,2400)):
            result, _ = journey.observed_native_pin(2.625,different_from=point)
        self.assertEqual(full.call_count,3);self.assertEqual(result['latitudeE6'],45_251_100)
        for surface in (old, self.selected_map_surface(), self.selected_map_surface(label=self.pin_status(),idle=False),
                        self.selected_map_surface(label=self.pin_status(),duplicate=True)):
            with patch.object(journey,'full_map_surface',return_value=surface), \
                    patch.object(journey,'screen_size',return_value=(1080,2400)), self.assertRaises(AssertionError):
                journey.observed_native_pin(2.625,different_from=point,attempts=3)

    def test_pin_ack_failure_stops_before_confirmation_and_end_wait_uses_actual_previous_coordinates(self):
        surface = self.map_surface('[97,620][983,1460]')
        first = journey.native_pin_coordinates(self.pin_status())
        with patch.object(journey,'adb',return_value=Mock(stdout='Physical density: 420\n')) as adb, \
                patch.object(journey,'full_map_surface',return_value=surface), \
                patch.object(journey,'observed_native_pin',side_effect=[(first,surface[2]),AssertionError('No new native coordinate')]) as observe, \
                patch.object(journey,'seek') as seek, patch.object(journey,'tap_node') as confirm, \
                self.assertRaises(AssertionError):
            journey.physical_manual_point('Odredište',offset=True)
        self.assertEqual(observe.call_args_list,[unittest.mock.call(2.625),unittest.mock.call(2.625,different_from=first)])
        self.assertEqual(adb.call_args_list[-1],unittest.mock.call('shell','input','tap','600','1090'))
        seek.assert_not_called();confirm.assert_not_called()

    def test_saved_points_must_equal_actual_native_e6_for_each_confirmed_manual_slot(self):
        start = journey.native_pin_coordinates(self.pin_status())
        end = journey.native_pin_coordinates(self.pin_status('45.251100','19.831300'))
        state = {'facts':[{'fact_key':'need.resolved_location','superseded_at':None,'status':'CONFIRMED',
                          'source':'EXPLICIT_USER_ANSWER','fact_value':{'points':[
                              {'slot':'start',**start,'origin':{'kind':'MANUAL_PIN'}},
                              {'slot':'end',**end,'origin':{'kind':'MANUAL_PIN'}}]}}]}
        journey.assert_saved_native_points(state,start,end)
        altered = copy.deepcopy(state);altered['facts'][0]['fact_value']['points'][1]['latitudeE6'] += 1
        swapped = copy.deepcopy(state);swapped['facts'][0]['fact_value']['points'].reverse()
        pending = copy.deepcopy(state);pending['facts'][0]['status'] = 'PROPOSED'
        provider = copy.deepcopy(state);provider['facts'][0]['fact_value']['points'][0]['origin'] = {'kind':'PROVIDER_CANDIDATE'}
        for invalid in (altered,swapped,pending,provider,{'facts':[]}):
            with self.subTest(invalid=invalid), self.assertRaises(AssertionError):
                journey.assert_saved_native_points(invalid,start,end)

    def test_destination_selector_binds_android_confirmed_value_and_scrolls_observed_clipping(self):
        label='Tačka koju uređujete, Polazište · potvrđeno'
        def surface(bounds, description=label, enabled='true'):
            return tree(f'<hierarchy><node text="Mesto Zadatka"/><node scrollable="true" bounds="[0,286][1080,1975]">'
                        f'<node content-desc="{description}" clickable="true" enabled="{enabled}" bounds="{bounds}"/>'
                        '<node text="Odredište na mapi" enabled="true" bounds="[97,1100][983,1170]"/></node></hierarchy>')
        for clipped_bounds, direction in [('[47,286][1033,126]','up'),('[47,2020][1033,1975]','down')]:
            clipped=surface(clipped_bounds);visible=surface('[47,850][1033,990]')
            with patch.object(journey,'clean_surface',side_effect=[clipped,visible,visible]), \
                    patch.object(journey,'screen_size',return_value=(1080,2400)), \
                    patch.object(journey,'scroll_once') as scroll,patch.object(journey,'tap_node') as select, \
                    patch.object(journey,'tap') as option:
                journey.select_native_destination()
            scroll.assert_called_once_with(clipped[0],direction)
            self.assertEqual(select.call_args.args[0].attrib['content-desc'],label)
            option.assert_called_once_with(desc='Odredište')
        for wrong in ['Tačka koju uređujete, Polazište','Tačka koju uređujete, Odredište · potvrđeno']:
            with patch.object(journey,'clean_surface',return_value=surface('[47,850][1033,990]',wrong)), \
                    patch.object(journey,'screen_size',return_value=(1080,2400)),patch.object(journey,'scroll_once'), \
                    patch.object(journey,'tap_node') as select,patch.object(journey,'tap') as option, \
                    self.assertRaises(AssertionError):
                journey.select_native_destination()
            select.assert_not_called();option.assert_not_called()

    def test_destination_must_be_observed_before_any_end_pin_gesture(self):
        with patch.object(journey,'press_in_review'),patch.object(journey,'wait_visible'), \
                patch.object(journey,'physical_manual_point',return_value={'latitudeE6':45277831,'longitudeE6':19752165}) as point, \
                patch.object(journey,'select_native_destination',side_effect=AssertionError('Destination heading absent')), \
                self.assertRaisesRegex(AssertionError,'Destination heading absent'):
            journey.physical_location_review()
        point.assert_called_once_with('Polazište')

    def test_physical_confirmation_requires_same_coordinates_in_the_retained_capture(self):
        empty = self.map_surface('[97,620][983,1460]')
        selected = self.selected_map_surface(label=self.pin_status())
        other = self.selected_map_surface(label=self.pin_status('45.251100'))
        point = journey.native_pin_coordinates(self.pin_status())
        for original, success in ((selected,True),(other,False)):
            with patch.object(journey,'adb',return_value=Mock(stdout='Physical density: 420\n')), \
                    patch.object(journey,'full_map_surface',return_value=empty), \
                    patch.object(journey,'observed_native_pin',return_value=(point,selected[2])), \
                    patch.object(journey,'drag_native_marker',return_value=(point,selected[2])) as drag, \
                    patch.object(journey,'capture',return_value=original[:2]), \
                    patch.object(journey,'screen_size',return_value=(1080,2400)), \
                    patch.object(journey,'seek',return_value=selected),patch.object(journey,'tap_node') as confirm:
                if success:
                    self.assertEqual(journey.physical_manual_point('Polazište'),point)
                    confirm.assert_called_once()
                    drag.assert_called_once_with(2.625,point)
                else:
                    with self.assertRaisesRegex(AssertionError,'Captured native coordinates'):
                        journey.physical_manual_point('Polazište')
                    confirm.assert_not_called()

    def test_current_selected_application_uses_exact_title_specific_agreement_action(self):
        with patch.dict(journey.__dict__,{'NEED_TITLE':'Owned AI Need'}),patch.object(journey,'tap') as tap, \
                patch.object(journey,'wait_visible') as wait,patch.object(journey,'shot'):
            journey.core_open_selected_agreement()
        self.assertEqual(tap.call_args_list,[unittest.mock.call(desc='Prijave',prefer='bottom'),
                         unittest.mock.call(desc='Otvori Dogovor: Owned AI Need'),unittest.mock.call(desc='Nazad')])
        self.assertEqual(wait.call_args_list,[unittest.mock.call(text='Owned AI Need'),unittest.mock.call(text='Izabrana'),
                                            unittest.mock.call(text='Owned AI Need')])

    def test_completed_agreement_return_uses_actual_history_tab_only_for_current_collection(self):
        source = Path(__file__).with_name('d03_chat_android_journey.py')
        definitions = [n for n in ast.parse(source.read_text(encoding='utf-8')).body
                       if isinstance(n,ast.FunctionDef) and n.name=='return_to_completed_agreement_list']
        self.assertEqual(len(definitions),1)
        for current in (True,False):
            flow = Mock(spec=['tap','assert_shell','wait_visible','shot'])
            scope = {name:getattr(flow,name) for name in ('tap','assert_shell','wait_visible','shot')}
            scope.update(CORE106=current,NEED_TITLE='Owned AI Need')
            exec(compile(ast.Module(body=definitions,type_ignores=[]),str(source),'exec'),scope)
            scope['return_to_completed_agreement_list']()
            expected = [unittest.mock.call.tap(desc='Nazad'),unittest.mock.call.assert_shell('requester')]
            if current:expected.append(unittest.mock.call.tap(desc='Istorija'))
            expected.extend([unittest.mock.call.wait_visible(desc='Otvorite Dogovor Owned AI Need'),
                             unittest.mock.call.shot('D03_terminal_back')])
            self.assertEqual(flow.mock_calls,expected)

    def test_original_and_marketplace_submit_require_their_exact_headcount(self):
        for mode, slots in [('intake', 1), ('marketplace', 3)]:
            with patch.dict(journey.os.environ, {'AI_REVIEW_SCOPE': mode}), patch.object(journey, 'core_fixture', return_value={'requiredSlots': 3}), patch.dict(journey.__dict__, {'NEED_ID':'need', 'WORKER_USER_ID':'worker'}):
                with patch.object(journey, 'psql', return_value=f'response|SUBMITTED|3000|{slots}'):
                    self.assertEqual(journey.assert_worker_submit(), 'response')
                with patch.object(journey, 'psql', return_value=f'response|SUBMITTED|3000|{4-slots}'), self.assertRaises(AssertionError):
                    journey.assert_worker_submit()

    def test_detail_back_requires_owned_saved_review_before_conversation_back(self):
        root, parents = tree('<hierarchy><node text="Proverite Zadatak"/><node text="Zadatak je već sačuvan"/><node text="Owned title"/><node content-desc="Nazad u razgovor" enabled="true" clickable="true" bounds="[20,90][160,210]"/></hierarchy>')
        with patch.object(journey, 'tap') as tap, patch.object(journey, 'clean_surface', return_value=(root, parents)), patch.object(journey, 'screen_size', return_value=(1080, 2400)), patch.object(journey, 'tap_node') as action, patch.object(journey, 'wait_visible') as wait:
            journey.return_to_saved_conversation('Owned title')
        tap.assert_called_once_with(desc='Nazad', prefer='top')
        action.assert_called_once_with(next(n for n in root.iter() if n.attrib.get('content-desc')), parents, hold_ms=120)
        wait.assert_called_once_with(desc='Poruka za AI')

    def test_saved_review_back_rejects_wrong_need_or_mutable_review_before_second_navigation(self):
        for content in ('<node text="Other title"/>', '<node text="Owned title"/><node content-desc="Sačuvajte nacrt" enabled="false"/>'):
            root, parents = tree('<hierarchy><node text="Zadatak je već sačuvan"/>' + content + '<node content-desc="Nazad u razgovor" enabled="true" clickable="true" bounds="[20,90][160,210]"/></hierarchy>')
            with patch.object(journey, 'tap'), patch.object(journey, 'clean_surface', return_value=(root, parents)), patch.object(journey, 'tap_node') as action, self.assertRaises(AssertionError):
                journey.return_to_saved_conversation('Owned title')
            action.assert_not_called()

    def test_disabled_save_is_checked_on_actual_control_not_an_ancestor(self):
        root, parents = tree('<hierarchy><node clickable="true" enabled="true"><node content-desc="Sačuvajte nacrt" enabled="false" clickable="false" bounds="[10,20][80,70]"/></node></hierarchy>')
        journey.assert_button(root, parents, 'Sačuvajte nacrt', False)
        with self.assertRaises(AssertionError):
            journey.assert_button(root, parents, 'Sačuvajte nacrt', True)

    def test_duplicate_or_absent_save_is_not_a_disabled_success(self):
        for content in ('', '<node content-desc="Sačuvajte nacrt" enabled="false"/><node content-desc="Sačuvajte nacrt" enabled="false"/>'):
            root, parents = tree(f'<hierarchy>{content}</hierarchy>')
            with self.assertRaises(AssertionError):
                journey.assert_button(root, parents, 'Sačuvajte nacrt', False)

    def test_card_text_must_fit_screen_and_actual_scroll_clip(self):
        root, parents = tree('<hierarchy><node scrollable="true" bounds="[0,100][1080,2200]"><node text="full" bounds="[50,120][1000,180]"/><node text="clipped" bounds="[50,2180][1000,2250]"/><node text="overflow" bounds="[50,130][1120,180]"/></node></hierarchy>')
        nodes = [n for n in root.iter() if n.attrib.get('text')]
        self.assertTrue(journey.visible_node(nodes[0], parents, 1080, 2400))
        self.assertFalse(journey.visible_node(nodes[1], parents, 1080, 2400))
        self.assertFalse(journey.visible_node(nodes[2], parents, 1080, 2400))
        self.assertFalse(journey.visible_node(root, parents, 1080, 2400))

    def test_schedule_checks_both_dates_times_and_timezone(self):
        start, end = '2026-09-14T07:00:00Z', '2026-09-14T09:00:00Z'
        journey.assert_schedule_label('14. 9. 2026. 09:00:00 CEST – 14. 9. 2026. 11:00:00 GMT+2', start, end)
        for text in ('14. 9. 2026. 09:00 CEST', '14. 9. 2026. 09:00 – 14. 9. 2026. 11:00',
                     '14. 9. 2026. 07:00 GMT+2 – 14. 9. 2026. 09:00 GMT+2',
                     '14. 9. 2026. 09:00 GMT+2 – 15. 9. 2026. 11:00 GMT+2',
                     '14. 9. 2026. 09:00 GMT+20 – 14. 9. 2026. 11:00 GMT+20'):
            with self.subTest(text=text), self.assertRaises(AssertionError):
                journey.assert_schedule_label(text, start, end)

    def test_schedule_dst_uses_actual_endpoint_offsets(self):
        journey.assert_schedule_label('25. 10. 2026. 02:30 CEST – 25. 10. 2026. 03:30 CET',
                                      '2026-10-25T00:30:00Z', '2026-10-25T02:30:00Z')

    def test_seek_waits_on_disabled_control_without_scrolling_or_tapping(self):
        disabled, dp = tree('<hierarchy><node content-desc="Potvrdite: Vozilo" enabled="false" bounds="[10,20][200,80]"/></hierarchy>')
        active, ap = tree('<hierarchy><node content-desc="Potvrdite: Vozilo" enabled="true" bounds="[10,20][200,80]"/></hierarchy>')
        with patch.object(journey, 'clean_surface', side_effect=[(disabled, dp), (active, ap)]), patch.object(journey, 'screen_size', return_value=(1080, 2400)), patch.object(journey, 'scroll_once') as scroll, patch.object(journey.time, 'sleep'):
            root, _, node = journey.seek('Proverite Zadatak', desc='Potvrdite: Vozilo', enabled=True)
        self.assertIs(root, active)
        self.assertEqual(node.attrib['enabled'], 'true')
        scroll.assert_not_called()

    def test_scrolling_conversation_anchors_real_fixed_input(self):
        self.assertEqual(journey.anchor_criteria('Novi zadatak'), {'desc': 'Poruka za AI'})
        self.assertEqual(journey.anchor_criteria('Proverite Zadatak'), {'text': 'Proverite Zadatak'})

    def test_retained_review_position_scrolls_up_from_original_failure_geometry_before_tap(self):
        # Synthetic regression of the retained PR59 clipped geometry, not pixels.
        clipped, cp = tree('<hierarchy><node scrollable="true" bounds="[0,307][1080,2101]"><node content-desc="Izmenite: Ljudi" enabled="true" clickable="true" bounds="[353,307][655,269]"/></node></hierarchy>')
        original = next(n for n in clipped.iter() if n.attrib.get('content-desc') == 'Izmenite: Ljudi')
        self.assertEqual(original.attrib['bounds'], '[353,307][655,269]')
        self.assertFalse(journey.visible_node(original, cp, 1080, 2400))
        visible = copy.deepcopy(clipped)
        target = next(n for n in visible.iter() if n.attrib.get('content-desc') == 'Izmenite: Ljudi')
        target.attrib['bounds'] = '[353,500][655,616]'
        vp = {child: parent for parent in visible.iter() for child in parent}
        with patch.object(journey, 'clean_surface', side_effect=[(clipped, cp), (visible, vp)]), patch.object(journey, 'screen_size', return_value=(1080, 2400)), patch.object(journey, 'scroll_once') as scroll, patch.object(journey, 'tap_node') as tap:
            journey.press_in_review('Izmenite: Ljudi')
        scroll.assert_called_once_with(clipped, 'up')
        tap.assert_called_once_with(target, vp, hold_ms=120)

    def test_observed_below_clip_overrides_up_hint_without_accepting_inverted_bounds(self):
        clipped, cp = tree('<hierarchy><node scrollable="true" bounds="[0,307][1080,2101]"><node content-desc="Potvrdite: Vozilo" enabled="true" bounds="[676,2200][993,2101]"/></node></hierarchy>')
        visible, vp = tree('<hierarchy><node scrollable="true" bounds="[0,307][1080,2101]"><node content-desc="Potvrdite: Vozilo" enabled="true" bounds="[676,700][993,816]"/></node></hierarchy>')
        with patch.object(journey, 'clean_surface', side_effect=[(clipped, cp), (visible, vp)]), patch.object(journey, 'screen_size', return_value=(1080, 2400)), patch.object(journey, 'scroll_once') as scroll:
            result, _, _ = journey.seek('Proverite Zadatak', desc='Potvrdite: Vozilo', direction='up', enabled=True)
        self.assertIs(result, visible)
        scroll.assert_called_once_with(clipped, 'down')


class FactBindingAssertions(unittest.TestCase):
    @staticmethod
    def surface(*, opened=None, top=400, action='Potvrdite', editing=False):
        # React Native's actual XML flattens headers/evidence/actions into
        # siblings. These synthetic bounds exercise that observed structure.
        rows = []
        for index, label in enumerate(('Naslov', 'Opis', 'Ljudi')):
            y = top + index * 300
            enabled = 'false' if editing and opened == label else 'true'
            rows.append(f'<node content-desc="Pregledajte: {label}" enabled="{enabled}" clickable="true" bounds="[50,{y}][1030,{y + 160}]">'
                        f'<node text="{label}" bounds="[97,{y + 20}][904,{y + 65}]"/>'
                        f'<node text="Typed value" bounds="[97,{y + 70}][904,{y + 110}]"/></node>')
            if opened == label:
                rows.append(f'<node text="Evidence" bounds="[97,{y + 170}][983,{y + 190}]"/>'
                            f'<node content-desc="{action}" enabled="true" clickable="true" bounds="[97,{y + 200}][983,{y + 270}]"/>')
        return tree('<hierarchy><node scrollable="true" bounds="[0,286][1080,1712]">' + ''.join(rows) + '</node></hierarchy>')

    def setUp(self):
        self.size = patch.object(journey, 'screen_size', return_value=(1080, 1920))
        self.size.start()
        self.addCleanup(self.size.stop)

    def test_original_positive_clipped_title_parent_is_not_a_complete_row(self):
        # Original 34529321357: the header's 28px sliver passed visible_node,
        # while all three title text bounds were inverted above the viewport.
        clipped, cp = tree('<hierarchy><node scrollable="true" bounds="[0,286][1080,1712]">'
                           '<node content-desc="Pregledajte: Naslov" enabled="true" clickable="true" bounds="[50,286][1030,314]">'
                           '<node text="Naslov" bounds="[97,286][904,137]"/>'
                           '<node text="AI review proof" bounds="[97,286][904,210]"/>'
                           '<node text="Čeka potvrdu" bounds="[97,286][904,266]"/></node></node></hierarchy>')
        header = next(n for n in clipped.iter() if n.attrib.get('content-desc'))
        self.assertTrue(journey.visible_node(header, cp, 1080, 1920))
        self.assertFalse(journey.complete_fact_row(header, cp, 1080, 1920))
        first, final = self.surface(), self.surface()
        with patch.object(journey, 'clean_surface', side_effect=[(clipped, cp), first, final]), patch.object(journey, 'scroll_once') as scroll:
            _, _, target = journey.stable_fact_target('Naslov')
        scroll.assert_called_once_with(clipped, 'up')
        self.assertIn(target, list(final[0].iter()))

    def test_generic_fact_write_helper_is_rejected_before_any_ui_input(self):
        for action in ('Potvrdite', 'Izmenite', 'Sačuvaj ispravku'):
            with self.subTest(action=action), patch.object(journey, 'tap_node') as tap, patch.object(journey, 'clean_surface') as observe:
                with self.assertRaisesRegex(AssertionError, 'explicit observed row binding'):
                    journey.press_in_review(action)
                tap.assert_not_called()
                observe.assert_not_called()

    def test_wrong_flattened_row_confirmation_fails_before_mutation(self):
        wrong = self.surface(opened='Opis')
        with patch.object(journey, 'clean_surface', return_value=wrong), patch.object(journey, 'tap_node') as tap:
            with self.assertRaisesRegex(AssertionError, 'expected Pregledajte: Naslov, observed Pregledajte: Opis'):
                journey.press_fact_action('Naslov', 'Potvrdite')
        tap.assert_not_called()

    def test_moving_action_uses_last_of_two_matching_fresh_observations(self):
        moving, settled, final = self.surface(opened='Naslov', top=300), self.surface(opened='Naslov'), self.surface(opened='Naslov')
        with patch.object(journey, 'clean_surface', side_effect=[moving, settled, final]) as observe, patch.object(journey, 'tap_node') as tap:
            journey.press_fact_action('Naslov', 'Potvrdite')
        self.assertEqual(observe.call_count, 3)
        target = next(n for n in final[0].iter() if n.attrib.get('content-desc') == 'Potvrdite')
        tap.assert_called_once_with(target, final[1], hold_ms=120)

    def test_owner_change_between_fresh_observations_cannot_confirm_old_target(self):
        with patch.object(journey, 'clean_surface', side_effect=[self.surface(opened='Naslov'), self.surface(opened='Opis')]), patch.object(journey, 'tap_node') as tap:
            with self.assertRaisesRegex(AssertionError, 'Wrong expanded fact'):
                journey.press_fact_action('Naslov', 'Potvrdite')
        tap.assert_not_called()

    def test_wrong_expansion_recovers_only_through_intended_header_taps(self):
        observations = [self.surface(), self.surface(), self.surface(opened='Opis'),
                        self.surface(opened='Opis'), self.surface(opened='Opis'), self.surface(opened='Naslov')]
        with patch.object(journey, 'clean_surface', side_effect=observations), patch.object(journey, 'tap_node') as tap:
            journey.open_fact('Naslov', direction='up')
        self.assertEqual(tap.call_count, 2)
        self.assertEqual([call.args[0].attrib['content-desc'] for call in tap.call_args_list],
                         ['Pregledajte: Naslov', 'Pregledajte: Naslov'])

    def test_persistent_wrong_expansion_is_bounded_and_never_confirms(self):
        with patch.object(journey, 'clean_surface', return_value=self.surface(opened='Opis')), patch.object(journey, 'tap_node') as tap:
            with self.assertRaisesRegex(AssertionError, 'Intended fact did not expand'):
                journey.open_fact('Naslov')
        self.assertEqual(tap.call_count, 3)
        self.assertTrue(all(call.args[0].attrib['content-desc'] == 'Pregledajte: Naslov' for call in tap.call_args_list))

    def test_never_stable_geometry_is_bounded_and_does_not_tap(self):
        observations = [self.surface(opened='Naslov', top=300 + index) for index in range(8)]
        with patch.object(journey, 'clean_surface', side_effect=observations) as observe, patch.object(journey, 'tap_node') as tap:
            with self.assertRaisesRegex(AssertionError, 'never became stable'):
                journey.press_fact_action('Naslov', 'Potvrdite')
        self.assertEqual(observe.call_count, 8)
        tap.assert_not_called()

    def test_correction_save_binds_disabled_people_header_to_enabled_save(self):
        first, final = self.surface(opened='Ljudi', action='Sačuvaj ispravku', editing=True), self.surface(opened='Ljudi', action='Sačuvaj ispravku', editing=True)
        with patch.object(journey, 'clean_surface', side_effect=[first, final]), patch.object(journey, 'tap_node') as tap:
            journey.press_fact_action('Ljudi', 'Sačuvaj ispravku')
        self.assertEqual(tap.call_args.args[0].attrib['content-desc'], 'Sačuvaj ispravku')
        self.assertEqual(tap.call_args.args[1], final[1])

    def test_scrolled_correction_save_keeps_exact_owner_without_oscillating_to_header(self):
        observations = []
        for _ in range(2):
            root, parent = self.surface(opened='Ljudi', action='Sačuvaj ispravku', editing=True)
            header = next(n for n in root.iter() if n.attrib.get('content-desc') == 'Pregledajte: Ljudi')
            header.attrib['bounds'] = '[50,286][1030,314]'
            for child in header:
                child.attrib['bounds'] = '[97,286][904,210]'
            observations.append((root, parent))
        with patch.object(journey, 'clean_surface', side_effect=observations), patch.object(journey, 'scroll_once') as scroll, patch.object(journey, 'tap_node') as tap:
            journey.press_fact_action('Ljudi', 'Sačuvaj ispravku')
        scroll.assert_not_called()
        self.assertEqual(tap.call_args.args[0].attrib['content-desc'], 'Sačuvaj ispravku')
        self.assertEqual(tap.call_args.args[1], observations[-1][1])

    def test_action_cannot_borrow_header_from_another_scroll_container(self):
        root, parent = tree('<hierarchy><node scrollable="true" bounds="[0,0][1080,1920]">'
                            '<node content-desc="Pregledajte: Naslov"/><node scrollable="true" bounds="[0,200][1080,1000]">'
                            '<node content-desc="Potvrdite"/></node></node></hierarchy>')
        action = next(n for n in root.iter() if n.attrib.get('content-desc') == 'Potvrdite')
        with self.assertRaisesRegex(AssertionError, 'no observed preceding row'):
            journey.fact_action_owner(root, parent, action)


class PersistedAssertions(unittest.TestCase):
    def setUp(self):
        self.fixture = {'accountId': 'owner', 'profileId': 'profile', 'conversationId': 'conversation', 'proposals': [
            {'key': 'need.title', 'value': 'generic'}, {'key': 'need.description', 'value': 'synthetic'},
            {'key': 'need.category', 'value': 'pomoc'}, {'key': 'need.task_geography', 'value': {'mode': 'POINT_TO_POINT', 'start': {'city':'Novi Sad','area':'Centar'}, 'end': {'city':'Novi Sad','area':'Liman'}}},
            {'key': 'need.starts_at', 'value': '2026-09-14T07:00:00Z'}, {'key': 'need.ends_at', 'value': '2026-09-14T09:00:00Z'}]}
        current = {'id': 'new', 'fact_key': 'need.people_needed', 'fact_value': 3, 'source': 'EXPLICIT_USER_ANSWER',
                   'status': 'CONFIRMED', 'confirmed_by_user_id': 'owner', 'confirmed_at': 'time', 'superseded_at': None}
        old = {**current, 'id': 'old', 'fact_value': 2, 'source': 'AI_INFERENCE', 'status': 'NEEDS_CONFIRMATION',
               'superseded_at': 'time', 'superseded_by': 'new'}
        facts = [old, current, *[{**current, 'id': f'f{i}', 'fact_key': f'need.key{i}'} for i in range(10)]]
        self.state = {'accountId': 'owner', 'conversationId': 'conversation', 'facts': facts,
            'review': {'boundNeedId': 'need'}, 'receipts': [{'need_id': 'need', 'conversation_id': 'conversation'}],
            'needs': [{'id': 'need', 'requester_account_id': 'owner', 'requester_profile_id': 'profile', 'status': 'DRAFT',
                       'task_country_code': 'RS', 'mode': 'OFFERS', 'requester_price_rsd': None, 'title': 'generic', 'description': 'synthetic', 'category': 'pomoc',
                       'required_slots': 3, 'schedule_kind': 'FIXED_WINDOW', 'required_vehicles': ['Kombi'],
                       'public_topology': {'mode': 'POINT_TO_POINT', 'start': {'city':'Novi Sad','area':'Centar'}, 'end': {'city':'Novi Sad','area':'Liman'}}, 'starts_at': '2026-09-14T09:00:00+02:00', 'ends_at': '2026-09-14T11:00:00+02:00'}]}

    def test_one_owned_draft_matches_typed_input_and_real_confirmation(self):
        self.assertEqual(journey.assert_saved(self.state, self.fixture)['id'], 'need')

    def test_rejects_duplicate_save_wrong_owner_lost_vehicle_unconfirmed_fact_or_price(self):
        mutations = [lambda x: x['needs'].append(copy.deepcopy(x['needs'][0])),
                     lambda x: x['receipts'].append(copy.deepcopy(x['receipts'][0])),
                     lambda x: x['needs'][0].update(requester_account_id='another-owner'),
                     lambda x: x['needs'][0].update(required_vehicles=[]),
                     lambda x: x['needs'][0].update(requester_price_rsd=3000),
                     lambda x: x['facts'][2].update(status='NEEDS_CONFIRMATION'),
                     lambda x: x['facts'][1].update(fact_value='3'),
                     lambda x: x['facts'][0].update(superseded_by='unrelated')]
        for change in mutations:
            with self.subTest(change=mutations.index(change)):
                state = copy.deepcopy(self.state); change(state)
                with self.assertRaises(AssertionError):
                    journey.assert_saved(state, self.fixture)



"""Local-target and restoration regressions, not substitutes for physical proof."""
import unittest
from unittest.mock import Mock
from scripts.ai_review_local_rest import LocalRestOutage, validate_container, validate_local_targets

ENV = {'RU5_DEVICE_SUPABASE_URL': 'http://127.0.0.1:54321',
       'RU5_DEVICE_DB_URL': 'postgresql://postgres:local-test@127.0.0.1:54322/postgres',
       'RU5_DEVICE_PACKAGE': 'rs.uskoci.n04proof', 'RU5_DEVICE_PROOF_DIR': '/tmp/uskoci-ru5-device-ui'}
IDENTITY = ['a' * 64, '/supabase_rest_uskoci-ru5-device-ui', 'public.ecr.aws/supabase/postgrest:v14.4', True]


class LocalRestSafety(unittest.TestCase):
    def test_accepts_exact_proof_targets(self):
        validate_local_targets(ENV)
        self.assertEqual(validate_container(IDENTITY, expected_running=True), 'a' * 64)

    def test_accepts_observed_cli_ghcr_postgrest_without_broadening_container_scope(self):
        # Original run34131247295 pulled this exact image; the old guard rejected it before stop.
        observed = [*IDENTITY[:2], 'ghcr.io/supabase/postgrest:v16.1', True]
        self.assertEqual(validate_container(observed, expected_running=True), 'a' * 64)
        self.assertEqual(validate_container([*observed[:3], False], expected_running=False,
                                           expected_id='a' * 64), 'a' * 64)

    def test_rejects_ghcr_registry_namespace_image_and_tag_spoofs(self):
        for image in ('ghcr.io.attacker.invalid/supabase/postgrest:v16.1',
                      'ghcr.io/other/postgrest:v16.1', 'ghcr.io/supabase/postgres:v16.1',
                      'ghcr.io/supabase/postgrest:v16.1/other', 'ghcr.io/supabase/postgrest'):
            with self.subTest(image=image), self.assertRaises(RuntimeError):
                validate_container([*IDENTITY[:2], image, True], expected_running=True)

    def test_rejects_remote_or_redirected_targets_without_exposing_credentials(self):
        cases = [
            {'RU5_DEVICE_SUPABASE_URL': 'https://leqcwgzvjsxugfgzdmth.supabase.co'},
            {'RU5_DEVICE_SUPABASE_URL': 'http://127.0.0.1.attacker.invalid:54321'},
            {'RU5_DEVICE_SUPABASE_URL': 'http://user:secret@127.0.0.1:54321'},
            {'RU5_DEVICE_DB_URL': 'postgresql://postgres:secret@127.0.0.1:5432/postgres'},
            {'RU5_DEVICE_DB_URL': 'postgresql://postgres:secret@127.0.0.1:54322/postgres?host=remote'},
            {'DOCKER_HOST': 'ssh://remote'}, {'DOCKER_CONTEXT': 'production'},
            {'RU5_DEVICE_PROOF_DIR': '/tmp/other-project'}, {'RU5_DEVICE_PACKAGE': 'rs.uskoci.production'},
        ]
        for change in cases:
            with self.subTest(change=list(change)):
                with self.assertRaises(RuntimeError) as caught:
                    validate_local_targets({**ENV, **change})
                self.assertNotIn('secret', str(caught.exception))

    def test_rejects_another_container_image_id_or_running_state(self):
        for index, value in ((0, 'short'), (1, '/supabase_rest_production'), (2, 'supabase/postgres:17'), (3, False)):
            fields = IDENTITY.copy(); fields[index] = value
            with self.subTest(index=index), self.assertRaises(RuntimeError):
                validate_container(fields, expected_running=True)
        with self.assertRaises(RuntimeError):
            validate_container(IDENTITY, expected_running=True, expected_id='b' * 64)

    def test_restores_the_same_immutable_container_after_a_failed_ui_assertion(self):
        outage = object.__new__(LocalRestOutage)
        outage.container_id = 'a' * 64
        outage.inspect = Mock(side_effect=[IDENTITY, [*IDENTITY[:3], False], IDENTITY])
        outage.docker = Mock()
        outage.wait_http = Mock()
        with self.assertRaisesRegex(AssertionError, 'real UI failed'):
            with outage.stopped():
                raise AssertionError('real UI failed')
        self.assertEqual(outage.docker.call_args_list[0].args, ('container', 'stop', '--timeout', '5', 'a' * 64))
        self.assertEqual(outage.docker.call_args_list[1].args, ('container', 'start', 'a' * 64))
        self.assertEqual(outage.wait_http.call_args_list[-1].kwargs, {'available': True})

    def test_refuses_mutation_if_identity_changed_before_stop(self):
        outage = object.__new__(LocalRestOutage); outage.container_id = 'a' * 64
        outage.inspect = Mock(return_value=['b' * 64, *IDENTITY[1:]])
        outage.docker = Mock()
        with self.assertRaises(RuntimeError):
            with outage.stopped():
                pass
        outage.docker.assert_not_called()


if __name__ == '__main__':
    unittest.main()
