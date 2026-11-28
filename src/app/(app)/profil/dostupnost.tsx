import { Redirect } from 'expo-router';

/** Legacy link: manual availability has been retired. */
export default function Dostupnost() {
  return <Redirect href="/profil/radnik" />;
}
