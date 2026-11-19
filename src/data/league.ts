import type { Archetype, LeaguePlayer, LeagueState, LeagueTag } from '../engine/types'

// elencos NBA ~2026/27 aproximados (top 9 por minutos 2026/27 ou 2025/26, o maior; lesionados contam como saudáveis; Basketball Reference 2026-11-19), curadoria própria.
// ids estáveis, sem fotos/stats reais além de nome/posição/idade/ovr aproximados.
function lp(
  id: string, name: string, pos: Archetype, age: number, ovr: number,
  tags: LeagueTag[], teamId: string, rookie = false,
): LeaguePlayer {
  return { id: 'lg-' + id, name, pos, age, ovr, tags, teamId, rookie, prevPpg: null }
}

export const LEAGUE_PLAYERS: LeaguePlayer[] = [
  // ---- ATL ----
  lp('jalen-johnson', 'Jalen Johnson', 'SF', 25, 86, ['rebounder', 'playmaker'], 'atl'),
  lp('nickeil-alexander-walker', 'Nickeil Alexander-Walker', 'SG', 28, 76, ['defender'], 'atl'),
  lp('dyson-daniels', 'Dyson Daniels', 'SG', 24, 81, ['defender'], 'atl'),
  lp('onyeka-okongwu', 'Onyeka Okongwu', 'C', 26, 79, ['rebounder', 'defender'], 'atl'),
  lp('cj-mccollum', 'CJ McCollum', 'SG', 35, 74, ['shooter'], 'atl'),
  lp('luguentz-dort', 'Luguentz Dort', 'SG', 28, 74, ['defender'], 'atl'),
  lp('aaron-wiggins', 'Aaron Wiggins', 'SG', 28, 72, [], 'atl'),
  lp('jocklandale', 'Jock Landale', 'C', 31, 68, ['rebounder'], 'atl'),
  lp('kingston-flemings', 'Kingston Flemings', 'PG', 20, 71, ['playmaker'], 'atl', true),

  // ---- BOS ----
  lp('derrick-white', 'Derrick White', 'PG', 32, 85, ['shooter', 'defender'], 'bos'),
  lp('jayson-tatum', 'Jayson Tatum', 'SF', 29, 91, ['shooter'], 'bos'),
  lp('payton-pritchard', 'Payton Pritchard', 'PG', 29, 79, ['shooter'], 'bos'),
  lp('paul-george', 'Paul George', 'SF', 37, 80, ['shooter', 'defender'], 'bos'),
  lp('neemias-queta', 'Neemias Queta', 'C', 27, 77, ['rebounder'], 'bos'),
  lp('sam-hauser', 'Sam Hauser', 'SF', 29, 75, ['shooter'], 'bos'),
  lp('mitchell-robinson', 'Mitchell Robinson', 'C', 29, 76, ['rebounder'], 'bos'),
  lp('baylor-scheierman', 'Baylor Scheierman', 'SG', 26, 72, ['shooter'], 'bos'),
  lp('mike-conley', 'Mike Conley', 'PG', 39, 72, ['playmaker'], 'bos'),

  // ---- BKN ----
  lp('julius-randle', 'Julius Randle', 'PF', 32, 79, [], 'bkn'),
  lp('michael-porter-jr', 'Michael Porter Jr.', 'SF', 29, 80, ['shooter'], 'bkn'),
  lp('noah-clowney', 'Noah Clowney', 'PF', 22, 69, [], 'bkn'),
  lp('egor-demin', 'Egor Demin', 'PG', 21, 67, ['playmaker'], 'bkn'),
  lp('terancemann', 'Terance Mann', 'SG', 30, 65, ['defender'], 'bkn'),
  lp('dayron-sharpe', "Day'Ron Sharpe", 'C', 25, 73, ['rebounder'], 'bkn'),
  lp('mikel-brown-jr', 'Mikel Brown Jr.', 'PG', 21, 71, ['playmaker'], 'bkn', true),
  lp('dannywolf', 'Danny Wolf', 'C', 23, 66, [], 'bkn'),
  lp('nolan-traore', 'Nolan Traore', 'PG', 21, 63, [], 'bkn'),

  // ---- CHA ----
  lp('kon-knueppel', 'Kon Knueppel', 'SG', 21, 73, ['shooter'], 'cha'),
  lp('naz-reid', 'Naz Reid', 'C', 27, 75, ['rebounder'], 'cha'),
  lp('brandon-miller', 'Brandon Miller', 'SF', 24, 80, ['shooter'], 'cha'),
  lp('dennis-schroder', 'Dennis Schroder', 'PG', 33, 69, [], 'cha'),
  lp('moussa-diabate', 'Moussa Diabate', 'C', 25, 66, [], 'cha'),
  lp('grayson-allen', 'Grayson Allen', 'SG', 31, 77, ['shooter'], 'cha'),
  lp('royce-oneale', "Royce O'Neale", 'PF', 34, 71, ['defender'], 'cha'),
  lp('sionjames', 'Sion James', 'SG', 24, 64, [], 'cha'),
  lp('coby-white', 'Coby White', 'PG', 27, 77, ['shooter'], 'cha'),

  // ---- CHI ----
  lp('josh-giddey', 'Josh Giddey', 'PG', 24, 82, ['playmaker', 'rebounder'], 'chi'),
  lp('caleb-wilson', 'Caleb Wilson', 'PF', 20, 72, ['rebounder'], 'chi', true),
  lp('norman-powell', 'Norman Powell', 'SG', 34, 77, ['shooter'], 'chi'),
  lp('matas-buzelis', 'Matas Buzelis', 'PF', 22, 73, [], 'chi'),
  lp('nic-claxton', 'Nic Claxton', 'C', 28, 77, ['defender', 'rebounder'], 'chi'),
  lp('trejones', 'Tre Jones', 'PG', 27, 71, ['playmaker'], 'chi'),
  lp('isaac-okoro', 'Isaac Okoro', 'SG', 26, 67, ['defender'], 'chi'),
  lp('jalensmith', 'Jalen Smith', 'C', 27, 72, ['rebounder'], 'chi'),
  lp('patrick-williams', 'Patrick Williams', 'PF', 25, 68, [], 'chi'),

  // ---- CLE ----
  lp('james-harden', 'James Harden', 'PG', 37, 85, ['playmaker'], 'cle'),
  lp('donovan-mitchell', 'Donovan Mitchell', 'SG', 30, 90, ['shooter'], 'cle'),
  lp('evan-mobley', 'Evan Mobley', 'PF', 26, 88, ['defender', 'rebounder'], 'cle'),
  lp('peyton-watson', 'Peyton Watson', 'SF', 24, 73, ['defender'], 'cle'),
  lp('jarrett-allen', 'Jarrett Allen', 'C', 29, 81, ['rebounder'], 'cle'),
  lp('jaylontyson', 'Jaylon Tyson', 'SF', 24, 69, ['shooter'], 'cle'),
  lp('sam-merrill', 'Sam Merrill', 'SG', 31, 68, ['shooter'], 'cle'),
  lp('meleekthomas', 'Meleek Thomas', 'SG', 20, 71, ['shooter'], 'cle', true),
  lp('tyreseproctor', 'Tyrese Proctor', 'PG', 23, 68, [], 'cle'),

  // ---- DAL ----
  lp('cooper-flagg', 'Cooper Flagg', 'SF', 20, 82, ['defender'], 'dal'),
  lp('pj-washington', 'P.J. Washington', 'PF', 28, 73, [], 'dal'),
  lp('kyrie-irving-lg', 'Kyrie Irving', 'PG', 35, 86, ['shooter'], 'dal'),
  lp('naji-marshall', 'Naji Marshall', 'SF', 29, 70, [], 'dal'),
  lp('max-christie', 'Max Christie', 'SG', 24, 69, [], 'dal'),
  lp('santi-aldama', 'Santi Aldama', 'PF', 26, 74, [], 'dal'),
  lp('zaccharie-risacher', 'Zaccharie Risacher', 'SF', 22, 72, ['shooter'], 'dal'),
  lp('daniel-gafford', 'Daniel Gafford', 'C', 28, 76, ['rebounder'], 'dal'),
  lp('calebmartin', 'Caleb Martin', 'SG', 31, 67, ['defender'], 'dal'),

  // ---- DEN ----
  lp('jokic', 'Nikola Jokic', 'C', 32, 97, ['playmaker', 'rebounder'], 'den'),
  lp('jamal-murray', 'Jamal Murray', 'PG', 30, 88, ['shooter'], 'den'),
  lp('christian-braun', 'Christian Braun', 'SG', 26, 75, [], 'den'),
  lp('demar-derozan', 'DeMar DeRozan', 'SF', 37, 75, [], 'den'),
  lp('cam-johnson', 'Cam Johnson', 'SF', 31, 76, ['shooter'], 'den'),
  lp('aaron-gordon', 'Aaron Gordon', 'PF', 31, 79, ['defender'], 'den'),
  lp('spencerjones', 'Spencer Jones', 'SF', 26, 65, ['shooter'], 'den'),
  lp('marvin-bagley-iii', 'Marvin Bagley III', 'PF', 28, 71, ['rebounder'], 'den'),
  lp('trevonbrazile', 'Trevon Brazile', 'PF', 24, 66, [], 'den'),

  // ---- DET ----
  lp('cade-cunningham', 'Cade Cunningham', 'PG', 25, 90, ['playmaker'], 'det'),
  lp('duncan-robinson', 'Duncan Robinson', 'SG', 33, 74, ['shooter'], 'det'),
  lp('danissjenkins', 'Daniss Jenkins', 'PG', 25, 70, ['shooter'], 'det'),
  lp('ausar-thompson', 'Ausar Thompson', 'SF', 24, 81, ['defender'], 'det'),
  lp('jalen-duren', 'Jalen Duren', 'C', 23, 84, ['rebounder'], 'det'),
  lp('john-collins', 'John Collins', 'PF', 29, 73, [], 'det'),
  lp('kevin-huerter', 'Kevin Huerter', 'SG', 28, 72, ['shooter'], 'det'),
  lp('paulreed', 'Paul Reed', 'C', 28, 71, ['rebounder'], 'det'),
  lp('isaiah-joe', 'Isaiah Joe', 'SG', 27, 73, ['shooter'], 'det'),

  // ---- GSW ----
  lp('brandin-podziemski', 'Brandin Podziemski', 'SG', 24, 75, [], 'gsw'),
  lp('yaxel-lendeborg', 'Yaxel Lendeborg', 'PF', 24, 72, ['rebounder'], 'gsw', true),
  lp('jimmy-butler', 'Jimmy Butler', 'SF', 37, 86, ['defender'], 'gsw'),
  lp('curry', 'Stephen Curry', 'PG', 39, 91, ['shooter'], 'gsw'),
  lp('draymond-green', 'Draymond Green', 'PF', 37, 75, ['defender', 'playmaker'], 'gsw'),
  lp('moses-moody', 'Moses Moody', 'SG', 25, 72, ['shooter'], 'gsw'),
  lp('kristaps-porzingis', 'Kristaps Porzingis', 'C', 31, 81, ['shooter'], 'gsw'),
  lp('de-anthony-melton', "De'Anthony Melton", 'SG', 29, 67, ['defender'], 'gsw'),
  lp('brandonwilliams', 'Brandon Williams', 'PG', 27, 67, [], 'gsw'),

  // ---- HOU ----
  lp('amen-thompson', 'Amen Thompson', 'SF', 24, 84, ['defender'], 'hou'),
  lp('kevin-durant', 'Kevin Durant', 'PF', 38, 89, ['shooter'], 'hou'),
  lp('jabari-smith-jr', 'Jabari Smith Jr.', 'PF', 24, 76, ['defender'], 'hou'),
  lp('alperen-sengun', 'Alperen Sengun', 'C', 24, 88, ['playmaker', 'rebounder'], 'hou'),
  lp('fred-vanvleet', 'Fred VanVleet', 'PG', 33, 76, ['shooter'], 'hou'),
  lp('marcus-smart', 'Marcus Smart', 'PG', 33, 71, ['defender'], 'hou'),
  lp('reed-sheppard', 'Reed Sheppard', 'PG', 23, 73, ['shooter'], 'hou'),
  lp('tari-eason', 'Tari Eason', 'PF', 26, 73, [], 'hou'),
  lp('steven-adams', 'Steven Adams', 'C', 33, 70, ['rebounder'], 'hou'),

  // ---- IND ----
  lp('andrew-nembhard', 'Andrew Nembhard', 'PG', 27, 73, [], 'ind'),
  lp('pascal-siakam', 'Pascal Siakam', 'PF', 33, 81, [], 'ind'),
  lp('tyrese-haliburton', 'Tyrese Haliburton', 'PG', 27, 88, ['playmaker', 'shooter'], 'ind'),
  lp('kelly-oubre-jr', 'Kelly Oubre Jr.', 'SF', 31, 71, [], 'ind'),
  lp('ivica-zubac', 'Ivica Zubac', 'C', 30, 77, ['rebounder'], 'ind'),
  lp('aaron-nesmith', 'Aaron Nesmith', 'SF', 27, 72, ['shooter', 'defender'], 'ind'),
  lp('jarace-walker', 'Jarace Walker', 'PF', 23, 66, [], 'ind'),
  lp('quentonjackson', 'Quenton Jackson', 'PG', 28, 67, [], 'ind'),
  lp('bensheppard', 'Ben Sheppard', 'SG', 25, 65, ['shooter'], 'ind'),

  // ---- LAC ----
  lp('brandon-ingram', 'Brandon Ingram', 'SF', 29, 80, ['shooter'], 'lac'),
  lp('darius-garland', 'Darius Garland', 'PG', 27, 82, ['shooter', 'playmaker'], 'lac'),
  lp('rui-hachimura', 'Rui Hachimura', 'PF', 29, 72, [], 'lac'),
  lp('derrick-jones-jr', 'Derrick Jones Jr.', 'SF', 30, 73, ['defender'], 'lac'),
  lp('kris-dunn', 'Kris Dunn', 'PG', 33, 71, ['defender'], 'lac'),
  lp('brook-lopez', 'Brook Lopez', 'C', 39, 69, [], 'lac'),
  lp('keaton-wagler', 'Keaton Wagler', 'SG', 20, 72, ['shooter'], 'lac', true),
  lp('kobesanders', 'Kobe Sanders', 'SG', 25, 65, [], 'lac'),
  lp('max-strus', 'Max Strus', 'SG', 31, 73, ['shooter'], 'lac'),

  // ---- LAL ----
  lp('luka-doncic', 'Luka Doncic', 'PG', 28, 96, ['playmaker', 'shooter'], 'lal'),
  lp('austin-reaves', 'Austin Reaves', 'SG', 29, 82, ['shooter', 'playmaker'], 'lal'),
  lp('walker-kessler', 'Walker Kessler', 'C', 25, 78, ['defender', 'rebounder'], 'lal'),
  lp('quentin-grimes', 'Quentin Grimes', 'SG', 27, 72, [], 'lal'),
  lp('jakelaravia', 'Jake LaRavia', 'PF', 25, 69, [], 'lal'),
  lp('matisse-thybulle', 'Matisse Thybulle', 'SF', 30, 71, ['defender'], 'lal'),
  lp('collin-sexton', 'Collin Sexton', 'SG', 28, 73, [], 'lal'),
  lp('sandro-mamukelashvili', 'Sandro Mamukelashvili', 'PF', 28, 73, [], 'lal'),
  lp('ziaire-williams', 'Ziaire Williams', 'SF', 25, 71, [], 'lal'),

  // ---- MEM ----
  lp('cameron-boozer', 'Cameron Boozer', 'PF', 19, 75, ['rebounder'], 'mem', true),
  lp('ty-jerome', 'Ty Jerome', 'PG', 29, 77, [], 'mem'),
  lp('jerami-grant', 'Jerami Grant', 'PF', 33, 74, [], 'mem'),
  lp('cedric-coward', 'Cedric Coward', 'SG', 23, 73, [], 'mem'),
  lp('jaylen-wells', 'Jaylen Wells', 'SG', 23, 70, [], 'mem'),
  lp('camspencer', 'Cam Spencer', 'SG', 27, 69, ['shooter'], 'mem'),
  lp('kris-murray', 'Kris Murray', 'SF', 26, 63, [], 'mem'),
  lp('isaiah-stewart', 'Isaiah Stewart', 'C', 26, 71, ['rebounder'], 'mem'),
  lp('javonsmall', 'Javon Small', 'PG', 24, 67, [], 'mem'),

  // ---- MIA ----
  lp('davion-mitchell', 'Davion Mitchell', 'PG', 28, 71, ['defender'], 'mia'),
  lp('bam-adebayo', 'Bam Adebayo', 'C', 29, 86, ['defender', 'rebounder'], 'mia'),
  lp('giannis', 'Giannis Antetokounmpo', 'PF', 32, 96, ['defender', 'rebounder'], 'mia'),
  lp('andrew-wiggins', 'Andrew Wiggins', 'SF', 32, 76, ['defender'], 'mia'),
  lp('pelle-larsson', 'Pelle Larsson', 'SG', 26, 65, [], 'mia'),
  lp('tim-hardaway-jr', 'Tim Hardaway Jr.', 'SG', 35, 69, ['shooter'], 'mia'),
  lp('bobby-portis', 'Bobby Portis', 'PF', 32, 73, ['rebounder'], 'mia'),
  lp('klay-thompson', 'Klay Thompson', 'SG', 37, 72, ['shooter'], 'mia'),
  lp('ryanconwell', 'Ryan Conwell', 'SG', 23, 66, ['shooter'], 'mia', true),

  // ---- MIL ----
  lp('ryan-rollins', 'Ryan Rollins', 'PG', 24, 72, [], 'mil'),
  lp('tyler-herro', 'Tyler Herro', 'SG', 27, 81, ['shooter'], 'mil'),
  lp('aj-green', 'A.J. Green', 'SG', 27, 67, ['shooter'], 'mil'),
  lp('jaime-jaquez-jr', 'Jaime Jaquez Jr.', 'SF', 26, 72, [], 'mil'),
  lp('kyle-kuzma', 'Kyle Kuzma', 'SF', 31, 71, [], 'mil'),
  lp('myles-turner', 'Myles Turner', 'C', 31, 77, ['defender', 'rebounder'], 'mil'),
  lp('brayden-burries', 'Brayden Burries', 'SG', 21, 70, ['defender'], 'mil', true),
  lp('kel-el-ware', "Kel'el Ware", 'C', 23, 74, ['rebounder'], 'mil'),
  lp('gary-trent-jr', 'Gary Trent Jr.', 'SG', 28, 68, ['shooter'], 'mil'),

  // ---- MIN ----
  lp('anthony-edwards', 'Anthony Edwards', 'SG', 25, 91, ['shooter', 'defender'], 'min'),
  lp('jaden-mcdaniels', 'Jaden McDaniels', 'SF', 26, 78, ['defender'], 'min'),
  lp('ayo-dosunmu', 'Ayo Dosunmu', 'SG', 27, 76, [], 'min'),
  lp('rudy-gobert', 'Rudy Gobert', 'C', 35, 80, ['defender', 'rebounder'], 'min'),
  lp('jonathan-kuminga', 'Jonathan Kuminga', 'PF', 24, 77, [], 'min'),
  lp('donte-divincenzo', 'Donte DiVincenzo', 'SG', 30, 75, ['shooter'], 'min'),
  lp('lamelo-ball', 'LaMelo Ball', 'PG', 25, 87, ['shooter', 'playmaker'], 'min'),
  lp('codywilliams', 'Cody Williams', 'SG', 22, 63, [], 'min'),
  lp('terrence-shannon-jr', 'Terrence Shannon Jr.', 'SG', 26, 69, [], 'min'),

  // ---- NOP ----
  lp('trey-murphy-iii', 'Trey Murphy III', 'SF', 27, 80, ['shooter'], 'nop'),
  lp('zion-williamson', 'Zion Williamson', 'PF', 26, 85, [], 'nop'),
  lp('dejounte-murray', 'Dejounte Murray', 'PG', 30, 75, ['defender'], 'nop'),
  lp('saddiq-bey', 'Saddiq Bey', 'SF', 28, 69, [], 'nop'),
  lp('bennedict-mathurin', 'Bennedict Mathurin', 'SG', 25, 75, ['shooter'], 'nop'),
  lp('jeremiah-fears', 'Jeremiah Fears', 'PG', 20, 68, ['playmaker'], 'nop'),
  lp('herbert-jones', 'Herbert Jones', 'SF', 28, 73, ['defender'], 'nop'),
  lp('derik-queen', 'Derik Queen', 'C', 22, 72, ['rebounder'], 'nop'),
  lp('jordan-poole', 'Jordan Poole', 'SG', 28, 72, ['shooter'], 'nop'),

  // ---- NYK ----
  lp('jalen-brunson', 'Jalen Brunson', 'PG', 30, 90, ['shooter', 'playmaker'], 'nyk'),
  lp('og-anunoby', 'OG Anunoby', 'SF', 29, 80, ['defender'], 'nyk'),
  lp('karl-anthony-towns', 'Karl-Anthony Towns', 'PF', 31, 87, ['shooter', 'rebounder'], 'nyk'),
  lp('mikal-bridges', 'Mikal Bridges', 'SF', 30, 80, ['defender'], 'nyk'),
  lp('josh-hart', 'Josh Hart', 'SG', 32, 77, ['rebounder'], 'nyk'),
  lp('miles-mcbride', 'Miles McBride', 'PG', 26, 73, ['defender'], 'nyk'),
  lp('landryshamet', 'Landry Shamet', 'SG', 30, 67, ['shooter'], 'nyk'),
  lp('jose-alvarado', 'Jose Alvarado', 'PG', 29, 68, ['defender'], 'nyk'),
  lp('andre-drummond', 'Andre Drummond', 'C', 33, 69, ['rebounder'], 'nyk'),

  // ---- OKC ----
  lp('sga', 'Shai Gilgeous-Alexander', 'PG', 28, 97, ['shooter'], 'okc'),
  lp('jalen-williams', 'Jalen Williams', 'SF', 26, 85, ['defender', 'playmaker'], 'okc'),
  lp('chet-holmgren', 'Chet Holmgren', 'C', 25, 87, ['defender', 'rebounder'], 'okc'),
  lp('ajay-mitchell', 'Ajay Mitchell', 'PG', 25, 75, [], 'okc'),
  lp('jared-mccain', 'Jared McCain', 'SG', 23, 70, ['shooter'], 'okc'),
  lp('cason-wallace', 'Cason Wallace', 'PG', 23, 75, ['defender'], 'okc'),
  lp('niqueclifford', 'Nique Clifford', 'SG', 25, 65, ['defender'], 'okc'),
  lp('isaiah-hartenstein', 'Isaiah Hartenstein', 'C', 29, 81, ['rebounder'], 'okc'),
  lp('aday-mara', 'Aday Mara', 'C', 22, 70, ['rebounder'], 'okc', true),

  // ---- ORL ----
  lp('franz-wagner', 'Franz Wagner', 'SF', 25, 84, ['shooter'], 'orl'),
  lp('desmond-bane', 'Desmond Bane', 'SG', 29, 80, ['shooter'], 'orl'),
  lp('paolo-banchero', 'Paolo Banchero', 'PF', 24, 86, [], 'orl'),
  lp('anthony-black', 'Anthony Black', 'PG', 23, 71, [], 'orl'),
  lp('wendell-carter-jr', 'Wendell Carter Jr.', 'C', 28, 73, ['rebounder'], 'orl'),
  lp('tristan-da-silva', 'Tristan da Silva', 'SF', 26, 69, [], 'orl'),
  lp('jalen-suggs', 'Jalen Suggs', 'PG', 26, 78, ['defender'], 'orl'),
  lp('nikola-vucevic', 'Nikola Vucevic', 'C', 36, 78, ['rebounder'], 'orl'),
  lp('jaserichardson', 'Jase Richardson', 'SG', 21, 66, [], 'orl'),

  // ---- PHI ----
  lp('tyrese-maxey', 'Tyrese Maxey', 'PG', 26, 89, ['shooter'], 'phi'),
  lp('vj-edgecombe', 'VJ Edgecombe', 'SG', 21, 75, ['defender'], 'phi'),
  lp('jaylen-brown', 'Jaylen Brown', 'SG', 30, 88, ['defender'], 'phi'),
  lp('lebron-james-lg', 'LeBron James', 'SF', 42, 87, ['playmaker'], 'phi'),
  lp('joel-embiid', 'Joel Embiid', 'C', 33, 86, ['rebounder'], 'phi'),
  lp('dean-wade', 'Dean Wade', 'PF', 30, 67, [], 'phi'),
  lp('anfernee-simons', 'Anfernee Simons', 'SG', 28, 76, ['shooter'], 'phi'),
  lp('dominickbarlow', 'Dominick Barlow', 'C', 24, 66, ['rebounder'], 'phi'),
  lp('kentavious-caldwell-pope', 'Kentavious Caldwell-Pope', 'SG', 34, 67, ['defender'], 'phi'),

  // ---- PHX ----
  lp('devin-booker', 'Devin Booker', 'SG', 30, 88, ['shooter'], 'phx'),
  lp('miles-bridges', 'Miles Bridges', 'PF', 29, 79, [], 'phx'),
  lp('dillon-brooks', 'Dillon Brooks', 'SF', 31, 70, ['defender'], 'phx'),
  lp('collin-gillespie', 'Collin Gillespie', 'PG', 28, 67, [], 'phx'),
  lp('jalen-green', 'Jalen Green', 'SG', 25, 76, ['shooter'], 'phx'),
  lp('mark-williams', 'Mark Williams', 'C', 25, 76, ['rebounder'], 'phx'),
  lp('osoighodaro', 'Oso Ighodaro', 'C', 24, 67, ['rebounder'], 'phx'),
  lp('jordangoodwin', 'Jordan Goodwin', 'PG', 28, 67, ['defender'], 'phx'),
  lp('luke-kennard', 'Luke Kennard', 'SG', 31, 72, ['shooter'], 'phx'),

  // ---- POR ----
  lp('toumani-camara', 'Toumani Camara', 'PF', 27, 71, ['defender'], 'por'),
  lp('deni-avdija', 'Deni Avdija', 'SF', 26, 85, ['rebounder'], 'por'),
  lp('jrue-holiday', 'Jrue Holiday', 'PG', 37, 79, ['defender'], 'por'),
  lp('shaedon-sharpe', 'Shaedon Sharpe', 'SG', 24, 76, ['shooter'], 'por'),
  lp('damian-lillard', 'Damian Lillard', 'PG', 36, 81, ['shooter'], 'por'),
  lp('donovan-clingan', 'Donovan Clingan', 'C', 23, 80, ['rebounder', 'defender'], 'por'),
  lp('ja-morant', 'Ja Morant', 'PG', 27, 85, ['playmaker'], 'por'),
  lp('scoothenderson', 'Scoot Henderson', 'PG', 23, 68, ['playmaker'], 'por'),
  lp('sidycissoko', 'Sidy Cissoko', 'SF', 23, 63, ['defender'], 'por'),

  // ---- SAC ----
  lp('darius-acuff-jr', 'Darius Acuff Jr.', 'PG', 20, 72, ['playmaker'], 'sac'),
  lp('domantas-sabonis', 'Domantas Sabonis', 'C', 31, 83, ['rebounder', 'playmaker'], 'sac'),
  lp('zach-lavine', 'Zach LaVine', 'SG', 32, 77, ['shooter'], 'sac'),
  lp('de-andre-hunter', "De'Andre Hunter", 'SF', 29, 73, [], 'sac'),
  lp('keegan-murray', 'Keegan Murray', 'PF', 26, 72, ['shooter'], 'sac'),
  lp('maxime-raynaud', 'Maxime Raynaud', 'C', 24, 64, [], 'sac'),
  lp('daeqwonplowden', 'Daeqwon Plowden', 'SG', 28, 63, ['defender'], 'sac'),
  lp('preciousachiuwa', 'Precious Achiuwa', 'C', 27, 67, ['rebounder'], 'sac'),
  lp('malik-monk', 'Malik Monk', 'SG', 29, 73, ['shooter'], 'sac'),

  // ---- SAS ----
  lp('dylan-harper', 'Dylan Harper', 'PG', 21, 78, ['playmaker'], 'sas'),
  lp('de-aaron-fox', "De'Aaron Fox", 'PG', 29, 86, ['shooter'], 'sas'),
  lp('devin-vassell', 'Devin Vassell', 'SG', 26, 78, ['shooter'], 'sas'),
  lp('wemby', 'Victor Wembanyama', 'C', 23, 96, ['defender', 'rebounder'], 'sas'),
  lp('stephon-castle', 'Stephon Castle', 'SG', 22, 79, ['defender'], 'sas'),
  lp('tobias-harris', 'Tobias Harris', 'PF', 34, 75, [], 'sas'),
  lp('julian-champagnie', 'Julian Champagnie', 'SF', 26, 71, ['shooter'], 'sas'),
  lp('harrison-barnes', 'Harrison Barnes', 'SF', 35, 71, [], 'sas'),
  lp('keldon-johnson', 'Keldon Johnson', 'SF', 27, 73, [], 'sas'),

  // ---- TOR ----
  lp('rj-barrett', 'RJ Barrett', 'SG', 27, 77, ['shooter'], 'tor'),
  lp('scottie-barnes', 'Scottie Barnes', 'SF', 25, 87, ['defender', 'playmaker'], 'tor'),
  lp('kawhi-leonard', 'Kawhi Leonard', 'SF', 36, 88, ['defender'], 'tor'),
  lp('immanuel-quickley', 'Immanuel Quickley', 'PG', 28, 80, ['shooter'], 'tor'),
  lp('jakobe-walter', "Ja'Kobe Walter", 'SG', 22, 68, ['defender'], 'tor'),
  lp('jakob-poeltl', 'Jakob Poeltl', 'C', 31, 75, ['rebounder'], 'tor'),
  lp('jamal-shead', 'Jamal Shead', 'PG', 25, 65, [], 'tor'),
  lp('collin-murray-boyles', 'Collin Murray-Boyles', 'PF', 22, 73, ['defender'], 'tor'),
  lp('kyleanderson', 'Kyle Anderson', 'SF', 33, 69, [], 'tor'),

  // ---- UTA ----
  lp('lauri-markkanen', 'Lauri Markkanen', 'PF', 30, 84, ['shooter'], 'uta'),
  lp('keyonte-george', 'Keyonte George', 'PG', 23, 76, [], 'uta'),
  lp('darryn-peterson', 'Darryn Peterson', 'SG', 20, 75, ['shooter'], 'uta', true),
  lp('ace-bailey', 'Ace Bailey', 'SF', 20, 71, ['shooter'], 'uta'),
  lp('jaren-jackson-jr', 'Jaren Jackson Jr.', 'PF', 27, 83, ['defender'], 'uta'),
  lp('jusufnurkic', 'Jusuf Nurkic', 'C', 32, 71, ['rebounder'], 'uta'),
  lp('isaiah-collier', 'Isaiah Collier', 'PG', 22, 66, [], 'uta'),
  lp('jaxson-hayes', 'Jaxson Hayes', 'C', 27, 69, ['rebounder'], 'uta'),
  lp('brice-sensabaugh', 'Brice Sensabaugh', 'SF', 23, 63, [], 'uta'),

  // ---- WAS ----
  lp('trae-young', 'Trae Young', 'PG', 28, 85, ['shooter', 'playmaker'], 'was'),
  lp('anthony-davis', 'Anthony Davis', 'PF', 34, 86, ['defender', 'rebounder'], 'was'),
  lp('aj-dybantsa', 'AJ Dybantsa', 'SF', 20, 75, ['shooter'], 'was', true),
  lp('kyshawn-george', 'Kyshawn George', 'SF', 23, 70, [], 'was'),
  lp('bubcarrington', 'Bub Carrington', 'PG', 21, 63, [], 'was'),
  lp('deandre-ayton', 'Deandre Ayton', 'C', 28, 75, ['rebounder'], 'was'),
  lp('alex-sarr', 'Alex Sarr', 'C', 22, 76, ['defender'], 'was'),
  lp('bilal-coulibaly', 'Bilal Coulibaly', 'SF', 22, 72, ['defender'], 'was'),
  lp('tre-johnson', 'Tre Johnson', 'SG', 21, 69, ['shooter'], 'was'),
]

// pools de nomes fictícios para a classe de draft procedural (nunca jogadores reais)
export const FICTIONAL_FIRST: string[] = [
  'Jaylen', 'Marcus', 'Dario', 'Kenta', 'Andre', 'Malik', 'Theo', 'Rasheed',
  'Nikolai', 'Emeka', 'Bryson', 'Cassius', 'Idris', 'Milo', 'Denzel', 'Konrad',
  'Amir', 'Tyrell', 'Santiago', 'Reggie', 'Junpei', 'Xavier', 'Kwame', 'Dmitri',
  'Elias', 'Rashad', 'Miles', 'Vaughn', 'Osei', 'Julius', 'Cormac', 'Zaire',
]

export const FICTIONAL_LAST: string[] = [
  'Whitfield', 'Okafor', 'Petrov', 'Marsh', 'Silva', 'Boateng', 'Kowalski',
  'Delgado', 'Vance', 'Odom', 'Reyes', 'Sutter', 'Nakamura', 'Ibekwe', 'Roth',
  'Castellano', 'Adeyemi', 'Brannigan', 'Fontaine', 'Wexler', 'Obi', 'Pearson',
  'Sorensen', 'Dubois', 'Mensah', 'Callahan', 'Novak', 'Ferreira', 'Ashworth',
  'Kaminski', 'Beaumont', 'Tanaka',
]

export function initLeague(): LeagueState {
  return { players: LEAGUE_PLAYERS.map(p => ({ ...p, tags: [...p.tags] })), year: 1 }
}
