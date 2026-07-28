import type { Archetype, LeaguePlayer, LeagueState, LeagueTag } from '../engine/types'

// elencos NBA ~2025/26 aproximados (top 9 por time), curadoria própria.
// ids estáveis, sem fotos/stats reais além de nome/posição/idade/ovr aproximados.
function lp(
  id: string, name: string, pos: Archetype, age: number, ovr: number,
  tags: LeagueTag[], teamId: string, rookie = false,
): LeaguePlayer {
  return { id: 'lg-' + id, name, pos, age, ovr, tags, teamId, rookie, prevPpg: null }
}

export const LEAGUE_PLAYERS: LeaguePlayer[] = [
  // ---- ATL Hawks ----
  lp('trae-young', 'Trae Young', 'PG', 27, 88, ['shooter', 'playmaker'], 'atl'),
  lp('jalen-johnson', 'Jalen Johnson', 'SF', 24, 84, ['rebounder'], 'atl'),
  lp('dyson-daniels', 'Dyson Daniels', 'SG', 23, 82, ['defender'], 'atl'),
  lp('onyeka-okongwu', 'Onyeka Okongwu', 'C', 25, 81, ['rebounder', 'defender'], 'atl'),
  lp('zaccharie-risacher', 'Zaccharie Risacher', 'SF', 21, 76, ['shooter'], 'atl'),
  lp('nickeil-alexander-walker', 'Nickeil Alexander-Walker', 'SG', 27, 75, ['defender'], 'atl'),
  lp('kristaps-porzingis', 'Kristaps Porzingis', 'C', 30, 83, ['shooter'], 'atl'),
  lp('luke-kennard', 'Luke Kennard', 'SG', 30, 72, ['shooter'], 'atl'),
  lp('asa-newell', 'Asa Newell', 'PF', 20, 68, [], 'atl', true),

  // ---- BOS Celtics ----
  lp('jayson-tatum', 'Jayson Tatum', 'SF', 28, 93, ['shooter'], 'bos'),
  lp('jaylen-brown', 'Jaylen Brown', 'SG', 29, 89, ['defender'], 'bos'),
  lp('derrick-white', 'Derrick White', 'PG', 29, 84, ['shooter', 'defender'], 'bos'),
  lp('payton-pritchard', 'Payton Pritchard', 'PG', 28, 78, ['shooter'], 'bos'),
  lp('anfernee-simons', 'Anfernee Simons', 'SG', 27, 79, ['shooter'], 'bos'),
  lp('neemias-queta', 'Neemias Queta', 'C', 27, 74, ['rebounder'], 'bos'),
  lp('sam-hauser', 'Sam Hauser', 'SF', 28, 73, ['shooter'], 'bos'),
  lp('baylor-scheierman', 'Baylor Scheierman', 'SG', 23, 70, ['shooter'], 'bos'),
  lp('luka-garza', 'Luka Garza', 'C', 27, 66, [], 'bos'),

  // ---- BKN Nets ----
  lp('cam-thomas', 'Cam Thomas', 'SG', 24, 79, ['shooter'], 'bkn'),
  lp('nic-claxton', 'Nic Claxton', 'C', 26, 78, ['defender', 'rebounder'], 'bkn'),
  lp('michael-porter-jr', 'Michael Porter Jr.', 'SF', 27, 80, ['shooter'], 'bkn'),
  lp('egor-demin', 'Egor Demin', 'PG', 19, 65, ['playmaker'], 'bkn', true),
  lp('noah-clowney', 'Noah Clowney', 'PF', 21, 71, [], 'bkn'),
  lp('ziaire-williams', 'Ziaire Williams', 'SF', 24, 71, [], 'bkn'),
  lp('dayron-sharpe', "Day'Ron Sharpe", 'C', 24, 70, ['rebounder'], 'bkn'),
  lp('tyrese-martin', 'Tyrese Martin', 'SG', 24, 66, [], 'bkn'),
  lp('drake-powell', 'Drake Powell', 'SG', 20, 60, [], 'bkn', true),

  // ---- CHA Hornets ----
  lp('lamelo-ball', 'LaMelo Ball', 'PG', 24, 87, ['shooter', 'playmaker'], 'cha'),
  lp('brandon-miller', 'Brandon Miller', 'SF', 23, 82, ['shooter'], 'cha'),
  lp('miles-bridges', 'Miles Bridges', 'PF', 27, 79, [], 'cha'),
  lp('kon-knueppel', 'Kon Knueppel', 'SG', 20, 70, ['shooter'], 'cha', true),
  lp('josh-green', 'Josh Green', 'SG', 25, 71, ['defender'], 'cha'),
  lp('grant-williams', 'Grant Williams', 'PF', 27, 71, [], 'cha'),
  lp('tidjane-salaun', 'Tidjane Salaun', 'PF', 20, 65, [], 'cha'),
  lp('ryan-kalkbrenner', 'Ryan Kalkbrenner', 'C', 23, 64, [], 'cha'),
  lp('moussa-diabate', 'Moussa Diabate', 'C', 23, 61, [], 'cha'),

  // ---- CHI Bulls ----
  lp('josh-giddey', 'Josh Giddey', 'PG', 23, 82, ['playmaker', 'rebounder'], 'chi'),
  lp('coby-white', 'Coby White', 'PG', 26, 80, ['shooter'], 'chi'),
  lp('nikola-vucevic', 'Nikola Vucevic', 'C', 35, 78, ['rebounder'], 'chi'),
  lp('matas-buzelis', 'Matas Buzelis', 'PF', 21, 74, [], 'chi'),
  lp('ayo-dosunmu', 'Ayo Dosunmu', 'SG', 26, 73, [], 'chi'),
  lp('noa-essengue', 'Noa Essengue', 'SF', 19, 65, [], 'chi', true),
  lp('kevin-huerter', 'Kevin Huerter', 'SG', 27, 71, ['shooter'], 'chi'),
  lp('patrick-williams', 'Patrick Williams', 'PF', 24, 70, [], 'chi'),
  lp('isaac-okoro', 'Isaac Okoro', 'SG', 25, 68, ['defender'], 'chi'),

  // ---- CLE Cavaliers ----
  lp('donovan-mitchell', 'Donovan Mitchell', 'SG', 29, 91, ['shooter'], 'cle'),
  lp('darius-garland', 'Darius Garland', 'PG', 26, 85, ['shooter', 'playmaker'], 'cle'),
  lp('evan-mobley', 'Evan Mobley', 'PF', 25, 88, ['defender', 'rebounder'], 'cle'),
  lp('jarrett-allen', 'Jarrett Allen', 'C', 28, 81, ['rebounder'], 'cle'),
  lp('max-strus', 'Max Strus', 'SG', 30, 74, ['shooter'], 'cle'),
  lp('ty-jerome', 'Ty Jerome', 'PG', 28, 73, [], 'cle'),
  lp('de-andre-hunter', "De'Andre Hunter", 'SF', 28, 76, [], 'cle'),
  lp('craig-porter', 'Craig Porter Jr.', 'PG', 24, 62, [], 'cle'),
  lp('sam-merrill', 'Sam Merrill', 'SG', 30, 65, ['shooter'], 'cle'),

  // ---- DAL Mavericks ----
  lp('anthony-davis', 'Anthony Davis', 'PF', 33, 90, ['defender', 'rebounder'], 'dal'),
  lp('kyrie-irving-lg', 'Kyrie Irving', 'PG', 34, 88, ['shooter'], 'dal'),
  lp('klay-thompson', 'Klay Thompson', 'SG', 36, 78, ['shooter'], 'dal'),
  lp('cooper-flagg', 'Cooper Flagg', 'SF', 19, 76, ['defender'], 'dal', true),
  lp('daniel-gafford', 'Daniel Gafford', 'C', 27, 76, ['rebounder'], 'dal'),
  lp('pj-washington', 'P.J. Washington', 'PF', 27, 76, [], 'dal'),
  lp('dereck-lively', 'Dereck Lively II', 'C', 22, 74, ['rebounder'], 'dal'),
  lp('naji-marshall', 'Naji Marshall', 'SF', 28, 70, [], 'dal'),
  lp('max-christie', 'Max Christie', 'SG', 23, 68, [], 'dal'),

  // ---- DEN Nuggets ----
  lp('jokic', 'Nikola Jokic', 'C', 31, 97, ['playmaker', 'rebounder'], 'den'),
  lp('jamal-murray', 'Jamal Murray', 'PG', 29, 87, ['shooter'], 'den'),
  lp('cam-johnson', 'Cam Johnson', 'SF', 29, 79, ['shooter'], 'den'),
  lp('aaron-gordon', 'Aaron Gordon', 'PF', 30, 82, ['defender'], 'den'),
  lp('christian-braun', 'Christian Braun', 'SG', 24, 76, [], 'den'),
  lp('peyton-watson', 'Peyton Watson', 'SF', 23, 72, ['defender'], 'den'),
  lp('julian-strawther', 'Julian Strawther', 'SG', 23, 68, [], 'den'),
  lp('jonas-valanciunas', 'Jonas Valanciunas', 'C', 33, 70, ['rebounder'], 'den'),
  lp('zeke-nnaji', 'Zeke Nnaji', 'PF', 25, 62, [], 'den'),

  // ---- DET Pistons ----
  lp('cade-cunningham', 'Cade Cunningham', 'PG', 24, 89, ['playmaker'], 'det'),
  lp('jaden-ivey', 'Jaden Ivey', 'SG', 24, 78, [], 'det'),
  lp('ausar-thompson', 'Ausar Thompson', 'SF', 23, 78, ['defender'], 'det'),
  lp('jalen-duren', 'Jalen Duren', 'C', 22, 79, ['rebounder'], 'det'),
  lp('tobias-harris', 'Tobias Harris', 'PF', 33, 74, [], 'det'),
  lp('ron-holland', 'Ron Holland II', 'SF', 20, 70, [], 'det'),
  lp('duncan-robinson', 'Duncan Robinson', 'SG', 31, 72, ['shooter'], 'det'),
  lp('isaiah-stewart', 'Isaiah Stewart', 'C', 24, 70, ['rebounder'], 'det'),
  lp('marcus-sasser', 'Marcus Sasser', 'PG', 24, 63, [], 'det'),

  // ---- GSW Warriors ----
  lp('curry', 'Stephen Curry', 'PG', 37, 92, ['shooter'], 'gsw'),
  lp('jimmy-butler', 'Jimmy Butler', 'SF', 36, 85, ['defender'], 'gsw'),
  lp('draymond-green', 'Draymond Green', 'PF', 35, 78, ['defender', 'playmaker'], 'gsw'),
  lp('jonathan-kuminga', 'Jonathan Kuminga', 'PF', 23, 79, [], 'gsw'),
  lp('brandin-podziemski', 'Brandin Podziemski', 'SG', 23, 74, [], 'gsw'),
  lp('moses-moody', 'Moses Moody', 'SG', 23, 71, ['shooter'], 'gsw'),
  lp('buddy-hield', 'Buddy Hield', 'SG', 33, 72, ['shooter'], 'gsw'),
  lp('quinten-post', 'Quinten Post', 'C', 22, 63, [], 'gsw'),
  lp('gui-santos', 'Gui Santos', 'SF', 23, 60, [], 'gsw'),

  // ---- HOU Rockets ----
  lp('kevin-durant', 'Kevin Durant', 'PF', 37, 90, ['shooter'], 'hou'),
  lp('alperen-sengun', 'Alperen Sengun', 'C', 23, 87, ['playmaker', 'rebounder'], 'hou'),
  lp('amen-thompson', 'Amen Thompson', 'SF', 23, 82, ['defender'], 'hou'),
  lp('fred-vanvleet', 'Fred VanVleet', 'PG', 32, 76, ['shooter'], 'hou'),
  lp('steven-adams', 'Steven Adams', 'C', 32, 68, ['rebounder'], 'hou'),
  lp('tari-eason', 'Tari Eason', 'PF', 25, 74, [], 'hou'),
  lp('reed-sheppard', 'Reed Sheppard', 'PG', 21, 66, [], 'hou'),
  lp('jabari-smith-jr', 'Jabari Smith Jr.', 'PF', 22, 76, ['defender'], 'hou'),
  lp('cam-whitmore', 'Cam Whitmore', 'SF', 22, 68, [], 'hou'),

  // ---- IND Pacers ----
  lp('tyrese-haliburton', 'Tyrese Haliburton', 'PG', 26, 88, ['playmaker', 'shooter'], 'ind'),
  lp('pascal-siakam', 'Pascal Siakam', 'PF', 32, 84, [], 'ind'),
  lp('isaiah-jackson', 'Isaiah Jackson', 'C', 24, 73, ['rebounder'], 'ind'),
  lp('bennedict-mathurin', 'Bennedict Mathurin', 'SG', 23, 78, ['shooter'], 'ind'),
  lp('andrew-nembhard', 'Andrew Nembhard', 'PG', 26, 74, [], 'ind'),
  lp('aaron-nesmith', 'Aaron Nesmith', 'SF', 26, 74, ['shooter', 'defender'], 'ind'),
  lp('obi-toppin', 'Obi Toppin', 'PF', 28, 71, [], 'ind'),
  lp('tj-mcconnell', "T.J. McConnell", 'PG', 33, 69, [], 'ind'),
  lp('jarace-walker', 'Jarace Walker', 'PF', 21, 65, [], 'ind'),

  // ---- LAC Clippers ----
  lp('kawhi-leonard', 'Kawhi Leonard', 'SF', 34, 87, ['defender'], 'lac'),
  lp('james-harden', 'James Harden', 'PG', 36, 85, ['playmaker'], 'lac'),
  lp('ivica-zubac', 'Ivica Zubac', 'C', 29, 80, ['rebounder'], 'lac'),
  lp('norman-powell', 'Norman Powell', 'SG', 33, 78, ['shooter'], 'lac'),
  lp('derrick-jones-jr', 'Derrick Jones Jr.', 'SF', 29, 73, ['defender'], 'lac'),
  lp('kris-dunn', 'Kris Dunn', 'PG', 32, 70, ['defender'], 'lac'),
  lp('bogdan-bogdanovic', 'Bogdan Bogdanovic', 'SG', 33, 73, ['shooter'], 'lac'),
  lp('john-collins', 'John Collins', 'PF', 28, 74, [], 'lac'),
  lp('brook-lopez', 'Brook Lopez', 'C', 38, 68, [], 'lac'),

  // ---- LAL Lakers ----
  lp('luka-doncic', 'Luka Doncic', 'PG', 27, 96, ['playmaker', 'shooter'], 'lal'),
  lp('lebron-james-lg', 'LeBron James', 'SF', 40, 88, ['playmaker'], 'lal'),
  lp('austin-reaves', 'Austin Reaves', 'SG', 27, 82, ['shooter', 'playmaker'], 'lal'),
  lp('rui-hachimura', 'Rui Hachimura', 'PF', 28, 75, [], 'lal'),
  lp('deandre-ayton', 'Deandre Ayton', 'C', 27, 78, ['rebounder'], 'lal'),
  lp('marcus-smart', 'Marcus Smart', 'PG', 32, 74, ['defender'], 'lal'),
  lp('jarred-vanderbilt', 'Jarred Vanderbilt', 'PF', 27, 68, ['defender'], 'lal'),
  lp('gabe-vincent', 'Gabe Vincent', 'PG', 30, 65, [], 'lal'),
  lp('dalton-knecht', 'Dalton Knecht', 'SG', 24, 68, ['shooter'], 'lal'),

  // ---- MEM Grizzlies ----
  lp('ja-morant', 'Ja Morant', 'PG', 26, 89, ['playmaker'], 'mem'),
  lp('jaren-jackson-jr', 'Jaren Jackson Jr.', 'PF', 26, 87, ['defender'], 'mem'),
  lp('cedric-coward', 'Cedric Coward', 'SG', 22, 68, [], 'mem', true),
  lp('zach-edey', 'Zach Edey', 'C', 23, 73, ['rebounder'], 'mem'),
  lp('santi-aldama', 'Santi Aldama', 'PF', 25, 73, [], 'mem'),
  lp('jaylen-wells', 'Jaylen Wells', 'SG', 21, 71, [], 'mem'),
  lp('john-konchar', 'John Konchar', 'SG', 30, 62, [], 'mem'),
  lp('gg-jackson', 'GG Jackson II', 'PF', 21, 70, [], 'mem'),
  lp('vince-williams-jr', 'Vince Williams Jr.', 'SF', 25, 66, [], 'mem'),

  // ---- MIA Heat ----
  lp('bam-adebayo', 'Bam Adebayo', 'C', 28, 87, ['defender', 'rebounder'], 'mia'),
  lp('tyler-herro', 'Tyler Herro', 'SG', 26, 83, ['shooter'], 'mia'),
  lp('andrew-wiggins', 'Andrew Wiggins', 'SF', 30, 78, ['defender'], 'mia'),
  lp('terry-rozier', 'Terry Rozier', 'PG', 31, 72, ['shooter'], 'mia'),
  lp('davion-mitchell', 'Davion Mitchell', 'PG', 27, 70, ['defender'], 'mia'),
  lp('kelel-ware', "Kel'el Ware", 'C', 21, 72, ['rebounder'], 'mia'),
  lp('pelle-larsson', 'Pelle Larsson', 'SG', 23, 63, [], 'mia'),
  lp('nikola-jovic', 'Nikola Jovic', 'PF', 22, 68, [], 'mia'),
  lp('jaime-jaquez-jr', 'Jaime Jaquez Jr.', 'SF', 24, 70, [], 'mia'),

  // ---- MIL Bucks ----
  lp('giannis', 'Giannis Antetokounmpo', 'PF', 31, 96, ['defender', 'rebounder'], 'mil'),
  lp('myles-turner', 'Myles Turner', 'C', 30, 80, ['defender', 'rebounder'], 'mil'),
  lp('kyle-kuzma', 'Kyle Kuzma', 'SF', 30, 74, [], 'mil'),
  lp('aj-green', 'AJ Green', 'SG', 26, 68, ['shooter'], 'mil'),
  lp('gary-trent-jr', 'Gary Trent Jr.', 'SG', 27, 71, ['shooter'], 'mil'),
  lp('bobby-portis', 'Bobby Portis', 'PF', 31, 74, ['rebounder'], 'mil'),
  lp('ryan-rollins', 'Ryan Rollins', 'PG', 23, 68, [], 'mil'),
  lp('kevin-porter-jr', 'Kevin Porter Jr.', 'PG', 25, 66, [], 'mil'),
  lp('cole-anthony', 'Cole Anthony', 'PG', 26, 66, [], 'mil'),

  // ---- MIN Timberwolves ----
  lp('anthony-edwards', 'Anthony Edwards', 'SG', 24, 92, ['shooter', 'defender'], 'min'),
  lp('julius-randle', 'Julius Randle', 'PF', 31, 82, [], 'min'),
  lp('rudy-gobert', 'Rudy Gobert', 'C', 33, 83, ['defender', 'rebounder'], 'min'),
  lp('jaden-mcdaniels', 'Jaden McDaniels', 'SF', 25, 79, ['defender'], 'min'),
  lp('mike-conley', 'Mike Conley', 'PG', 38, 72, ['playmaker'], 'min'),
  lp('donte-divincenzo', 'Donte DiVincenzo', 'SG', 29, 74, ['shooter'], 'min'),
  lp('naz-reid', 'Naz Reid', 'C', 26, 76, ['rebounder'], 'min'),
  lp('terrence-shannon-jr', 'Terrence Shannon Jr.', 'SG', 25, 68, [], 'min'),
  lp('rob-dillingham', 'Rob Dillingham', 'PG', 21, 65, [], 'min'),

  // ---- NOP Pelicans ----
  lp('zion-williamson', 'Zion Williamson', 'PF', 25, 85, [], 'nop'),
  lp('trey-murphy-iii', 'Trey Murphy III', 'SF', 26, 80, ['shooter'], 'nop'),
  lp('herbert-jones', 'Herbert Jones', 'SF', 27, 76, ['defender'], 'nop'),
  lp('jordan-poole', 'Jordan Poole', 'SG', 27, 74, ['shooter'], 'nop'),
  lp('yves-missi', 'Yves Missi', 'C', 21, 71, ['rebounder'], 'nop'),
  lp('derik-queen', 'Derik Queen', 'C', 20, 68, ['rebounder'], 'nop', true),
  lp('jeremiah-fears', 'Jeremiah Fears', 'PG', 19, 66, ['playmaker'], 'nop', true),
  lp('saddiq-bey', 'Saddiq Bey', 'SF', 27, 66, [], 'nop'),
  lp('jose-alvarado', 'Jose Alvarado', 'PG', 28, 68, ['defender'], 'nop'),

  // ---- NYK Knicks ----
  lp('jalen-brunson', 'Jalen Brunson', 'PG', 29, 91, ['shooter', 'playmaker'], 'nyk'),
  lp('karl-anthony-towns', 'Karl-Anthony Towns', 'PF', 30, 87, ['shooter', 'rebounder'], 'nyk'),
  lp('og-anunoby', 'OG Anunoby', 'SF', 28, 82, ['defender'], 'nyk'),
  lp('mikal-bridges', 'Mikal Bridges', 'SF', 29, 80, ['defender'], 'nyk'),
  lp('josh-hart', 'Josh Hart', 'SG', 31, 76, ['rebounder'], 'nyk'),
  lp('mitchell-robinson', 'Mitchell Robinson', 'C', 28, 73, ['rebounder'], 'nyk'),
  lp('miles-mcbride', 'Miles McBride', 'PG', 25, 71, ['defender'], 'nyk'),
  lp('pacome-dadiet', 'Pacome Dadiet', 'SF', 20, 60, [], 'nyk'),
  lp('ariel-hukporti', 'Ariel Hukporti', 'C', 23, 61, [], 'nyk'),

  // ---- OKC Thunder ----
  lp('sga', 'Shai Gilgeous-Alexander', 'PG', 27, 97, ['shooter'], 'okc'),
  lp('jalen-williams', 'Jalen Williams', 'SF', 25, 88, ['defender', 'playmaker'], 'okc'),
  lp('chet-holmgren', 'Chet Holmgren', 'C', 24, 87, ['defender', 'rebounder'], 'okc'),
  lp('luguentz-dort', 'Luguentz Dort', 'SG', 27, 78, ['defender'], 'okc'),
  lp('isaiah-hartenstein', 'Isaiah Hartenstein', 'C', 28, 78, ['rebounder'], 'okc'),
  lp('aaron-wiggins', 'Aaron Wiggins', 'SG', 27, 71, [], 'okc'),
  lp('cason-wallace', 'Cason Wallace', 'PG', 23, 74, ['defender'], 'okc'),
  lp('ajay-mitchell', 'Ajay Mitchell', 'PG', 22, 69, [], 'okc'),
  lp('jaylin-williams', 'Jaylin Williams', 'PF', 23, 65, [], 'okc'),

  // ---- ORL Magic ----
  lp('paolo-banchero', 'Paolo Banchero', 'PF', 23, 89, [], 'orl'),
  lp('franz-wagner', 'Franz Wagner', 'SF', 24, 85, ['shooter'], 'orl'),
  lp('desmond-bane', 'Desmond Bane', 'SG', 27, 82, ['shooter'], 'orl'),
  lp('jalen-suggs', 'Jalen Suggs', 'PG', 24, 78, ['defender'], 'orl'),
  lp('wendell-carter-jr', 'Wendell Carter Jr.', 'C', 26, 74, ['rebounder'], 'orl'),
  lp('anthony-black', 'Anthony Black', 'PG', 22, 68, [], 'orl'),
  lp('goga-bitadze', 'Goga Bitadze', 'C', 26, 65, [], 'orl'),
  lp('tristan-da-silva', 'Tristan da Silva', 'SF', 23, 66, [], 'orl'),
  lp('jett-howard', 'Jett Howard', 'SG', 22, 60, [], 'orl'),

  // ---- PHI 76ers ----
  lp('joel-embiid', 'Joel Embiid', 'C', 31, 88, ['rebounder'], 'phi'),
  lp('tyrese-maxey', 'Tyrese Maxey', 'PG', 25, 88, ['shooter'], 'phi'),
  lp('paul-george', 'Paul George', 'SF', 35, 80, ['shooter', 'defender'], 'phi'),
  lp('vj-edgecombe', 'VJ Edgecombe', 'SG', 19, 71, ['defender'], 'phi', true),
  lp('kelly-oubre-jr', 'Kelly Oubre Jr.', 'SF', 29, 74, [], 'phi'),
  lp('andre-drummond', 'Andre Drummond', 'C', 32, 68, ['rebounder'], 'phi'),
  lp('quentin-grimes', 'Quentin Grimes', 'SG', 25, 71, [], 'phi'),
  lp('justin-edwards', 'Justin Edwards', 'SF', 21, 62, [], 'phi'),
  lp('jared-mccain', 'Jared McCain', 'SG', 21, 70, ['shooter'], 'phi'),

  // ---- PHX Suns ----
  lp('devin-booker', 'Devin Booker', 'SG', 29, 91, ['shooter'], 'phx'),
  lp('jalen-green', 'Jalen Green', 'SG', 24, 79, ['shooter'], 'phx'),
  lp('dillon-brooks', 'Dillon Brooks', 'SF', 30, 73, ['defender'], 'phx'),
  lp('khaman-maluach', 'Khaman Maluach', 'C', 19, 66, ['rebounder'], 'phx', true),
  lp('grayson-allen', 'Grayson Allen', 'SG', 30, 75, ['shooter'], 'phx'),
  lp('royce-oneale', "Royce O'Neale", 'PF', 32, 70, ['defender'], 'phx'),
  lp('mark-williams', 'Mark Williams', 'C', 24, 74, ['rebounder'], 'phx'),
  lp('ryan-dunn', 'Ryan Dunn', 'SF', 21, 68, ['defender'], 'phx'),
  lp('collin-gillespie', 'Collin Gillespie', 'PG', 25, 62, [], 'phx'),

  // ---- POR Trail Blazers ----
  lp('damian-lillard', 'Damian Lillard', 'PG', 35, 84, ['shooter'], 'por'),
  lp('deni-avdija', 'Deni Avdija', 'SF', 24, 82, ['rebounder'], 'por'),
  lp('shaedon-sharpe', 'Shaedon Sharpe', 'SG', 23, 79, ['shooter'], 'por'),
  lp('jrue-holiday', 'Jrue Holiday', 'PG', 35, 78, ['defender'], 'por'),
  lp('donovan-clingan', 'Donovan Clingan', 'C', 21, 76, ['rebounder', 'defender'], 'por'),
  lp('toumani-camara', 'Toumani Camara', 'PF', 25, 72, ['defender'], 'por'),
  lp('jerami-grant', 'Jerami Grant', 'PF', 31, 74, [], 'por'),
  lp('robert-williams-iii', 'Robert Williams III', 'C', 28, 66, ['rebounder'], 'por'),
  lp('kris-murray', 'Kris Murray', 'SF', 24, 60, [], 'por'),

  // ---- SAC Kings ----
  lp('domantas-sabonis', 'Domantas Sabonis', 'C', 29, 86, ['rebounder', 'playmaker'], 'sac'),
  lp('zach-lavine', 'Zach LaVine', 'SG', 30, 81, ['shooter'], 'sac'),
  lp('demar-derozan', 'DeMar DeRozan', 'SF', 36, 78, [], 'sac'),
  lp('malik-monk', 'Malik Monk', 'SG', 27, 76, ['shooter'], 'sac'),
  lp('keegan-murray', 'Keegan Murray', 'PF', 25, 75, ['shooter'], 'sac'),
  lp('devin-carter', 'Devin Carter', 'PG', 22, 68, [], 'sac'),
  lp('nolan-traore', 'Nolan Traore', 'PG', 19, 60, [], 'sac', true),
  lp('trey-lyles', 'Trey Lyles', 'PF', 29, 62, [], 'sac'),
  lp('maxime-raynaud', 'Maxime Raynaud', 'C', 23, 63, [], 'sac'),

  // ---- SAS Spurs ----
  lp('wemby', 'Victor Wembanyama', 'C', 22, 96, ['defender', 'rebounder'], 'sas'),
  lp('de-aaron-fox', "De'Aaron Fox", 'PG', 27, 88, ['shooter'], 'sas'),
  lp('dylan-harper', 'Dylan Harper', 'PG', 19, 74, ['playmaker'], 'sas', true),
  lp('devin-vassell', 'Devin Vassell', 'SG', 25, 79, ['shooter'], 'sas'),
  lp('stephon-castle', 'Stephon Castle', 'SG', 20, 76, ['defender'], 'sas'),
  lp('harrison-barnes', 'Harrison Barnes', 'SF', 33, 71, [], 'sas'),
  lp('keldon-johnson', 'Keldon Johnson', 'SF', 26, 72, [], 'sas'),
  lp('jeremy-sochan', 'Jeremy Sochan', 'PF', 22, 74, ['defender'], 'sas'),
  lp('luke-kornet', 'Luke Kornet', 'C', 30, 64, [], 'sas'),

  // ---- TOR Raptors ----
  lp('scottie-barnes', 'Scottie Barnes', 'SF', 24, 87, ['defender', 'playmaker'], 'tor'),
  lp('rj-barrett', 'RJ Barrett', 'SG', 25, 79, ['shooter'], 'tor'),
  lp('immanuel-quickley', 'Immanuel Quickley', 'PG', 26, 78, ['shooter'], 'tor'),
  lp('brandon-ingram', 'Brandon Ingram', 'SF', 28, 82, ['shooter'], 'tor'),
  lp('jakob-poeltl', 'Jakob Poeltl', 'C', 30, 76, ['rebounder'], 'tor'),
  lp('collin-murray-boyles', 'Collin Murray-Boyles', 'PF', 20, 68, ['defender'], 'tor', true),
  lp('gradey-dick', 'Gradey Dick', 'SG', 22, 70, ['shooter'], 'tor'),
  lp('ochai-agbaji', 'Ochai Agbaji', 'SG', 25, 64, [], 'tor'),
  lp('jamal-shead', 'Jamal Shead', 'PG', 23, 63, [], 'tor'),

  // ---- UTA Jazz ----
  lp('lauri-markkanen', 'Lauri Markkanen', 'PF', 28, 85, ['shooter'], 'uta'),
  lp('ace-bailey', 'Ace Bailey', 'SF', 19, 72, ['shooter'], 'uta', true),
  lp('walker-kessler', 'Walker Kessler', 'C', 24, 76, ['defender', 'rebounder'], 'uta'),
  lp('keyonte-george', 'Keyonte George', 'PG', 22, 73, [], 'uta'),
  lp('isaiah-collier', 'Isaiah Collier', 'PG', 21, 66, [], 'uta'),
  lp('taylor-hendricks', 'Taylor Hendricks', 'PF', 22, 68, [], 'uta'),
  lp('svi-mykhailiuk', 'Svi Mykhailiuk', 'SG', 28, 58, [], 'uta'),
  lp('kyle-filipowski', 'Kyle Filipowski', 'C', 22, 66, [], 'uta'),
  lp('brice-sensabaugh', 'Brice Sensabaugh', 'SF', 22, 60, [], 'uta'),

  // ---- WAS Wizards ----
  lp('alex-sarr', 'Alex Sarr', 'C', 20, 74, ['defender'], 'was'),
  lp('bilal-coulibaly', 'Bilal Coulibaly', 'SF', 21, 74, ['defender'], 'was'),
  lp('tre-johnson', 'Tre Johnson', 'SG', 19, 68, ['shooter'], 'was', true),
  lp('cj-mccollum', 'CJ McCollum', 'SG', 34, 76, ['shooter'], 'was'),
  lp('corey-kispert', 'Corey Kispert', 'SF', 26, 68, ['shooter'], 'was'),
  lp('justin-champagnie', 'Justin Champagnie', 'SF', 24, 58, [], 'was'),
  lp('malaki-branham', 'Malaki Branham', 'SG', 23, 64, [], 'was'),
  lp('kyshawn-george', 'Kyshawn George', 'SF', 21, 65, [], 'was'),
  lp('will-riley', 'Will Riley', 'SF', 19, 60, [], 'was', true),
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
