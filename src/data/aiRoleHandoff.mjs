// One-use, in-memory handoff of user-authored draft text between Need and Worker.
// No conversation history, AI output, profile facts, network calls or persistent storage.
const TTL_MS=60_000,MAX_CHARS=8_000;
let sequence=0,pending=null;
function nextToken(){sequence=(sequence+1)%Number.MAX_SAFE_INTEGER;return `handoff-${Date.now().toString(36)}-${sequence.toString(36)}`;}
export function stageRoleHandoffText(targetRole,text){
 pending=null;
 if((targetRole!=='NEED'&&targetRole!=='WORKER')||typeof text!=='string'||!text.trim()||text.length>MAX_CHARS)return null;
 const token=nextToken();pending={targetRole,text,token,expiresAt:Date.now()+TTL_MS};return token;
}
export function takeRoleHandoffText(targetRole,token){
 if(!pending)return null;
 if(Date.now()>pending.expiresAt){pending=null;return null;}
 if(pending.targetRole!==targetRole||pending.token!==token)return null;
 const text=pending.text;pending=null;return text;
}
export function clearRoleHandoffText(token){if(token===undefined||pending?.token===token)pending=null;}
export const ROLE_HANDOFF_TTL_MS=TTL_MS,ROLE_HANDOFF_MAX_CHARS=MAX_CHARS;
