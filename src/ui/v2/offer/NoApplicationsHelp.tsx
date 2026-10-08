import { StyleSheet, View } from 'react-native';
import { T } from '../../Text';
import { Surface } from '../../system/Surface';
import { sys } from '../../system/tokens';
import { NO_APPLICATIONS_HELP_LABEL, type NoApplicationsHelp as Help, type NoApplicationsHelpAction } from '../ownTaskOverview';
import { V2Action } from '../V2Action';

/**
 * R16 (POTREBE, 2026-10-07): what the owner's own task page says after a day without a single application, and the real ways to change it.
 * The words and the buttons come from `noApplicationsHelp` (`ownTaskOverview.ts`), which says them only when this task's state makes each
 * one a real thing to do; this draws them as ONE note (a tint, never a card) with its buttons under it, one under the other, quiet: the
 * page keeps its one green action. The page maps each action to what it already does (the photo step, the term, the share sheet, the
 * edit). BUILT BEHIND A SWITCH, OFF (`NO_APPLICATIONS_HELP_ON`): see `noApplicationsHelp` for what the server has to carry first.
 */
export function NoApplicationsHelp({ help, onAction }: { help: Help; onAction: (action: NoApplicationsHelpAction) => void }) {
  return <Surface kind="note" testID="no-applications-help">
    <T accessibilityRole="header" variant="bodyStrong">{help.sentence}</T>
    <View style={s.actions}>
      {help.actions.map(action => <V2Action key={action} kind="quiet" compact label={NO_APPLICATIONS_HELP_LABEL[action]} onPress={() => onAction(action)} style={s.action} />)}
    </View>
  </Surface>;
}

const s = StyleSheet.create({
  actions: { marginTop: sys.space.sm, gap: sys.space.xs },
  action: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
