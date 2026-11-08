begin;

update private.legal_document_versions
set content_sha256 = 'ea1a97627894b76461aff365d4df47e3bda6ac0af418ad31e93c54362e65cea8',
    published_at = statement_timestamp(),
    effective_at = statement_timestamp()
where document_kind = 'TERMS' and version_label = 'v1.0-20261108';

update private.legal_document_versions
set content_sha256 = '7ea5711378d724ac92e5d2b7779ee06369ae6652a7d5f3c49e2c47a7cfbd38ef',
    published_at = statement_timestamp(),
    effective_at = statement_timestamp()
where document_kind = 'PRIVACY' and version_label = 'v1.0-20261108';

commit;