/** One immediate, local opening per fresh AI chat. This is NOT a Gemini response.
 * The server's owned conversation and first model reply still start with the
 * person's first message. Never persist a synthetic greeting as an AI turn.
 */
export function workerInterviewOpening(hasProfileContent: boolean): string {
  return hasProfileContent
    ? 'Dobar dan! Drago mi je što ste ponovo tu. 🧡\n\nNapišite mi šta želite da promenite u svom radnom profilu. Ostale podatke ostavljamo kako jesu, a izmene važe tek kada ih pregledate i sačuvate.\n\nŠta biste želeli da izmenite?'
    : 'Dobar dan! Dobro došli u USKOČI zajednicu. 🧡\n\nKroz par kratkih pitanja napravićemo Vaš radni profil, tako da dobijate samo zadatke koji odgovaraju Vašim veštinama, željenom području i vremenu. Ne morate da popunjavate formulare — vodim Vas pitanje po pitanje, a na kraju sve mirno pregledate i potvrđujete.\n\nZa početak, koje vrste poslova ili usluga želite da ponudite?';
}

export function taskInterviewOpening(editingTask: boolean): string {
  return editingTask
    ? 'Dobar dan! Ovde možemo da dopunimo ili izmenimo Vaš zadatak. 🧡\n\nNapišite svojim rečima šta biste želeli drugačije. Sačuvaćemo ostale poznate podatke u nacrtu, a izmena važi tek kada je pregledate i potvrdite.\n\nŠta želite da promenite?'
    : 'Dobar dan! Tu sam da Vam pomognem da brzo i lako objavite zadatak na USKOČI. 🧡\n\nSamo mi opišite šta Vam je potrebno, a ja ću izdvojiti detalje, postaviti pitanje samo kada je potrebno i pripremiti nacrt za Vaš pregled. Ništa ne objavljujemo bez Vaše potvrde.\n\nZa početak, šta želite da neko uradi za Vas?';
}
