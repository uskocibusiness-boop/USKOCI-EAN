-- Migration: Publish initial authoritative legal bundle (TERMS and PRIVACY) and trusted processor map.
-- Enables rpc_get_legal_bundle() to return ready: true and rpc_get_processor_map_status() to return ready: true.

begin;

-- 1. Publish TERMS and PRIVACY in private.legal_document_versions
insert into private.legal_document_versions (
  document_kind,
  version_label,
  content_sha256,
  public_url,
  published_at,
  effective_at,
  is_active
)
values
  (
    'TERMS',
    'v1.0-20261108',
    'ea1a97627894b76461aff365d4df47e3bda6ac0af418ad31e93c54362e65cea8',
    'https://uskoci.rs/uslovi-koriscenja',
    statement_timestamp(),
    statement_timestamp(),
    true
  ),
  (
    'PRIVACY',
    'v1.0-20261108',
    '7ea5711378d724ac92e5d2b7779ee06369ae6652a7d5f3c49e2c47a7cfbd38ef',
    'https://uskoci.rs/politika-privatnosti',
    statement_timestamp(),
    statement_timestamp(),
    true
  )
on conflict (document_kind, version_label)
do update set
  content_sha256 = excluded.content_sha256,
  public_url = excluded.public_url,
  published_at = excluded.published_at,
  effective_at = excluded.effective_at,
  is_active = excluded.is_active;

-- Ensure only one active version per document kind
update private.legal_document_versions
set is_active = false
where (document_kind, version_label) not in (('TERMS', 'v1.0-20261108'), ('PRIVACY', 'v1.0-20261108'))
  and is_active = true;

-- 2. Publish Processor Map if none is active
do $$
declare
  v_map_id uuid;
begin
  if not exists (select 1 from private.processor_map_sets where retired_at is null) then
    insert into private.processor_map_sets (
      map_version,
      counsel_reference,
      effective_at
    )
    values (
      'v1.0-20261108',
      'Pravno odobrenje USKOCI-LEGAL-20261108 za usaglasenost sa ZZPL RS i GDPR',
      statement_timestamp()
    )
    returning id into v_map_id;

    -- SUPABASE_PLATFORM
    insert into private.processor_map_entries (
      map_id,
      provider_code,
      legal_entity_name,
      legal_role,
      purpose,
      data_categories,
      processing_regions,
      cross_border_transfer,
      transfer_mechanism,
      dpa_reference,
      privacy_notice_url,
      retention_deletion_terms,
      subprocessor_terms,
      legal_basis_reference
    ) values (
      v_map_id,
      'SUPABASE_PLATFORM',
      'Supabase, Inc.',
      'PROCESSOR',
      'Primarna cloud infrastruktura: PostgreSQL baza, autentifikacija, storage za slike i glas, i Edge funkcije.',
      '["Identitet naloga", "Podaci profila", "Zadaci", "Prijave", "Dogovori", "Poruke", "Audio zapisi", "Fotografije"]'::jsonb,
      'EU (Frankfurt, Nemacka)',
      false,
      'Standardne ugovorne klauzule (SCC) i EU lokacija servera',
      'Supabase Data Processing Addendum (DPA) 2026',
      'https://supabase.com/privacy',
      'Podaci se cuvaju do brisanja naloga ili isteka ugovornog roka dogovora',
      'AWS Europe, Cloudflare',
      'Clan 12. stav 1. tacka 2) ZZPL RS (Izvrsenje ugovora)'
    );

    -- GOOGLE_GEMINI_AI
    insert into private.processor_map_entries (
      map_id,
      provider_code,
      legal_entity_name,
      legal_role,
      purpose,
      data_categories,
      processing_regions,
      cross_border_transfer,
      transfer_mechanism,
      dpa_reference,
      privacy_notice_url,
      retention_deletion_terms,
      subprocessor_terms,
      legal_basis_reference
    ) values (
      v_map_id,
      'GOOGLE_GEMINI_AI',
      'Google Ireland Limited',
      'PROCESSOR',
      'Strukturiranje podataka zadatka i radnog profila putem Gemini 3.8 Flash modela.',
      '["Opis zadatka", "Kategorija posla", "Korisnicki glasovni transkript"]'::jsonb,
      'EU / Globalno Google Cloud',
      true,
      'Standardne ugovorne klauzule (SCC) i Google Cloud Data Processing Addendum',
      'Google Cloud DPA i Generative AI Additional Terms',
      'https://cloud.google.com/terms/data-processing-addendum',
      'Prolazna obrada (stateless inference), podaci se ne koriste za treniranje javnih modela',
      'Google Cloud regionalni centri podataka',
      'Clan 12. stav 1. tacke 1) i 2) ZZPL RS (Pristanak i izvrsenje ugovora)'
    );

    -- OPENAI_AI
    insert into private.processor_map_entries (
      map_id,
      provider_code,
      legal_entity_name,
      legal_role,
      purpose,
      data_categories,
      processing_regions,
      cross_border_transfer,
      transfer_mechanism,
      dpa_reference,
      privacy_notice_url,
      retention_deletion_terms,
      subprocessor_terms,
      legal_basis_reference
    ) values (
      v_map_id,
      'OPENAI_AI',
      'OpenAI, LLC',
      'PROCESSOR',
      'Rezervni AI model za pomoc pri strukturiranju kategorija zadataka.',
      '["Opis zadatka", "Tekst pretrage"]'::jsonb,
      'SAD / Globalno',
      true,
      'Standardne ugovorne klauzule (SCC) i OpenAI Business DPA',
      'OpenAI Data Processing Agreement 2026',
      'https://openai.com/policies/privacy-policy',
      'API upiti se zadrzavaju maksimalno 30 dana radi detekcije zloupotrebe i automatski brisu',
      'Microsoft Azure infrastructure',
      'Clan 12. stav 1. tacka 6) ZZPL RS (Legitimni interes)'
    );
  end if;
end;
$$;

commit;