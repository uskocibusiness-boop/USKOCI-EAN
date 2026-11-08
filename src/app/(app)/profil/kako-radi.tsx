import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { HowItWorksReference } from '../../../ui/home/HowItWorks';
import { SettingsScreen } from '../../../ui/settings/SettingsPresentation';

/** The same bundled explanations remain available after dismissal, without a read or reset of personal/business data. */
export default function HowUskociWorks() {
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [token, setToken] = useState<object | null>(null);
  useFocusEffect(useCallback(() => {
    const visit = {}; focus.current = visit; navigating.current = false; setToken(visit);
    return () => { if (focus.current === visit) focus.current = null; };
  }, []));
  const back = () => {
    if (!token || focus.current !== token || navigating.current) return;
    navigating.current = true;
    if (router.canGoBack()) router.back(); else router.replace('/profil/podesavanja');
  };
  return <SettingsScreen title="Kako radi" onBack={back}><HowItWorksReference /></SettingsScreen>;
}
