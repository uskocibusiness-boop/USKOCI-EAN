import { decodeTaxonomySemanticReviewCandidates } from '../../contracts/taxonomySemanticReview';

const ID='66666666-6666-4666-8666-666666666666';
const OTHER='77777777-7777-4777-8777-777777777777';
const NAME='Montaža gotovog ormara';
const valid=(mode:'ON_SITE'|'REMOTE'='ON_SITE')=>({
  service:NAME,mode,categoryId:ID,categoryLabel:'Sklapanje ormara',
  categoryParentId:null,reason:'Isti konkretan posao sklapanja gotovog ormara.',catalogVersion:17
});

it('retains only bounded, complete, source-reviewed semantic comparisons, never a capability',()=>{
  expect(decodeTaxonomySemanticReviewCandidates([valid()],17,[NAME])).toEqual([valid()]);
  expect(decodeTaxonomySemanticReviewCandidates([valid('ON_SITE'),valid('REMOTE')],17,[NAME]))
    .toEqual([valid('ON_SITE'),valid('REMOTE')]);
  expect(decodeTaxonomySemanticReviewCandidates([valid()],17,[NAME],'REMOTE')).toBeNull();
  expect(decodeTaxonomySemanticReviewCandidates([valid('REMOTE')],17,[NAME],'REMOTE')).toEqual([valid('REMOTE')]);
});

it('rejects duplicated, inconsistent, invented or out-of-scope category identities',()=>{
  const all=[
    [valid(),valid()],
    [valid(),{...valid('REMOTE'),categoryId:OTHER}],
    [{...valid(),categoryId:'invented-id'}],
    [{...valid(),categoryLabel:' '}],
    [{...valid(),service:'Čišćenje klima'}],
    [{...valid(),mode:'BOTH'}],
    [{...valid(),catalogVersion:18}],
    [{...valid(),reason:'no'}],
    [{...valid(),reason:'a'.repeat(1001)}],
    [{...valid(),extraAuthority:true}],
    [{...valid(),categoryParentId:'not-uuid'}],
  ];
  for(const batch of all){
    expect(decodeTaxonomySemanticReviewCandidates(batch,17,[NAME])).toBeNull();
  }
  expect(decodeTaxonomySemanticReviewCandidates([valid()],0,[NAME])).toBeNull();
  expect(decodeTaxonomySemanticReviewCandidates([valid()],17,[])).toBeNull();
  expect(decodeTaxonomySemanticReviewCandidates([],17,[NAME])).toBeNull();
  expect(decodeTaxonomySemanticReviewCandidates(Array.from({length:25},()=>valid()),17,[NAME])).toBeNull();
});

it('a cross-mode category match never certifies the worker offered an unrequested mode',()=>{
  // This decoder only checks the signed comparison; the reviewer must separately
  // prove the full USER-quoted mode selection and never derive it from a category.
  const onlyOnSite=decodeTaxonomySemanticReviewCandidates([valid('ON_SITE')],17,[NAME]);
  expect(onlyOnSite).toHaveLength(1);
  expect(onlyOnSite?.some(row=>row.mode==='REMOTE')).toBe(false);
});
