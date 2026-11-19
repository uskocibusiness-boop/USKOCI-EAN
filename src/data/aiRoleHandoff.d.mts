export type AiRoleHandoffTarget = 'NEED' | 'WORKER';
export function stageRoleHandoffText(targetRole: AiRoleHandoffTarget, text: string): string | null;
export function takeRoleHandoffText(targetRole: AiRoleHandoffTarget, token: string): string | null;
export function clearRoleHandoffText(token?: string): void;
export const ROLE_HANDOFF_TTL_MS: number;
export const ROLE_HANDOFF_MAX_CHARS: number;
