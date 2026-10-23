# 13 — Motion, Micro-Interactions & Haptics

## 1. Principi pokreta u USKOČI

Svaka animacija u USKOČI mora imati funkcionalnu svrhu:
1. **Trenutni taktilni odziv na dodir:** Svako dugme i interaktivna kartica (`Press.tsx` / `usePressLift.ts`) reaguju na UI niti (`react-native-reanimated`) blagim skaliranjem (`0.98`) i haptičkim odzivom (`expo-haptics`).
2. **Mirni i brzi prelazi između stanja:** Ulazak elemenata (`Appear.tsx`, 180–220ms) potvrđuje promenu sadržaja bez kašnjenja.
3. **Poštovanje sistemske postavke smanjenog pokreta (`Reduce Motion`):** Kada je uključen `Reduce Motion`, prelazi se izvršavaju trenutno bez prostornog pomeranja i beskonačnih petlji.

---

## 2. Forenzički nalazi i inženjerske popravke pokreta

1. **Zaustavljanje beskonačnih animacija van fokusa (`src/ui/system/Arrive.tsx`):**
   - `AiAssistantArt.tsx` ispravno zaustavlja animaciju kada ekran izgubi fokus (`useIsFocused()`) ili kada aplikacija ode u pozadinu (`AppState`), ali `useBreath()` u `src/ui/system/Arrive.tsx` (linije 69–82) proverava samo `reduced`, pa njegov `Animated.loop` nastavlja da radi u pozadini dok je ekran u navigacionom steku.
   - **Popravka:** Dodati `useIsFocused()` i `AppState` kontrolu u `useBreath()` (ili potpuno prebaciti na Reanimated sa fokus ogradom).
2. **Spajanje dva duplirana `Reduce Motion` hooka:**
   - U kodu postoje `src/ui/system/motion.ts` (`useReducedMotion`) i `src/hooks/useSystemReducedMotion.ts`.
   - **Popravka:** Objediniti u jedan kanonski izvor u `src/ui/system/motion.ts`.
3. **Ujednačavanje pritiska na dugmad (`V2Action.tsx` i `Press.tsx`):**
   - `V2Action.tsx` koristi sopstveni `Animated.spring` na JS/native driveru, dok `Press.tsx` koristi `usePressLift` na Reanimated UI niti.
   - **Popravka:** Povezati `V2Action.tsx` na isti Reanimated standard iz `sys.motion`.
4. **Uklanjanje Android `BlurView` GPU opterećenja (`src/ui/v2/discovery/SearchBackdrop.tsx`):**
   - Dok je `DiscoveryPresentation.tsx:1490` već zamenio `BlurTargetView` običnim `View`-om zbog Android Fabric/GPU stabilnosti, `SearchBackdrop.tsx` (linije 76–78) i dalje montira `<BlurView blurMethod="dimezisBlurViewSdk31Plus" blurTarget={blurTarget} />`.
   - **Popravka:** Zameniti `BlurView` u `SearchBackdrop.tsx` čistim poluprovidnim `Animated.View` scrim-om (`rgba(17, 22, 19, 0.28)`), čime se dobija 60fps otvaranje pretrage/filtera na svim Android telefonima.
