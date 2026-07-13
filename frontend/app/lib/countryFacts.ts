// ============================================================
//  Frontle — Datos culturales por país (pistas de los modos quiz).
//  Clave = ISO2. Cada idioma trae 2 pistas ordenadas de VAGA → REVELADORA.
//  Solo hechos muy establecidos (comida, monumentos, naturaleza, arte).
//  ⚠️ Toda entrada la revisa David antes de mergear (un dato falso daña).
//  Los países sin entrada degradan a pistas estructurales (continente,
//  fronteras, inicial, cruce de modos) — ver PLAN-MODOS-QUIZ.md §5.
//  Primera tanda: ~30 países famosos. Ampliable por tandas.
// ============================================================
import type { Locale } from "./i18n";

type FactSet = Partial<Record<Locale, [string, string]>>;

export const COUNTRY_FACTS: Record<string, FactSet> = {
  CO: {
    es: ["Produce uno de los cafés más apreciados del mundo", "Cuna del realismo mágico de García Márquez"],
    en: ["Produces some of the world's most prized coffee", "Home of García Márquez's magical realism"],
    pt: ["Produz um dos cafés mais valorizados do mundo", "Terra do realismo mágico de García Márquez"],
    fr: ["Produit l'un des cafés les plus prisés au monde", "Terre du réalisme magique de García Márquez"],
  },
  AR: {
    es: ["Su carne y el asado son reconocidos mundialmente", "El tango nació en las calles de su capital"],
    en: ["Its beef and asado are world-renowned", "The tango was born in the streets of its capital"],
    pt: ["Sua carne e o churrasco são reconhecidos mundialmente", "O tango nasceu nas ruas de sua capital"],
    fr: ["Sa viande et l'asado sont mondialement réputés", "Le tango est né dans les rues de sa capitale"],
  },
  BR: {
    es: ["El fútbol es parte de su identidad", "El Carnaval de Río llena sus calles cada año"],
    en: ["Football is part of its identity", "Rio's Carnival fills its streets every year"],
    pt: ["O futebol é parte de sua identidade", "O Carnaval do Rio enche suas ruas todos os anos"],
    fr: ["Le football fait partie de son identité", "Le Carnaval de Rio anime ses rues chaque année"],
  },
  MX: {
    es: ["Los tacos y el chile son parte de su cocina", "Hogar de las pirámides mayas y aztecas"],
    en: ["Tacos and chili are part of its cuisine", "Home to the Maya and Aztec pyramids"],
    pt: ["Tacos e pimenta fazem parte de sua cozinha", "Lar das pirâmides maias e astecas"],
    fr: ["Les tacos et le piment font partie de sa cuisine", "Pays des pyramides mayas et aztèques"],
  },
  PE: {
    es: ["Los Andes cruzan su territorio", "Machu Picchu se esconde entre sus montañas"],
    en: ["The Andes run across its territory", "Machu Picchu hides among its mountains"],
    pt: ["Os Andes cruzam seu território", "Machu Picchu se esconde entre suas montanhas"],
    fr: ["Les Andes traversent son territoire", "Le Machu Picchu se cache dans ses montagnes"],
  },
  CL: {
    es: ["Un país largo y estrecho entre montañas y mar", "Alberga el desierto más árido del mundo, el Atacama"],
    en: ["A long, narrow country between mountains and sea", "Home to the world's driest desert, the Atacama"],
    pt: ["Um país longo e estreito entre montanhas e mar", "Abriga o deserto mais árido do mundo, o Atacama"],
    fr: ["Un pays long et étroit entre montagnes et mer", "Abrite le désert le plus aride du monde, l'Atacama"],
  },
  US: {
    es: ["Hollywood produce buena parte de sus películas", "La Estatua de la Libertad recibe en Nueva York"],
    en: ["Hollywood makes much of its cinema", "The Statue of Liberty welcomes in New York"],
    pt: ["Hollywood produz boa parte de seus filmes", "A Estátua da Liberdade recebe em Nova York"],
    fr: ["Hollywood produit une grande part de son cinéma", "La statue de la Liberté accueille à New York"],
  },
  CA: {
    es: ["Célebre por su jarabe de arce", "La hoja de arce ondea en su bandera"],
    en: ["Famous for its maple syrup", "The maple leaf flies on its flag"],
    pt: ["Célebre por seu xarope de bordo", "A folha de bordo tremula em sua bandeira"],
    fr: ["Célèbre pour son sirop d'érable", "La feuille d'érable flotte sur son drapeau"],
  },
  GB: {
    es: ["El té de la tarde es una tradición", "Londres, el Big Ben y los Beatles son suyos"],
    en: ["Afternoon tea is a tradition", "London, Big Ben and the Beatles are theirs"],
    pt: ["O chá da tarde é uma tradição", "Londres, o Big Ben e os Beatles são seus"],
    fr: ["Le thé de l'après-midi est une tradition", "Londres, Big Ben et les Beatles sont les siens"],
  },
  FR: {
    es: ["Su gastronomía y sus vinos son célebres", "La Torre Eiffel se alza en su capital"],
    en: ["Its cuisine and wines are celebrated", "The Eiffel Tower rises in its capital"],
    pt: ["Sua gastronomia e seus vinhos são célebres", "A Torre Eiffel se ergue em sua capital"],
    fr: ["Sa gastronomie et ses vins sont célèbres", "La tour Eiffel se dresse dans sa capitale"],
  },
  IT: {
    es: ["La pizza y la pasta nacieron aquí", "El Coliseo romano está en su capital"],
    en: ["Pizza and pasta were born here", "The Roman Colosseum sits in its capital"],
    pt: ["A pizza e a massa nasceram aqui", "O Coliseu romano está em sua capital"],
    fr: ["La pizza et les pâtes y sont nées", "Le Colisée romain se trouve dans sa capitale"],
  },
  ES: {
    es: ["El flamenco y la siesta son suyos", "La paella es uno de sus platos típicos"],
    en: ["Flamenco and the siesta are theirs", "Paella is one of its signature dishes"],
    pt: ["O flamenco e a sesta são seus", "A paella é um de seus pratos típicos"],
    fr: ["Le flamenco et la sieste sont les siens", "La paella est l'un de ses plats emblématiques"],
  },
  DE: {
    es: ["Célebre por su cerveza y el Oktoberfest", "Un muro dividió su capital durante la Guerra Fría"],
    en: ["Famous for its beer and Oktoberfest", "A wall divided its capital during the Cold War"],
    pt: ["Célebre por sua cerveja e a Oktoberfest", "Um muro dividiu sua capital durante a Guerra Fria"],
    fr: ["Célèbre pour sa bière et l'Oktoberfest", "Un mur a divisé sa capitale pendant la guerre froide"],
  },
  PT: {
    es: ["Célebre por el fado y sus azulejos", "Grandes navegantes zarparon de sus costas"],
    en: ["Famous for fado and its tiles", "Great navigators set sail from its shores"],
    pt: ["Célebre pelo fado e seus azulejos", "Grandes navegadores partiram de suas costas"],
    fr: ["Célèbre pour le fado et ses azulejos", "De grands navigateurs sont partis de ses côtes"],
  },
  GR: {
    es: ["Cuna de la filosofía y los Juegos Olímpicos", "El Partenón corona Atenas, su capital"],
    en: ["Cradle of philosophy and the Olympic Games", "The Parthenon crowns Athens, its capital"],
    pt: ["Berço da filosofia e dos Jogos Olímpicos", "O Partenon coroa Atenas, sua capital"],
    fr: ["Berceau de la philosophie et des Jeux olympiques", "Le Parthénon couronne Athènes, sa capitale"],
  },
  NL: {
    es: ["Famoso por sus tulipanes y molinos de viento", "Canales y bicicletas definen Ámsterdam"],
    en: ["Famous for its tulips and windmills", "Canals and bicycles define Amsterdam"],
    pt: ["Famoso por suas tulipas e moinhos de vento", "Canais e bicicletas definem Amsterdã"],
    fr: ["Célèbre pour ses tulipes et ses moulins à vent", "Canaux et vélos définissent Amsterdam"],
  },
  CH: {
    es: ["Famoso por su chocolate y sus relojes", "Los Alpes cubren gran parte del país"],
    en: ["Famous for its chocolate and watches", "The Alps cover much of the country"],
    pt: ["Famoso por seu chocolate e seus relógios", "Os Alpes cobrem grande parte do país"],
    fr: ["Célèbre pour son chocolat et ses montres", "Les Alpes couvrent une grande partie du pays"],
  },
  NO: {
    es: ["Tierra de fiordos y auroras boreales", "Los vikingos zarparon de sus costas"],
    en: ["Land of fjords and northern lights", "The Vikings sailed from its shores"],
    pt: ["Terra de fiordes e auroras boreais", "Os vikings partiram de suas costas"],
    fr: ["Terre de fjords et d'aurores boréales", "Les Vikings ont pris la mer depuis ses côtes"],
  },
  RU: {
    es: ["Es el país más extenso del mundo", "La Plaza Roja está en Moscú, su capital"],
    en: ["It is the largest country in the world", "Red Square is in Moscow, its capital"],
    pt: ["É o maior país do mundo", "A Praça Vermelha fica em Moscou, sua capital"],
    fr: ["C'est le plus grand pays du monde", "La place Rouge est à Moscou, sa capitale"],
  },
  EG: {
    es: ["El río Nilo lo atraviesa de sur a norte", "Las pirámides de Guiza están en su territorio"],
    en: ["The Nile flows through it south to north", "The pyramids of Giza stand on its soil"],
    pt: ["O rio Nilo o atravessa de sul a norte", "As pirâmides de Gizé estão em seu território"],
    fr: ["Le Nil le traverse du sud au nord", "Les pyramides de Gizeh sont sur son territoire"],
  },
  ZA: {
    es: ["Famoso por sus safaris de fauna salvaje", "Tiene tres capitales y a Mandela como héroe"],
    en: ["Famous for its wildlife safaris", "It has three capitals and Mandela as a hero"],
    pt: ["Famoso por seus safáris de vida selvagem", "Tem três capitais e Mandela como herói"],
    fr: ["Célèbre pour ses safaris animaliers", "Il a trois capitales et Mandela pour héros"],
  },
  NG: {
    es: ["Es el país más poblado de África", "Nollywood es su enorme industria de cine"],
    en: ["It is Africa's most populous country", "Nollywood is its huge film industry"],
    pt: ["É o país mais populoso da África", "Nollywood é sua enorme indústria de cinema"],
    fr: ["C'est le pays le plus peuplé d'Afrique", "Nollywood est son immense industrie du cinéma"],
  },
  KE: {
    es: ["Famoso por sus safaris y corredores de fondo", "El safari del Masái Mara está en sus llanuras"],
    en: ["Famous for its safaris and distance runners", "The Maasai Mara safari lies on its plains"],
    pt: ["Famoso por seus safáris e corredores de fundo", "O safári do Masai Mara está em suas planícies"],
    fr: ["Célèbre pour ses safaris et ses coureurs de fond", "Le safari du Masai Mara est dans ses plaines"],
  },
  MA: {
    es: ["Sus zocos y el té de menta son inconfundibles", "Marrakech y el Sáhara lo caracterizan"],
    en: ["Its souks and mint tea are unmistakable", "Marrakech and the Sahara define it"],
    pt: ["Seus souks e o chá de menta são inconfundíveis", "Marrakech e o Saara o caracterizam"],
    fr: ["Ses souks et le thé à la menthe sont incomparables", "Marrakech et le Sahara le caractérisent"],
  },
  JP: {
    es: ["El sushi y el anime nacieron aquí", "El Monte Fuji es su símbolo más conocido"],
    en: ["Sushi and anime were born here", "Mount Fuji is its best-known symbol"],
    pt: ["O sushi e o anime nasceram aqui", "O Monte Fuji é seu símbolo mais conhecido"],
    fr: ["Les sushis et l'anime y sont nés", "Le mont Fuji est son symbole le plus connu"],
  },
  CN: {
    es: ["El té y la seda nacieron en su historia", "La Gran Muralla se extiende por su territorio"],
    en: ["Tea and silk were born in its history", "The Great Wall stretches across its land"],
    pt: ["O chá e a seda nasceram em sua história", "A Grande Muralha se estende por seu território"],
    fr: ["Le thé et la soie sont nés de son histoire", "La Grande Muraille s'étend sur son territoire"],
  },
  IN: {
    es: ["Las especias y el curry son parte de su cocina", "El Taj Mahal es su monumento más célebre"],
    en: ["Spices and curry are part of its cuisine", "The Taj Mahal is its most famous landmark"],
    pt: ["As especiarias e o curry fazem parte de sua cozinha", "O Taj Mahal é seu monumento mais célebre"],
    fr: ["Les épices et le curry font partie de sa cuisine", "Le Taj Mahal est son monument le plus célèbre"],
  },
  TH: {
    es: ["Famoso por sus templos y su cocina picante", "Bangkok es su vibrante capital"],
    en: ["Famous for its temples and spicy food", "Bangkok is its vibrant capital"],
    pt: ["Famoso por seus templos e sua comida picante", "Bangkok é sua vibrante capital"],
    fr: ["Célèbre pour ses temples et sa cuisine épicée", "Bangkok est sa capitale trépidante"],
  },
  KR: {
    es: ["El K-pop nació aquí", "Comparte península con su vecino del norte"],
    en: ["K-pop was born here", "It shares a peninsula with its northern neighbor"],
    pt: ["O K-pop nasceu aqui", "Divide a península com seu vizinho do norte"],
    fr: ["La K-pop y est née", "Il partage une péninsule avec son voisin du nord"],
  },
  ID: {
    es: ["Un archipiélago de miles de islas", "Bali es su isla más famosa"],
    en: ["An archipelago of thousands of islands", "Bali is its most famous island"],
    pt: ["Um arquipélago de milhares de ilhas", "Bali é sua ilha mais famosa"],
    fr: ["Un archipel de milliers d'îles", "Bali est son île la plus célèbre"],
  },
  TR: {
    es: ["Es un puente entre Europa y Asia", "Estambul fue la antigua Constantinopla"],
    en: ["It is a bridge between Europe and Asia", "Istanbul was once Constantinople"],
    pt: ["É uma ponte entre a Europa e a Ásia", "Istambul foi a antiga Constantinopla"],
    fr: ["C'est un pont entre l'Europe et l'Asie", "Istanbul était l'ancienne Constantinople"],
  },
  AU: {
    es: ["Los canguros y koalas son suyos", "La Gran Barrera de Coral bordea sus costas"],
    en: ["Kangaroos and koalas are theirs", "The Great Barrier Reef lines its coast"],
    pt: ["Os cangurus e coalas são seus", "A Grande Barreira de Coral contorna sua costa"],
    fr: ["Les kangourous et les koalas sont les siens", "La Grande Barrière de corail borde ses côtes"],
  },
  IE: {
    es: ["La isla esmeralda, célebre por San Patricio", "El trébol y el color verde la representan"],
    en: ["The Emerald Isle, famous for St. Patrick", "The shamrock and the color green represent it"],
    pt: ["A ilha esmeralda, célebre por São Patrício", "O trevo e a cor verde a representam"],
    fr: ["L'île d'Émeraude, célèbre pour la Saint-Patrick", "Le trèfle et la couleur verte la représentent"],
  },
  AT: {
    es: ["La música de Mozart nació aquí", "Viena y los Alpes son suyos"],
    en: ["Mozart's music was born here", "Vienna and the Alps are theirs"],
    pt: ["A música de Mozart nasceu aqui", "Viena e os Alpes são seus"],
    fr: ["La musique de Mozart y est née", "Vienne et les Alpes sont les siens"],
  },
  BE: {
    es: ["Famoso por su chocolate, gofres y cerveza", "Alberga las instituciones de la Unión Europea"],
    en: ["Famous for its chocolate, waffles and beer", "Home to the European Union's institutions"],
    pt: ["Famoso por seu chocolate, waffles e cerveja", "Sede das instituições da União Europeia"],
    fr: ["Célèbre pour son chocolat, ses gaufres et sa bière", "Siège des institutions de l'Union européenne"],
  },
  CU: {
    es: ["Famoso por sus puros y su ron", "La Habana y sus autos clásicos lo definen"],
    en: ["Famous for its cigars and rum", "Havana and its classic cars define it"],
    pt: ["Famoso por seus charutos e seu rum", "Havana e seus carros clássicos o definem"],
    fr: ["Célèbre pour ses cigares et son rhum", "La Havane et ses voitures classiques le définissent"],
  },
};

// Pistas culturales de un país en el idioma dado (fallback a inglés; vacío si
// no hay entrada — el modo usa entonces solo las pistas estructurales).
export function factsFor(code: string, locale: Locale): string[] {
  const f = COUNTRY_FACTS[code.toUpperCase()];
  if (!f) return [];
  return f[locale] ?? f.en ?? [];
}
