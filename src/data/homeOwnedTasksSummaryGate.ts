/** The bounded Home task summary is compiled into a build only after its exact DEV RPC is installed. */
export const HOME_OWNED_TASKS_SUMMARY_BUILT = '1';
export function homeOwnedTasksSummaryBuilt(buildFlag: unknown = process.env.EXPO_PUBLIC_HOME_OWNED_TASKS_SUMMARY): boolean {
  return buildFlag === HOME_OWNED_TASKS_SUMMARY_BUILT;
}
