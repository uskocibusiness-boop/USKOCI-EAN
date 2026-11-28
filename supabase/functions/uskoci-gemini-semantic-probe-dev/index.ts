// One-time signed semantic test completed; endpoint is deliberately disabled.
Deno.serve((_req:Request)=>Response.json({code:'DEV_SEMANTIC_PROBE_DISABLED'},{status:410,headers:{'Cache-Control':'no-store'}}));
