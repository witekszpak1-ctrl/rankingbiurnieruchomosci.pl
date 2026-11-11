/**
 * Odmiana nazw miast w miejscowniku z przyimkiem ("w Warszawie", "we Wrocławiu") dla miast z listy branży
 * (packages/verticals/nieruchomosci/cities.txt). Miasta spoza słownika dostają bezpieczną formę "w mieście X".
 */
const LOCATIVE: Record<string, string> = {
  "Wrocław": "we Wrocławiu", "Warszawa": "w Warszawie", "Kraków": "w Krakowie", "Łódź": "w Łodzi", "Poznań": "w Poznaniu",
  "Gdańsk": "w Gdańsku", "Szczecin": "w Szczecinie", "Bydgoszcz": "w Bydgoszczy", "Lublin": "w Lublinie",
  "Białystok": "w Białymstoku", "Katowice": "w Katowicach", "Gdynia": "w Gdyni", "Częstochowa": "w Częstochowie",
  "Radom": "w Radomiu", "Rzeszów": "w Rzeszowie", "Toruń": "w Toruniu", "Sosnowiec": "w Sosnowcu", "Kielce": "w Kielcach",
  "Gliwice": "w Gliwicach", "Olsztyn": "w Olsztynie", "Zabrze": "w Zabrzu", "Bielsko-Biała": "w Bielsku-Białej",
  "Bytom": "w Bytomiu", "Zielona Góra": "w Zielonej Górze", "Rybnik": "w Rybniku", "Ruda Śląska": "w Rudzie Śląskiej",
  "Opole": "w Opolu", "Tychy": "w Tychach", "Gorzów Wielkopolski": "w Gorzowie Wielkopolskim", "Elbląg": "w Elblągu",
  "Płock": "w Płocku", "Dąbrowa Górnicza": "w Dąbrowie Górniczej", "Wałbrzych": "w Wałbrzychu", "Włocławek": "we Włocławku",
  "Tarnów": "w Tarnowie", "Chorzów": "w Chorzowie", "Koszalin": "w Koszalinie", "Kalisz": "w Kaliszu", "Legnica": "w Legnicy",
  "Grudziądz": "w Grudziądzu", "Słupsk": "w Słupsku", "Jaworzno": "w Jaworznie", "Jastrzębie-Zdrój": "w Jastrzębiu-Zdroju",
  "Nowy Sącz": "w Nowym Sączu", "Jelenia Góra": "w Jeleniej Górze", "Siedlce": "w Siedlcach", "Mysłowice": "w Mysłowicach",
  "Konin": "w Koninie", "Piła": "w Pile", "Piotrków Trybunalski": "w Piotrkowie Trybunalskim", "Inowrocław": "w Inowrocławiu",
  "Lubin": "w Lubinie", "Ostrów Wielkopolski": "w Ostrowie Wielkopolskim", "Suwałki": "w Suwałkach", "Stargard": "w Stargardzie",
  "Gniezno": "w Gnieźnie", "Ostrowiec Świętokrzyski": "w Ostrowcu Świętokrzyskim", "Siemianowice Śląskie": "w Siemianowicach Śląskich",
  "Głogów": "w Głogowie", "Pabianice": "w Pabianicach", "Leszno": "w Lesznie", "Żory": "w Żorach", "Zamość": "w Zamościu",
  "Pruszków": "w Pruszkowie", "Łomża": "w Łomży", "Ełk": "w Ełku", "Tomaszów Mazowiecki": "w Tomaszowie Mazowieckim",
  "Chełm": "w Chełmie", "Mielec": "w Mielcu", "Kędzierzyn-Koźle": "w Kędzierzynie-Koźlu", "Przemyśl": "w Przemyślu",
  "Stalowa Wola": "w Stalowej Woli", "Tczew": "w Tczewie", "Biała Podlaska": "w Białej Podlaskiej", "Bełchatów": "w Bełchatowie",
  "Świdnica": "w Świdnicy", "Będzin": "w Będzinie", "Zgierz": "w Zgierzu", "Piekary Śląskie": "w Piekarach Śląskich",
  "Racibórz": "w Raciborzu", "Legionowo": "w Legionowie", "Ostrołęka": "w Ostrołęce", "Świętochłowice": "w Świętochłowicach",
  "Wejherowo": "w Wejherowie", "Zawiercie": "w Zawierciu", "Starachowice": "w Starachowicach", "Skierniewice": "w Skierniewicach",
  "Kutno": "w Kutnie", "Puławy": "w Puławach", "Otwock": "w Otwocku", "Rumia": "w Rumi", "Kołobrzeg": "w Kołobrzegu",
  "Starogard Gdański": "w Starogardzie Gdańskim", "Ciechanów": "w Ciechanowie", "Krosno": "w Krośnie", "Świnoujście": "w Świnoujściu",
  "Piaseczno": "w Piasecznie", "Sopot": "w Sopocie", "Zakopane": "w Zakopanem", "Żyrardów": "w Żyrardowie", "Malbork": "w Malborku",
  "Mińsk Mazowiecki": "w Mińsku Mazowieckim", "Bolesławiec": "w Bolesławcu", "Oświęcim": "w Oświęcimiu", "Nysa": "w Nysie",
  "Chojnice": "w Chojnicach", "Dębica": "w Dębicy", "Ostróda": "w Ostródzie", "Kraśnik": "w Kraśniku", "Żary": "w Żarach",
  "Jarosław": "w Jarosławiu", "Sieradz": "w Sieradzu", "Świecie": "w Świeciu", "Sanok": "w Sanoku", "Mikołów": "w Mikołowie",
  "Czechowice-Dziedzice": "w Czechowicach-Dziedzicach", "Kwidzyn": "w Kwidzynie", "Żagań": "w Żaganiu", "Knurów": "w Knurowie",
  "Gorlice": "w Gorlicach", "Skarżysko-Kamienna": "w Skarżysku-Kamiennej", "Wodzisław Śląski": "w Wodzisławiu Śląskim",
  "Iława": "w Iławie", "Nowa Sól": "w Nowej Soli", "Sochaczew": "w Sochaczewie", "Wołomin": "w Wołominie",
  "Szczecinek": "w Szczecinku", "Oleśnica": "w Oleśnicy", "Giżycko": "w Giżycku", "Wyszków": "w Wyszkowie",
  "Kłodzko": "w Kłodzku", "Bochnia": "w Bochni", "Brzeg": "w Brzegu", "Kościan": "w Kościanie",
  "Grodzisk Mazowiecki": "w Grodzisku Mazowieckim", "Augustów": "w Augustowie", "Łowicz": "w Łowiczu", "Chrzanów": "w Chrzanowie",
  "Olkusz": "w Olkuszu", "Cieszyn": "w Cieszynie", "Radomsko": "w Radomsku", "Zduńska Wola": "w Zduńskiej Woli",
  "Świebodzice": "w Świebodzicach", "Turek": "w Turku", "Września": "we Wrześni", "Jasło": "w Jaśle", "Krotoszyn": "w Krotoszynie",
  "Nowy Targ": "w Nowym Targu", "Wieliczka": "w Wieliczce", "Skawina": "w Skawinie", "Myślenice": "w Myślenicach",
  "Andrychów": "w Andrychowie", "Wadowice": "w Wadowicach", "Żywiec": "w Żywcu", "Ząbki": "w Ząbkach", "Marki": "w Markach",
  "Łomianki": "w Łomiankach", "Józefów": "w Józefowie", "Konstancin-Jeziorna": "w Konstancinie-Jeziornie", "Milanówek": "w Milanówku",
  "Ożarów Mazowiecki": "w Ożarowie Mazowieckim", "Błonie": "w Błoniu", "Nowy Dwór Mazowiecki": "w Nowym Dworze Mazowieckim",
  "Grójec": "w Grójcu", "Mława": "w Mławie", "Płońsk": "w Płońsku", "Sokołów Podlaski": "w Sokołowie Podlaskim",
  "Łuków": "w Łukowie", "Radzyń Podlaski": "w Radzyniu Podlaskim", "Świdnik": "w Świdniku", "Łęczna": "w Łęcznej",
  "Hrubieszów": "w Hrubieszowie", "Tomaszów Lubelski": "w Tomaszowie Lubelskim", "Biłgoraj": "w Biłgoraju",
  "Zgorzelec": "w Zgorzelcu", "Bogatynia": "w Bogatyni", "Lubań": "w Lubaniu", "Kamienna Góra": "w Kamiennej Górze",
  "Dzierżoniów": "w Dzierżoniowie", "Bielawa": "w Bielawie", "Strzegom": "w Strzegomiu", "Jawor": "w Jaworze", "Oława": "w Oławie",
  "Trzebnica": "w Trzebnicy", "Środa Śląska": "w Środzie Śląskiej", "Polkowice": "w Polkowicach", "Chocianów": "w Chocianowie",
  "Góra": "w Górze", "Wschowa": "we Wschowie", "Międzyrzecz": "w Międzyrzeczu", "Świebodzin": "w Świebodzinie",
  "Sulechów": "w Sulechowie", "Gubin": "w Gubinie", "Kostrzyn nad Odrą": "w Kostrzynie nad Odrą", "Myślibórz": "w Myśliborzu",
  "Gryfino": "w Gryfinie", "Police": "w Policach", "Goleniów": "w Goleniowie", "Nowogard": "w Nowogardzie",
  "Kamień Pomorski": "w Kamieniu Pomorskim", "Wolin": "w Wolinie", "Międzyzdroje": "w Międzyzdrojach", "Białogard": "w Białogardzie",
  "Świdwin": "w Świdwinie", "Darłowo": "w Darłowie", "Ustka": "w Ustce", "Lębork": "w Lęborku", "Bytów": "w Bytowie",
  "Kościerzyna": "w Kościerzynie", "Kartuzy": "w Kartuzach", "Pruszcz Gdański": "w Pruszczu Gdańskim", "Reda": "w Redzie",
  "Puck": "w Pucku", "Władysławowo": "we Władysławowie", "Hel": "na Helu", "Jastarnia": "w Jastarni", "Łeba": "w Łebie",
  "Braniewo": "w Braniewie", "Bartoszyce": "w Bartoszycach", "Kętrzyn": "w Kętrzynie", "Mrągowo": "w Mrągowie", "Pisz": "w Piszu",
  "Szczytno": "w Szczytnie", "Nidzica": "w Nidzicy", "Działdowo": "w Działdowie", "Lidzbark Warmiński": "w Lidzbarku Warmińskim",
  "Olecko": "w Olecku", "Gołdap": "w Gołdapi", "Sejny": "w Sejnach", "Hajnówka": "w Hajnówce", "Bielsk Podlaski": "w Bielsku Podlaskim",
  "Zambrów": "w Zambrowie", "Grajewo": "w Grajewie", "Kolno": "w Kolnie", "Brodnica": "w Brodnicy", "Chełmno": "w Chełmnie",
  "Golub-Dobrzyń": "w Golubiu-Dobrzyniu", "Rypin": "w Rypinie", "Aleksandrów Kujawski": "w Aleksandrowie Kujawskim",
  "Ciechocinek": "w Ciechocinku", "Nakło nad Notecią": "w Nakle nad Notecią", "Solec Kujawski": "w Solcu Kujawskim",
  "Żnin": "w Żninie", "Mogilno": "w Mogilnie", "Szubin": "w Szubinie", "Wągrowiec": "w Wągrowcu", "Oborniki": "w Obornikach",
  "Czarnków": "w Czarnkowie", "Chodzież": "w Chodzieży", "Złotów": "w Złotowie", "Wałcz": "w Wałczu", "Trzcianka": "w Trzciance",
  "Swarzędz": "w Swarzędzu", "Luboń": "w Luboniu", "Mosina": "w Mosinie", "Śrem": "w Śremie",
  "Środa Wielkopolska": "w Środzie Wielkopolskiej", "Jarocin": "w Jarocinie", "Pleszew": "w Pleszewie", "Kępno": "w Kępnie",
  "Ostrzeszów": "w Ostrzeszowie", "Rawicz": "w Rawiczu", "Gostyń": "w Gostyniu", "Nowy Tomyśl": "w Nowym Tomyślu",
  "Grodzisk Wielkopolski": "w Grodzisku Wielkopolskim", "Wolsztyn": "w Wolsztynie", "Szamotuły": "w Szamotułach", "Koło": "w Kole",
  "Słupca": "w Słupcy", "Łask": "w Łasku", "Wieluń": "w Wieluniu", "Opoczno": "w Opocznie", "Rawa Mazowiecka": "w Rawie Mazowieckiej",
  "Brzeziny": "w Brzezinach", "Łęczyca": "w Łęczycy", "Głowno": "w Głownie", "Ozorków": "w Ozorkowie",
  "Aleksandrów Łódzki": "w Aleksandrowie Łódzkim", "Konstantynów Łódzki": "w Konstantynowie Łódzkim", "Busko-Zdrój": "w Busku-Zdroju",
  "Końskie": "w Końskich", "Jędrzejów": "w Jędrzejowie", "Sandomierz": "w Sandomierzu", "Staszów": "w Staszowie",
  "Pińczów": "w Pińczowie", "Włoszczowa": "we Włoszczowie", "Kazimierza Wielka": "w Kazimierzy Wielkiej", "Miechów": "w Miechowie",
  "Proszowice": "w Proszowicach", "Brzesko": "w Brzesku", "Limanowa": "w Limanowej", "Zakliczyn": "w Zakliczynie",
  "Dąbrowa Tarnowska": "w Dąbrowie Tarnowskiej", "Ropczyce": "w Ropczycach", "Łańcut": "w Łańcucie", "Przeworsk": "w Przeworsku",
  "Lubaczów": "w Lubaczowie", "Leżajsk": "w Leżajsku", "Nisko": "w Nisku", "Tarnobrzeg": "w Tarnobrzegu",
  "Kolbuszowa": "w Kolbuszowej", "Brzozów": "w Brzozowie", "Ustrzyki Dolne": "w Ustrzykach Dolnych", "Lesko": "w Lesku",
  "Krynica-Zdrój": "w Krynicy-Zdroju", "Rabka-Zdrój": "w Rabce-Zdroju", "Szczawnica": "w Szczawnicy", "Ustroń": "w Ustroniu",
  "Wisła": "w Wiśle", "Szczyrk": "w Szczyrku", "Pszczyna": "w Pszczynie", "Lubliniec": "w Lublińcu",
  "Tarnowskie Góry": "w Tarnowskich Górach", "Czeladź": "w Czeladzi", "Łaziska Górne": "w Łaziskach Górnych",
  "Prudnik": "w Prudniku", "Głuchołazy": "w Głuchołazach", "Krapkowice": "w Krapkowicach", "Strzelce Opolskie": "w Strzelcach Opolskich",
  "Kluczbork": "w Kluczborku", "Namysłów": "w Namysłowie", "Olesno": "w Oleśnie", "Karpacz": "w Karpaczu",
  "Szklarska Poręba": "w Szklarskiej Porębie", "Polanica-Zdrój": "w Polanicy-Zdroju", "Kudowa-Zdrój": "w Kudowie-Zdroju",
  "Duszniki-Zdrój": "w Dusznikach-Zdroju",
};

/** "w Warszawie", "we Wrocławiu"; dla miasta spoza słownika "w mieście X" (forma zawsze poprawna gramatycznie). */
export function inCity(name: string): string {
  return LOCATIVE[name] ?? `w mieście ${name}`;
}

/** Sam miejscownik bez przyimka ("Warszawie"), np. do zdań "biura nieruchomości w ...". */
export function cityLocative(name: string): string {
  const full = inCity(name);
  return full.replace(/^(we|w|na)\s+/, "");
}

export function hasLocative(name: string): boolean {
  return name in LOCATIVE;
}
