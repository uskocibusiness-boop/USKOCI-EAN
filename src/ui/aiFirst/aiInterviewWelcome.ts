/** One immediate, local opening per fresh AI chat. This is NOT a Gemini response.
 * The server's owned conversation and first model reply still start with the
 * person's first message. Never persist a synthetic greeting as an AI turn.
 */
export function workerInterviewOpening(hasProfileContent: boolean): string {
  return hasProfileContent
    ? 'Ćao! Drago mi je što si ponovo tu. 🧡\n\nZajedno možemo da dopunimo tvoj radni profil. Reci mi šta želiš da promeniš, a ostale podatke ostavljamo kako jesu. Izmene važe tek kada ih pregledaš i sačuvaš.\n\nŠta želiš da promeniš?'
    : 'Ćao! Drago mi je što si deo USKOČI zajednice. 🧡\n\nZajedno ćemo kroz kratak razgovor napraviti tvoj radni profil. Tako će USKOČI moći da ti prikazuje zadatke koji odgovaraju onome što želiš da radiš, području i vremenu koje ti odgovara. Ako uključiš obaveštenja, možeš dobijati obaveštenja o takvim zadacima.\n\nNe moraš da popunjavaš formular. Vodiću te pitanje po pitanje, a na kraju sve pregledaš i potvrđuješ.\n\nZa početak, koje vrste zadataka želiš da obavljaš?';
}

export function taskInterviewOpening(editingTask: boolean): string {
  return editingTask
    ? 'Ćao! Ovde možemo da dopunimo ili izmenimo tvoj zadatak. 🧡\n\nReci mi svojim rečima šta želiš drugačije. Sačuvaćemo ostale poznate podatke u nacrtu, a izmena neće važiti dok je ne pregledaš i potvrdiš.\n\nŠta želiš da promeniš?'
    : 'Ćao! Tu sam da ti pomognem da objaviš zadatak na USKOČI. 🧡\n\nSamo mi objasni šta ti treba, kao da razgovaraš sa nekim ko želi da ti pomogne. Ja ću izdvojiti važne detalje, postaviti sledeće pitanje samo kada je potrebno i pripremiti nacrt zadatka za pregled. Ne moraš da znaš gde se šta unosi.\n\nNišta ne objavljujemo bez tvoje potvrde.\n\nZa početak, šta želiš da neko uradi za tebe?';
}
