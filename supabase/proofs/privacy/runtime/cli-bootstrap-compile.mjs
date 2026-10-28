// Bun-only build helper: same upstream legacy entrypoint and release build defines.
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [upstream,outfile,version] = process.argv.slice(2);
const {bundleServeMainTemplate} = await import(pathToFileURL(join(upstream,
  'apps/cli/src/shared/functions/serve-main-bundler.ts')).href);
const result = await Bun.build({
  entrypoints:[join(upstream,'apps/cli/src/legacy/main.ts')],
  compile:{target:'bun-linux-x64-baseline',outfile},minify:true,
  define:{'process.env.SUPABASE_CLI_VERSION':JSON.stringify(version),SUPABASE_LIBC:JSON.stringify('glibc'),
    SUPABASE_FUNCTIONS_SERVE_MAIN_TEMPLATE:JSON.stringify(await bundleServeMainTemplate()),
    'process.env.SUPABASE_CLI_POSTHOG_KEY':JSON.stringify(''),
    'process.env.SUPABASE_CLI_POSTHOG_HOST':JSON.stringify('')},
});
if (!result.success) throw new Error('CLI_BUN_COMPILE_FAILED');
