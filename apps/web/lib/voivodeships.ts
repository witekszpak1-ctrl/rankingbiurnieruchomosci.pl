/**
 * Województwa miast z katalogu (strona /miasta). Rejestry nie podają województwa, więc lista jest prowadzona ręcznie.
 * Miasto spoza listy trafia do grupy "Pozostałe miejscowości", dopóki ktoś go nie dopisze.
 */
const VOIVODESHIPS: Record<string, string[]> = {
  dolnośląskie: ["Bielawa", "Bolesławiec", "Chocianów", "Dzierżoniów", "Góra", "Głogów", "Jawor", "Jelenia Góra", "Kamienna Góra", "Karpacz", "Kudowa-Zdrój", "Kłodzko", "Legnica", "Lubań", "Lubin", "Oleśnica", "Oława", "Polanica-Zdrój", "Polkowice", "Strzegom", "Szklarska Poręba", "Trzebnica", "Wałbrzych", "Wrocław", "Zgorzelec", "Środa Śląska", "Świdnica", "Świebodzice"],
  "kujawsko-pomorskie": ["Aleksandrów Kujawski", "Brodnica", "Bydgoszcz", "Chełmno", "Ciechocinek", "Golub-Dobrzyń", "Grudziądz", "Inowrocław", "Mogilno", "Nakło nad Notecią", "Rypin", "Szubin", "Toruń", "Włocławek", "Świecie", "Żnin"],
  lubelskie: ["Biała Podlaska", "Biłgoraj", "Chełm", "Hrubieszów", "Kraśnik", "Lublin", "Puławy", "Radzyń Podlaski", "Tomaszów Lubelski", "Zamość", "Łuków", "Łęczna", "Świdnik"],
  lubuskie: ["Gorzów Wielkopolski", "Kostrzyn nad Odrą", "Międzyrzecz", "Nowa Sól", "Sulechów", "Wschowa", "Zielona Góra", "Świebodzin", "Żagań", "Żary"],
  łódzkie: ["Aleksandrów Łódzki", "Bełchatów", "Brzeziny", "Głowno", "Konstantynów Łódzki", "Kutno", "Opoczno", "Ozorków", "Pabianice", "Piotrków Trybunalski", "Radomsko", "Rawa Mazowiecka", "Sieradz", "Skierniewice", "Tomaszów Mazowiecki", "Wieluń", "Zduńska Wola", "Zgierz", "Łask", "Łowicz", "Łódź", "Łęczyca"],
  małopolskie: ["Andrychów", "Bochnia", "Brzesko", "Chrzanów", "Dąbrowa Tarnowska", "Gorlice", "Kraków", "Krynica-Zdrój", "Limanowa", "Miechów", "Mszana Dolna", "Myślenice", "Nowy Sącz", "Nowy Targ", "Olkusz", "Oświęcim", "Proszowice", "Rabka-Zdrój", "Skawina", "Szczawnica", "Tarnów", "Wadowice", "Wieliczka", "Zakopane"],
  mazowieckie: ["Błonie", "Ciechanów", "Grodzisk Mazowiecki", "Grójec", "Józefów", "Konstancin-Jeziorna", "Legionowo", "Marki", "Milanówek", "Mińsk Mazowiecki", "Mława", "Nowy Dwór Mazowiecki", "Ostrołęka", "Otrębusy", "Otwock", "Ożarów Mazowiecki", "Piaseczno", "Pruszków", "Płock", "Płońsk", "Radom", "Siedlce", "Sochaczew", "Sokołów Podlaski", "Warszawa", "Wołomin", "Wyszków", "Ząbki", "Łomianki", "Żyrardów"],
  opolskie: ["Brzeg", "Głuchołazy", "Kluczbork", "Krapkowice", "Kędzierzyn-Koźle", "Nysa", "Olesno", "Opole", "Prudnik", "Strzelce Opolskie"],
  podkarpackie: ["Brzozów", "Dębica", "Jarosław", "Jasło", "Krosno", "Leżajsk", "Lubaczów", "Mielec", "Nisko", "Przemyśl", "Przeworsk", "Ropczyce", "Rzeszów", "Sanok", "Stalowa Wola", "Tarnobrzeg", "Ustrzyki Dolne", "Łańcut"],
  podlaskie: ["Augustów", "Białystok", "Bielsk Podlaski", "Grajewo", "Hajnówka", "Kolno", "Suwałki", "Łomża"],
  pomorskie: ["Bytów", "Chojnice", "Gdańsk", "Gdynia", "Hel", "Kartuzy", "Kościerzyna", "Kwidzyn", "Lębork", "Malbork", "Pruszcz Gdański", "Puck", "Reda", "Rumia", "Sopot", "Starogard Gdański", "Słupsk", "Tczew", "Ustka", "Wejherowo", "Władysławowo", "Łeba"],
  śląskie: ["Bielsko-Biała", "Bytom", "Będzin", "Chorzów", "Cieszyn", "Czechowice-Dziedzice", "Czeladź", "Częstochowa", "Dąbrowa Górnicza", "Gliwice", "Jastrzębie-Zdrój", "Jaworzno", "Katowice", "Knurów", "Lubliniec", "Mikołów", "Mysłowice", "Piekary Śląskie", "Pszczyna", "Racibórz", "Ruda Śląska", "Rybnik", "Siemianowice Śląskie", "Sosnowiec", "Szczyrk", "Tarnowskie Góry", "Tychy", "Ustroń", "Wisła", "Wodzisław Śląski", "Zabrze", "Zawiercie", "Łaziska Górne", "Świętochłowice", "Żory", "Żywiec"],
  świętokrzyskie: ["Busko-Zdrój", "Jędrzejów", "Kazimierza Wielka", "Kielce", "Końskie", "Ostrowiec Świętokrzyski", "Pińczów", "Sandomierz", "Skarżysko-Kamienna", "Starachowice", "Staszów"],
  "warmińsko-mazurskie": ["Bartoszyce", "Braniewo", "Działdowo", "Elbląg", "Ełk", "Giżycko", "Gołdap", "Iława", "Kętrzyn", "Lidzbark Warmiński", "Mrągowo", "Nidzica", "Olecko", "Olsztyn", "Ostróda", "Pisz", "Szczytno"],
  wielkopolskie: ["Chodzież", "Czarnków", "Gniezno", "Gostyń", "Grodzisk Wielkopolski", "Jarocin", "Kalisz", "Konin", "Koło", "Kościan", "Krotoszyn", "Kępno", "Leszno", "Luboń", "Mosina", "Nowy Tomyśl", "Oborniki", "Ostrów Wielkopolski", "Piła", "Pleszew", "Poznań", "Rawicz", "Swarzędz", "Szamotuły", "Słupca", "Trzcianka", "Turek", "Wolsztyn", "Września", "Wągrowiec", "Złotów", "Śrem", "Środa Wielkopolska"],
  zachodniopomorskie: ["Białogard", "Darłowo", "Goleniów", "Gryfino", "Kamień Pomorski", "Koszalin", "Kołobrzeg", "Międzyzdroje", "Myślibórz", "Nowogard", "Police", "Stargard", "Szczecin", "Szczecinek", "Wolin", "Świnoujście"],
};

const BY_CITY = new Map<string, string>(
  Object.entries(VOIVODESHIPS).flatMap(([voivodeship, cities]) => cities.map((c) => [c, voivodeship] as const)),
);

export const OTHER_PLACES = "Pozostałe miejscowości";

export function voivodeshipOf(city: string): string {
  return BY_CITY.get(city) ?? OTHER_PLACES;
}

/** Miasta pogrupowane województwami (alfabetycznie), pozostałe miejscowości na końcu. */
export function groupByVoivodeship<T extends { name: string }>(cities: T[]): { voivodeship: string; cities: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const c of cities) {
    const v = voivodeshipOf(c.name);
    groups.set(v, [...(groups.get(v) ?? []), c]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === OTHER_PLACES ? 1 : b === OTHER_PLACES ? -1 : a.localeCompare(b, "pl")))
    .map(([voivodeship, list]) => ({ voivodeship, cities: list.sort((x, y) => x.name.localeCompare(y.name, "pl")) }));
}
