/**
 * Zip Code to State and City Mapping Utility
 * Maps 3-digit zip code prefixes to state codes and major city names
 */

// 3-digit zip prefix to state code mapping
export const zipToState = {
  // Connecticut (CT)
  '060': 'CT', '061': 'CT', '062': 'CT', '063': 'CT', '064': 'CT', '065': 'CT', '066': 'CT', '067': 'CT', '068': 'CT', '069': 'CT',
  // Massachusetts (MA)
  '010': 'MA', '011': 'MA', '012': 'MA', '013': 'MA', '014': 'MA', '015': 'MA', '016': 'MA', '017': 'MA', '018': 'MA', '019': 'MA',
  '020': 'MA', '021': 'MA', '022': 'MA', '023': 'MA', '024': 'MA', '025': 'MA', '026': 'MA', '027': 'MA',
  // Rhode Island (RI)
  '028': 'RI', '029': 'RI',
  // New Hampshire (NH)
  '030': 'NH', '031': 'NH', '032': 'NH', '033': 'NH', '034': 'NH', '035': 'NH', '036': 'NH', '037': 'NH', '038': 'NH',
  // Maine (ME)
  '039': 'ME', '040': 'ME', '041': 'ME', '042': 'ME', '043': 'ME', '044': 'ME', '045': 'ME', '046': 'ME', '047': 'ME', '048': 'ME', '049': 'ME',
  // Vermont (VT)
  '050': 'VT', '051': 'VT', '052': 'VT', '053': 'VT', '054': 'VT', '056': 'VT', '057': 'VT', '058': 'VT', '059': 'VT',
  // New Jersey (NJ)
  '070': 'NJ', '071': 'NJ', '072': 'NJ', '073': 'NJ', '074': 'NJ', '075': 'NJ', '076': 'NJ', '077': 'NJ', '078': 'NJ', '079': 'NJ',
  '080': 'NJ', '081': 'NJ', '082': 'NJ', '083': 'NJ', '084': 'NJ', '085': 'NJ', '086': 'NJ', '087': 'NJ', '088': 'NJ', '089': 'NJ',
  // New York (NY)
  '100': 'NY', '101': 'NY', '102': 'NY', '103': 'NY', '104': 'NY', '105': 'NY', '106': 'NY', '107': 'NY', '108': 'NY', '109': 'NY',
  '110': 'NY', '111': 'NY', '112': 'NY', '113': 'NY', '114': 'NY', '115': 'NY', '116': 'NY', '117': 'NY', '118': 'NY', '119': 'NY',
  '120': 'NY', '121': 'NY', '122': 'NY', '123': 'NY', '124': 'NY', '125': 'NY', '126': 'NY', '127': 'NY', '128': 'NY', '129': 'NY',
  '130': 'NY', '131': 'NY', '132': 'NY', '133': 'NY', '134': 'NY', '135': 'NY', '136': 'NY', '137': 'NY', '138': 'NY', '139': 'NY',
  '140': 'NY', '141': 'NY', '142': 'NY', '143': 'NY', '144': 'NY', '145': 'NY', '146': 'NY', '147': 'NY', '148': 'NY', '149': 'NY',
  // Pennsylvania (PA)
  '150': 'PA', '151': 'PA', '152': 'PA', '153': 'PA', '154': 'PA', '155': 'PA', '156': 'PA', '157': 'PA', '158': 'PA', '159': 'PA',
  '160': 'PA', '161': 'PA', '162': 'PA', '163': 'PA', '164': 'PA', '165': 'PA', '166': 'PA', '167': 'PA', '168': 'PA', '169': 'PA',
  '170': 'PA', '171': 'PA', '172': 'PA', '173': 'PA', '174': 'PA', '175': 'PA', '176': 'PA', '177': 'PA', '178': 'PA', '179': 'PA',
  '180': 'PA', '181': 'PA', '182': 'PA', '183': 'PA', '184': 'PA', '185': 'PA', '186': 'PA', '187': 'PA', '188': 'PA', '189': 'PA',
  '190': 'PA', '191': 'PA', '192': 'PA', '193': 'PA', '194': 'PA', '195': 'PA', '196': 'PA',
  // Delaware (DE)
  '197': 'DE', '198': 'DE', '199': 'DE',
  // Washington DC (DC)
  '200': 'DC', '202': 'DC', '203': 'DC', '204': 'DC', '205': 'DC',
  // Maryland (MD)
  '206': 'MD', '207': 'MD', '208': 'MD', '209': 'MD', '210': 'MD', '211': 'MD', '212': 'MD', '214': 'MD', '215': 'MD', '216': 'MD', '217': 'MD', '218': 'MD', '219': 'MD',
  // Virginia (VA)
  '220': 'VA', '221': 'VA', '222': 'VA', '223': 'VA', '224': 'VA', '225': 'VA', '226': 'VA', '227': 'VA', '228': 'VA', '229': 'VA',
  '230': 'VA', '231': 'VA', '232': 'VA', '233': 'VA', '234': 'VA', '235': 'VA', '236': 'VA', '237': 'VA', '238': 'VA', '239': 'VA',
  '240': 'VA', '241': 'VA', '242': 'VA', '243': 'VA', '244': 'VA', '245': 'VA', '246': 'VA',
  // West Virginia (WV)
  '247': 'WV', '248': 'WV', '249': 'WV', '250': 'WV', '251': 'WV', '252': 'WV', '253': 'WV', '254': 'WV', '255': 'WV', '256': 'WV', '257': 'WV', '258': 'WV', '259': 'WV',
  '260': 'WV', '261': 'WV', '262': 'WV', '263': 'WV', '264': 'WV', '265': 'WV', '266': 'WV', '267': 'WV', '268': 'WV',
  // North Carolina (NC)
  '270': 'NC', '271': 'NC', '272': 'NC', '273': 'NC', '274': 'NC', '275': 'NC', '276': 'NC', '277': 'NC', '278': 'NC', '279': 'NC',
  '280': 'NC', '281': 'NC', '282': 'NC', '283': 'NC', '284': 'NC', '285': 'NC', '286': 'NC', '287': 'NC', '288': 'NC', '289': 'NC',
  // South Carolina (SC)
  '290': 'SC', '291': 'SC', '292': 'SC', '293': 'SC', '294': 'SC', '295': 'SC', '296': 'SC', '297': 'SC', '298': 'SC', '299': 'SC',
  // Georgia (GA)
  '300': 'GA', '301': 'GA', '302': 'GA', '303': 'GA', '304': 'GA', '305': 'GA', '306': 'GA', '307': 'GA', '308': 'GA', '309': 'GA',
  '310': 'GA', '311': 'GA', '312': 'GA', '313': 'GA', '314': 'GA', '315': 'GA', '316': 'GA', '317': 'GA', '318': 'GA', '319': 'GA',
  // Florida (FL)
  '320': 'FL', '321': 'FL', '322': 'FL', '323': 'FL', '324': 'FL', '325': 'FL', '326': 'FL', '327': 'FL', '328': 'FL', '329': 'FL',
  '330': 'FL', '331': 'FL', '332': 'FL', '333': 'FL', '334': 'FL', '335': 'FL', '336': 'FL', '337': 'FL', '338': 'FL', '339': 'FL',
  '340': 'FL', '341': 'FL', '342': 'FL', '344': 'FL', '346': 'FL', '347': 'FL', '349': 'FL',
  // Alabama (AL)
  '350': 'AL', '351': 'AL', '352': 'AL', '354': 'AL', '355': 'AL', '356': 'AL', '357': 'AL', '358': 'AL', '359': 'AL',
  '360': 'AL', '361': 'AL', '362': 'AL', '363': 'AL', '364': 'AL', '365': 'AL', '366': 'AL', '367': 'AL', '368': 'AL', '369': 'AL',
  // Tennessee (TN)
  '370': 'TN', '371': 'TN', '372': 'TN', '373': 'TN', '374': 'TN', '375': 'TN', '376': 'TN', '377': 'TN', '378': 'TN', '379': 'TN',
  '380': 'TN', '381': 'TN', '382': 'TN', '383': 'TN', '384': 'TN', '385': 'TN',
  // Mississippi (MS)
  '386': 'MS', '387': 'MS', '388': 'MS', '389': 'MS', '390': 'MS', '391': 'MS', '392': 'MS', '393': 'MS', '394': 'MS', '395': 'MS', '396': 'MS', '397': 'MS',
  // Kentucky (KY)
  '400': 'KY', '401': 'KY', '402': 'KY', '403': 'KY', '404': 'KY', '405': 'KY', '406': 'KY', '407': 'KY', '408': 'KY', '409': 'KY',
  '410': 'KY', '411': 'KY', '412': 'KY', '413': 'KY', '414': 'KY', '415': 'KY', '416': 'KY', '417': 'KY', '418': 'KY',
  '420': 'KY', '421': 'KY', '422': 'KY', '423': 'KY', '424': 'KY', '425': 'KY', '426': 'KY', '427': 'KY',
  // Ohio (OH)
  '430': 'OH', '431': 'OH', '432': 'OH', '433': 'OH', '434': 'OH', '435': 'OH', '436': 'OH', '437': 'OH', '438': 'OH', '439': 'OH',
  '440': 'OH', '441': 'OH', '442': 'OH', '443': 'OH', '444': 'OH', '445': 'OH', '446': 'OH', '447': 'OH', '448': 'OH', '449': 'OH',
  '450': 'OH', '451': 'OH', '452': 'OH', '453': 'OH', '454': 'OH', '455': 'OH', '456': 'OH', '457': 'OH', '458': 'OH',
  // Indiana (IN)
  '460': 'IN', '461': 'IN', '462': 'IN', '463': 'IN', '464': 'IN', '465': 'IN', '466': 'IN', '467': 'IN', '468': 'IN', '469': 'IN',
  '470': 'IN', '471': 'IN', '472': 'IN', '473': 'IN', '474': 'IN', '475': 'IN', '476': 'IN', '477': 'IN', '478': 'IN', '479': 'IN',
  // Michigan (MI)
  '480': 'MI', '481': 'MI', '482': 'MI', '483': 'MI', '484': 'MI', '485': 'MI', '486': 'MI', '487': 'MI', '488': 'MI', '489': 'MI',
  '490': 'MI', '491': 'MI', '492': 'MI', '493': 'MI', '494': 'MI', '495': 'MI', '496': 'MI', '497': 'MI', '498': 'MI', '499': 'MI',
  // Iowa (IA)
  '500': 'IA', '501': 'IA', '502': 'IA', '503': 'IA', '504': 'IA', '505': 'IA', '506': 'IA', '507': 'IA', '508': 'IA', '509': 'IA',
  '510': 'IA', '511': 'IA', '512': 'IA', '513': 'IA', '514': 'IA', '515': 'IA', '516': 'IA', '520': 'IA', '521': 'IA', '522': 'IA',
  '523': 'IA', '524': 'IA', '525': 'IA', '526': 'IA', '527': 'IA', '528': 'IA',
  // Wisconsin (WI)
  '530': 'WI', '531': 'WI', '532': 'WI', '534': 'WI', '535': 'WI', '537': 'WI', '538': 'WI', '539': 'WI',
  '540': 'WI', '541': 'WI', '542': 'WI', '543': 'WI', '544': 'WI', '545': 'WI', '546': 'WI', '547': 'WI', '548': 'WI', '549': 'WI',
  // Minnesota (MN)
  '550': 'MN', '551': 'MN', '553': 'MN', '554': 'MN', '555': 'MN', '556': 'MN', '557': 'MN', '558': 'MN', '559': 'MN',
  '560': 'MN', '561': 'MN', '562': 'MN', '563': 'MN', '564': 'MN', '565': 'MN', '566': 'MN', '567': 'MN',
  // South Dakota (SD)
  '570': 'SD', '571': 'SD', '572': 'SD', '573': 'SD', '574': 'SD', '575': 'SD', '576': 'SD', '577': 'SD',
  // North Dakota (ND)
  '580': 'ND', '581': 'ND', '582': 'ND', '583': 'ND', '584': 'ND', '585': 'ND', '586': 'ND', '587': 'ND', '588': 'ND',
  // Montana (MT)
  '590': 'MT', '591': 'MT', '592': 'MT', '593': 'MT', '594': 'MT', '595': 'MT', '596': 'MT', '597': 'MT', '598': 'MT', '599': 'MT',
  // Illinois (IL)
  '600': 'IL', '601': 'IL', '602': 'IL', '603': 'IL', '604': 'IL', '605': 'IL', '606': 'IL', '607': 'IL', '608': 'IL', '609': 'IL',
  '610': 'IL', '611': 'IL', '612': 'IL', '613': 'IL', '614': 'IL', '615': 'IL', '616': 'IL', '617': 'IL', '618': 'IL', '619': 'IL',
  '620': 'IL', '622': 'IL', '623': 'IL', '624': 'IL', '625': 'IL', '626': 'IL', '627': 'IL', '628': 'IL', '629': 'IL',
  // Missouri (MO)
  '630': 'MO', '631': 'MO', '633': 'MO', '634': 'MO', '635': 'MO', '636': 'MO', '637': 'MO', '638': 'MO', '639': 'MO',
  '640': 'MO', '641': 'MO', '644': 'MO', '645': 'MO', '646': 'MO', '647': 'MO', '648': 'MO', '649': 'MO',
  '650': 'MO', '651': 'MO', '652': 'MO', '653': 'MO', '654': 'MO', '655': 'MO', '656': 'MO', '657': 'MO', '658': 'MO',
  // Kansas (KS)
  '660': 'KS', '661': 'KS', '662': 'KS', '664': 'KS', '665': 'KS', '666': 'KS', '667': 'KS', '668': 'KS', '669': 'KS',
  '670': 'KS', '671': 'KS', '672': 'KS', '673': 'KS', '674': 'KS', '675': 'KS', '676': 'KS', '677': 'KS', '678': 'KS', '679': 'KS',
  // Nebraska (NE)
  '680': 'NE', '681': 'NE', '683': 'NE', '684': 'NE', '685': 'NE', '686': 'NE', '687': 'NE', '688': 'NE', '689': 'NE',
  '690': 'NE', '691': 'NE', '692': 'NE', '693': 'NE',
  // Louisiana (LA)
  '700': 'LA', '701': 'LA', '703': 'LA', '704': 'LA', '705': 'LA', '706': 'LA', '707': 'LA', '708': 'LA',
  '710': 'LA', '711': 'LA', '712': 'LA', '713': 'LA', '714': 'LA',
  // Arkansas (AR)
  '716': 'AR', '717': 'AR', '718': 'AR', '719': 'AR', '720': 'AR', '721': 'AR', '722': 'AR', '723': 'AR', '724': 'AR', '725': 'AR',
  '726': 'AR', '727': 'AR', '728': 'AR', '729': 'AR',
  // Oklahoma (OK)
  '730': 'OK', '731': 'OK', '734': 'OK', '735': 'OK', '736': 'OK', '737': 'OK', '738': 'OK', '739': 'OK',
  '740': 'OK', '741': 'OK', '743': 'OK', '744': 'OK', '745': 'OK', '746': 'OK', '747': 'OK', '748': 'OK', '749': 'OK',
  // Texas (TX)
  '750': 'TX', '751': 'TX', '752': 'TX', '753': 'TX', '754': 'TX', '755': 'TX', '756': 'TX', '757': 'TX', '758': 'TX', '759': 'TX',
  '760': 'TX', '761': 'TX', '762': 'TX', '763': 'TX', '764': 'TX', '765': 'TX', '766': 'TX', '767': 'TX', '768': 'TX', '769': 'TX',
  '770': 'TX', '771': 'TX', '772': 'TX', '773': 'TX', '774': 'TX', '775': 'TX', '776': 'TX', '777': 'TX', '778': 'TX', '779': 'TX',
  '780': 'TX', '781': 'TX', '782': 'TX', '783': 'TX', '784': 'TX', '785': 'TX', '786': 'TX', '787': 'TX', '788': 'TX', '789': 'TX',
  '790': 'TX', '791': 'TX', '792': 'TX', '793': 'TX', '794': 'TX', '795': 'TX', '796': 'TX', '797': 'TX', '798': 'TX', '799': 'TX',
  // Colorado (CO)
  '800': 'CO', '801': 'CO', '802': 'CO', '803': 'CO', '804': 'CO', '805': 'CO', '806': 'CO', '807': 'CO', '808': 'CO', '809': 'CO',
  '810': 'CO', '811': 'CO', '812': 'CO', '813': 'CO', '814': 'CO', '815': 'CO', '816': 'CO',
  // Wyoming (WY)
  '820': 'WY', '821': 'WY', '822': 'WY', '823': 'WY', '824': 'WY', '825': 'WY', '826': 'WY', '827': 'WY', '828': 'WY', '829': 'WY', '830': 'WY', '831': 'WY',
  // Idaho (ID)
  '832': 'ID', '833': 'ID', '834': 'ID', '835': 'ID', '836': 'ID', '837': 'ID', '838': 'ID',
  // Utah (UT)
  '840': 'UT', '841': 'UT', '842': 'UT', '843': 'UT', '844': 'UT', '845': 'UT', '846': 'UT', '847': 'UT',
  // Arizona (AZ)
  '850': 'AZ', '851': 'AZ', '852': 'AZ', '853': 'AZ', '855': 'AZ', '856': 'AZ', '857': 'AZ', '859': 'AZ', '860': 'AZ', '863': 'AZ', '864': 'AZ', '865': 'AZ',
  // New Mexico (NM)
  '870': 'NM', '871': 'NM', '872': 'NM', '873': 'NM', '874': 'NM', '875': 'NM', '877': 'NM', '878': 'NM', '879': 'NM',
  '880': 'NM', '881': 'NM', '882': 'NM', '883': 'NM', '884': 'NM',
  // Nevada (NV)
  '889': 'NV', '890': 'NV', '891': 'NV', '893': 'NV', '894': 'NV', '895': 'NV', '897': 'NV', '898': 'NV',
  // California (CA)
  '900': 'CA', '901': 'CA', '902': 'CA', '903': 'CA', '904': 'CA', '905': 'CA', '906': 'CA', '907': 'CA', '908': 'CA', '909': 'CA',
  '910': 'CA', '911': 'CA', '912': 'CA', '913': 'CA', '914': 'CA', '915': 'CA', '916': 'CA', '917': 'CA', '918': 'CA', '919': 'CA',
  '920': 'CA', '921': 'CA', '922': 'CA', '923': 'CA', '924': 'CA', '925': 'CA', '926': 'CA', '927': 'CA', '928': 'CA',
  '930': 'CA', '931': 'CA', '932': 'CA', '933': 'CA', '934': 'CA', '935': 'CA', '936': 'CA', '937': 'CA', '938': 'CA', '939': 'CA',
  '940': 'CA', '941': 'CA', '942': 'CA', '943': 'CA', '944': 'CA', '945': 'CA', '946': 'CA', '947': 'CA', '948': 'CA', '949': 'CA',
  '950': 'CA', '951': 'CA', '952': 'CA', '953': 'CA', '954': 'CA', '955': 'CA', '956': 'CA', '957': 'CA', '958': 'CA', '959': 'CA',
  '960': 'CA', '961': 'CA',
  // Hawaii (HI)
  '967': 'HI', '968': 'HI',
  // Alaska (AK)
  '995': 'AK', '996': 'AK', '997': 'AK', '998': 'AK', '999': 'AK',
  // Oregon (OR)
  '970': 'OR', '971': 'OR', '972': 'OR', '973': 'OR', '974': 'OR', '975': 'OR', '976': 'OR', '977': 'OR', '978': 'OR', '979': 'OR',
  // Washington (WA)
  '980': 'WA', '981': 'WA', '982': 'WA', '983': 'WA', '984': 'WA', '985': 'WA', '986': 'WA', '988': 'WA', '989': 'WA',
  '990': 'WA', '991': 'WA', '992': 'WA', '993': 'WA', '994': 'WA',
  // Puerto Rico (PR)
  '006': 'PR', '007': 'PR', '009': 'PR',
  // Virgin Islands (VI)
  '008': 'VI',
  // APO/FPO Military
  '090': 'AE', '091': 'AE', '092': 'AE', '093': 'AE', '094': 'AE', '095': 'AE', '096': 'AE', '097': 'AE', '098': 'AE',
  '962': 'AP', '963': 'AP', '964': 'AP', '965': 'AP', '966': 'AP',
  '340': 'AA'
}

// Major city names by zip prefix (most common/populated areas)
export const zipToCity = {
  // New York
  '100': 'New York', '101': 'New York', '102': 'New York', '103': 'Staten Island', '104': 'Bronx',
  '110': 'Queens', '111': 'Long Island City', '112': 'Brooklyn', '113': 'Flushing', '114': 'Jamaica',
  '115': 'Floral Park', '116': 'Far Rockaway', '117': 'Hicksville', '118': 'Huntington', '119': 'Riverhead',
  '120': 'Albany', '121': 'Albany', '122': 'Albany', '123': 'Schenectady', '124': 'Kingston',
  '125': 'Poughkeepsie', '126': 'Poughkeepsie', '127': 'Middletown', '128': 'Glens Falls', '129': 'Plattsburgh',
  '130': 'Syracuse', '131': 'Syracuse', '132': 'Syracuse', '133': 'Utica', '134': 'Utica',
  '135': 'Utica', '136': 'Watertown', '137': 'Binghamton', '138': 'Binghamton', '139': 'Binghamton',
  '140': 'Buffalo', '141': 'Buffalo', '142': 'Buffalo', '143': 'Niagara Falls', '144': 'Rochester',
  '145': 'Rochester', '146': 'Rochester', '147': 'Jamestown', '148': 'Elmira', '149': 'Elmira',
  // California
  '900': 'Los Angeles', '901': 'Los Angeles', '902': 'Inglewood', '903': 'Inglewood', '904': 'Santa Monica',
  '905': 'Torrance', '906': 'Whittier', '907': 'Long Beach', '908': 'Long Beach', '909': 'Los Angeles',
  '910': 'Pasadena', '911': 'Pasadena', '912': 'Glendale', '913': 'Van Nuys', '914': 'Van Nuys',
  '915': 'Burbank', '916': 'North Hollywood', '917': 'Arleta', '918': 'Northridge', '919': 'San Fernando',
  '920': 'San Diego', '921': 'San Diego', '922': 'Indio', '923': 'San Bernardino', '924': 'San Bernardino',
  '925': 'Riverside', '926': 'Santa Ana', '927': 'Santa Ana', '928': 'Anaheim',
  '930': 'Ventura', '931': 'Santa Barbara', '932': 'Bakersfield', '933': 'Bakersfield', '934': 'Santa Barbara',
  '935': 'Mojave', '936': 'Fresno', '937': 'Fresno', '938': 'Fresno', '939': 'Salinas',
  '940': 'San Francisco', '941': 'San Francisco', '942': 'Sacramento', '943': 'Palo Alto', '944': 'San Mateo',
  '945': 'Oakland', '946': 'Oakland', '947': 'Berkeley', '948': 'Richmond', '949': 'San Rafael',
  '950': 'San Jose', '951': 'San Jose', '952': 'Stockton', '953': 'Stockton', '954': 'Santa Rosa',
  '955': 'Eureka', '956': 'Sacramento', '957': 'Sacramento', '958': 'Sacramento', '959': 'Marysville',
  '960': 'Redding', '961': 'Redding',
  // Texas
  '750': 'Dallas', '751': 'Dallas', '752': 'Dallas', '753': 'Dallas', '754': 'Greenville',
  '755': 'Texarkana', '756': 'Longview', '757': 'Tyler', '758': 'Palestine', '759': 'Lufkin',
  '760': 'Fort Worth', '761': 'Fort Worth', '762': 'Fort Worth', '763': 'Wichita Falls', '764': 'Fort Worth',
  '765': 'Waco', '766': 'Waco', '767': 'Waco', '768': 'Abilene', '769': 'Midland',
  '770': 'Houston', '771': 'Houston', '772': 'Houston', '773': 'Huntsville', '774': 'Houston',
  '775': 'Houston', '776': 'Beaumont', '777': 'Beaumont', '778': 'Bryan', '779': 'Victoria',
  '780': 'San Antonio', '781': 'San Antonio', '782': 'San Antonio', '783': 'Corpus Christi', '784': 'Corpus Christi',
  '785': 'McAllen', '786': 'Austin', '787': 'Austin', '788': 'Austin', '789': 'Austin',
  '790': 'Amarillo', '791': 'Amarillo', '792': 'Lubbock', '793': 'Lubbock', '794': 'Lubbock',
  '795': 'Lubbock', '796': 'Lubbock', '797': 'Midland', '798': 'El Paso', '799': 'El Paso',
  // Florida
  '320': 'Jacksonville', '321': 'Daytona Beach', '322': 'Jacksonville', '323': 'Tallahassee', '324': 'Panama City',
  '325': 'Pensacola', '326': 'Gainesville', '327': 'Orlando', '328': 'Orlando', '329': 'Orlando',
  '330': 'Miami', '331': 'Miami', '332': 'Miami', '333': 'Fort Lauderdale', '334': 'West Palm Beach',
  '335': 'Tampa', '336': 'Tampa', '337': 'St. Petersburg', '338': 'Lakeland', '339': 'Fort Myers',
  '341': 'Naples', '342': 'Sarasota', '344': 'Gainesville', '346': 'Tampa', '347': 'Orlando', '349': 'West Palm Beach',
  // Illinois
  '600': 'Chicago', '601': 'Chicago', '602': 'Evanston', '603': 'Oak Park', '604': 'South Holland',
  '605': 'Chicago', '606': 'Chicago', '607': 'Chicago', '608': 'Chicago', '609': 'Kankakee',
  '610': 'Rockford', '611': 'Rockford', '612': 'Rock Island', '613': 'La Salle', '614': 'Galesburg',
  '615': 'Peoria', '616': 'Peoria', '617': 'Bloomington', '618': 'Champaign', '619': 'Champaign',
  '620': 'Springfield', '622': 'Springfield', '623': 'Quincy', '624': 'Effingham', '625': 'Springfield',
  '626': 'Springfield', '627': 'Springfield', '628': 'Centralia', '629': 'Carbondale',
  // Pennsylvania
  '150': 'Pittsburgh', '151': 'Pittsburgh', '152': 'Pittsburgh', '153': 'Pittsburgh', '154': 'Pittsburgh',
  '155': 'Johnstown', '156': 'Greensburg', '157': 'Indiana', '158': 'Du Bois', '159': 'Johnstown',
  '160': 'Butler', '161': 'New Castle', '162': 'Kittanning', '163': 'Oil City', '164': 'Erie',
  '165': 'Erie', '166': 'Altoona', '167': 'Bradford', '168': 'State College', '169': 'Wellsboro',
  '170': 'Harrisburg', '171': 'Harrisburg', '172': 'Chambersburg', '173': 'York', '174': 'York',
  '175': 'Lancaster', '176': 'Lancaster', '177': 'Williamsport', '178': 'Sunbury', '179': 'Pottsville',
  '180': 'Lehigh Valley', '181': 'Allentown', '182': 'Wilkes-Barre', '183': 'Stroudsburg', '184': 'Scranton',
  '185': 'Scranton', '186': 'Wilkes-Barre', '187': 'Wilkes-Barre', '188': 'Scranton', '189': 'Doylestown',
  '190': 'Philadelphia', '191': 'Philadelphia', '192': 'Philadelphia', '193': 'Philadelphia', '194': 'Norristown', '195': 'Reading', '196': 'Reading',
  // Ohio
  '430': 'Columbus', '431': 'Columbus', '432': 'Columbus', '433': 'Columbus', '434': 'Toledo',
  '435': 'Toledo', '436': 'Toledo', '437': 'Zanesville', '438': 'Zanesville', '439': 'Steubenville',
  '440': 'Cleveland', '441': 'Cleveland', '442': 'Cleveland', '443': 'Cleveland', '444': 'Youngstown',
  '445': 'Youngstown', '446': 'Canton', '447': 'Canton', '448': 'Mansfield', '449': 'Mansfield',
  '450': 'Cincinnati', '451': 'Cincinnati', '452': 'Cincinnati', '453': 'Dayton', '454': 'Dayton',
  '455': 'Dayton', '456': 'Dayton', '457': 'Athens', '458': 'Lima',
  // Georgia
  '300': 'Atlanta', '301': 'Atlanta', '302': 'Atlanta', '303': 'Atlanta', '304': 'Swainsboro',
  '305': 'Atlanta', '306': 'Athens', '307': 'Dalton', '308': 'Augusta', '309': 'Augusta',
  '310': 'Macon', '311': 'Atlanta', '312': 'Macon', '313': 'Savannah', '314': 'Savannah',
  '315': 'Waycross', '316': 'Valdosta', '317': 'Albany', '318': 'Columbus', '319': 'Columbus',
  // Michigan
  '480': 'Detroit', '481': 'Detroit', '482': 'Detroit', '483': 'Detroit', '484': 'Flint',
  '485': 'Flint', '486': 'Saginaw', '487': 'Saginaw', '488': 'Lansing', '489': 'Lansing',
  '490': 'Kalamazoo', '491': 'Kalamazoo', '492': 'Jackson', '493': 'Grand Rapids', '494': 'Grand Rapids',
  '495': 'Grand Rapids', '496': 'Traverse City', '497': 'Gaylord', '498': 'Iron Mountain', '499': 'Iron Mountain',
  // Arizona
  '850': 'Phoenix', '851': 'Phoenix', '852': 'Phoenix', '853': 'Phoenix', '855': 'Globe',
  '856': 'Tucson', '857': 'Tucson', '859': 'Show Low', '860': 'Flagstaff', '863': 'Prescott', '864': 'Kingman', '865': 'Yuma',
  // Washington
  '980': 'Seattle', '981': 'Seattle', '982': 'Everett', '983': 'Tacoma', '984': 'Tacoma',
  '985': 'Olympia', '986': 'Portland', '988': 'Wenatchee', '989': 'Yakima',
  '990': 'Spokane', '991': 'Spokane', '992': 'Spokane', '993': 'Pasco', '994': 'Clarkston',
  // Massachusetts
  '010': 'Springfield', '011': 'Springfield', '012': 'Pittsfield', '013': 'Greenfield', '014': 'Fitchburg',
  '015': 'Worcester', '016': 'Worcester', '017': 'Framingham', '018': 'Woburn', '019': 'Lynn',
  '020': 'Brockton', '021': 'Boston', '022': 'Boston', '023': 'Brockton', '024': 'Boston', '025': 'Buzzards Bay', '026': 'Cape Cod', '027': 'Providence',
  // New Jersey
  '070': 'Newark', '071': 'Newark', '072': 'Elizabeth', '073': 'Jersey City', '074': 'Paterson',
  '075': 'Paterson', '076': 'Hackensack', '077': 'Red Bank', '078': 'Dover', '079': 'Summit',
  '080': 'South Jersey', '081': 'Camden', '082': 'Camden', '083': 'Camden', '084': 'Atlantic City',
  '085': 'Trenton', '086': 'Trenton', '087': 'Lakewood', '088': 'New Brunswick', '089': 'New Brunswick',
  // Colorado
  '800': 'Denver', '801': 'Denver', '802': 'Denver', '803': 'Boulder', '804': 'Denver',
  '805': 'Longmont', '806': 'Brighton', '807': 'Fort Morgan', '808': 'Colorado Springs', '809': 'Colorado Springs',
  '810': 'Colorado Springs', '811': 'Alamosa', '812': 'Salida', '813': 'Durango', '814': 'Grand Junction', '815': 'Grand Junction', '816': 'Glenwood Springs',
  // Minnesota
  '550': 'Minneapolis', '551': 'St. Paul', '553': 'Minneapolis', '554': 'Minneapolis', '555': 'Minneapolis',
  '556': 'Duluth', '557': 'Duluth', '558': 'Duluth', '559': 'Rochester',
  '560': 'Mankato', '561': 'Mankato', '562': 'Willmar', '563': 'St. Cloud', '564': 'Brainerd', '565': 'Detroit Lakes', '566': 'Bemidji', '567': 'Thief River Falls',
  // North Carolina
  '270': 'Greensboro', '271': 'Winston-Salem', '272': 'Greensboro', '273': 'Greensboro', '274': 'Greensboro',
  '275': 'Raleigh', '276': 'Raleigh', '277': 'Durham', '278': 'Rocky Mount', '279': 'Rocky Mount',
  '280': 'Charlotte', '281': 'Charlotte', '282': 'Charlotte', '283': 'Fayetteville', '284': 'Wilmington',
  '285': 'Kinston', '286': 'Hickory', '287': 'Asheville', '288': 'Asheville', '289': 'Asheville',
  // Virginia
  '220': 'Fairfax', '221': 'Fairfax', '222': 'Arlington', '223': 'Alexandria', '224': 'Fredericksburg',
  '225': 'Fredericksburg', '226': 'Winchester', '227': 'Culpeper', '228': 'Harrisonburg', '229': 'Charlottesville',
  '230': 'Richmond', '231': 'Richmond', '232': 'Richmond', '233': 'Norfolk', '234': 'Norfolk',
  '235': 'Norfolk', '236': 'Newport News', '237': 'Newport News', '238': 'Petersburg', '239': 'Farmville',
  '240': 'Roanoke', '241': 'Roanoke', '242': 'Bristol', '243': 'Pulaski', '244': 'Staunton', '245': 'Lynchburg', '246': 'Lynchburg',
  // Default fallback
  'default': 'Unknown'
}

// City coordinates for map markers [longitude, latitude]
export const cityCoordinates = {
  // Major cities - coordinates for map plotting
  'New York, NY': [-74.006, 40.7128],
  'Los Angeles, CA': [-118.2437, 34.0522],
  'Chicago, IL': [-87.6298, 41.8781],
  'Houston, TX': [-95.3698, 29.7604],
  'Phoenix, AZ': [-112.074, 33.4484],
  'Philadelphia, PA': [-75.1652, 39.9526],
  'San Antonio, TX': [-98.4936, 29.4241],
  'San Diego, CA': [-117.1611, 32.7157],
  'Dallas, TX': [-96.797, 32.7767],
  'San Jose, CA': [-121.8863, 37.3382],
  'Austin, TX': [-97.7431, 30.2672],
  'Jacksonville, FL': [-81.6557, 30.3322],
  'Fort Worth, TX': [-97.3308, 32.7555],
  'Columbus, OH': [-82.9988, 39.9612],
  'San Francisco, CA': [-122.4194, 37.7749],
  'Charlotte, NC': [-80.8431, 35.2271],
  'Indianapolis, IN': [-86.1581, 39.7684],
  'Seattle, WA': [-122.3321, 47.6062],
  'Denver, CO': [-104.9903, 39.7392],
  'Boston, MA': [-71.0589, 42.3601],
  'Nashville, TN': [-86.7816, 36.1627],
  'Detroit, MI': [-83.0458, 42.3314],
  'Portland, OR': [-122.6765, 45.5152],
  'Las Vegas, NV': [-115.1398, 36.1699],
  'Memphis, TN': [-90.049, 35.1495],
  'Louisville, KY': [-85.7585, 38.2527],
  'Baltimore, MD': [-76.6122, 39.2904],
  'Milwaukee, WI': [-87.9065, 43.0389],
  'Albuquerque, NM': [-106.6504, 35.0844],
  'Tucson, AZ': [-110.9747, 32.2226],
  'Fresno, CA': [-119.7871, 36.7378],
  'Sacramento, CA': [-121.4944, 38.5816],
  'Atlanta, GA': [-84.388, 33.749],
  'Kansas City, MO': [-94.5786, 39.0997],
  'Miami, FL': [-80.1918, 25.7617],
  'Cleveland, OH': [-81.6944, 41.4993],
  'Raleigh, NC': [-78.6382, 35.7796],
  'Omaha, NE': [-95.9345, 41.2565],
  'Minneapolis, MN': [-93.265, 44.9778],
  'Tampa, FL': [-82.4572, 27.9506],
  'New Orleans, LA': [-90.0715, 29.9511],
  'Pittsburgh, PA': [-79.9959, 40.4406],
  'Cincinnati, OH': [-84.512, 39.1031],
  'St. Louis, MO': [-90.1994, 38.627],
  'Orlando, FL': [-81.3792, 28.5383],
  'Buffalo, NY': [-78.8784, 42.8864],
  'Rochester, NY': [-77.6109, 43.1566],
  'Albany, NY': [-73.7562, 42.6526],
  'Syracuse, NY': [-76.1474, 43.0481],
  'Anaheim, CA': [-117.9145, 33.8366],
  'Santa Ana, CA': [-117.8678, 33.7455],
  'Riverside, CA': [-117.3961, 33.9533],
  'San Bernardino, CA': [-117.2898, 34.1083],
  'Oakland, CA': [-122.2711, 37.8044],
  'Long Beach, CA': [-118.1937, 33.7701],
  'Bakersfield, CA': [-119.0187, 35.3733],
  'Stockton, CA': [-121.2908, 37.9577],
  'Newark, NJ': [-74.1724, 40.7357],
  'Jersey City, NJ': [-74.0431, 40.7178],
  'Fort Lauderdale, FL': [-80.1373, 26.1224],
  'St. Petersburg, FL': [-82.6403, 27.7676],
  'Wichita, KS': [-97.3375, 37.6872],
  'Tulsa, OK': [-95.9928, 36.154],
  'Oklahoma City, OK': [-97.5164, 35.4676],
  'Colorado Springs, CO': [-104.8214, 38.8339],
  'Virginia Beach, VA': [-75.978, 36.8529],
  'Norfolk, VA': [-76.2859, 36.8508],
  'Richmond, VA': [-77.436, 37.5407],
  'Arlington, VA': [-77.091, 38.8799],
  'Greensboro, NC': [-79.792, 36.0726],
  'Winston-Salem, NC': [-80.2442, 36.0999],
  'Durham, NC': [-78.8986, 35.994],
  'Wilmington, NC': [-77.9447, 34.2257],
  'Birmingham, AL': [-86.8025, 33.5207],
  'Montgomery, AL': [-86.2999, 32.3668],
  'Huntsville, AL': [-86.5861, 34.7304],
  'Mobile, AL': [-88.0399, 30.6954],
  'Little Rock, AR': [-92.2896, 34.7465],
  'Baton Rouge, LA': [-91.1403, 30.4515],
  'Jackson, MS': [-90.1848, 32.2988],
  'Des Moines, IA': [-93.6091, 41.5868],
  'Salt Lake City, UT': [-111.891, 40.7608],
  'Boise, ID': [-116.2023, 43.615],
  'Spokane, WA': [-117.426, 47.6588],
  'Tacoma, WA': [-122.4443, 47.2529],
  'Honolulu, HI': [-157.8583, 21.3069],
  'Anchorage, AK': [-149.9003, 61.2181],
  'Providence, RI': [-71.4128, 41.824],
  'Hartford, CT': [-72.6851, 41.7658],
  'Springfield, MA': [-72.5898, 42.1015],
  'Worcester, MA': [-71.8023, 42.2626],
  'Bridgeport, CT': [-73.2048, 41.1865],
  'New Haven, CT': [-72.9279, 41.3083],
  // Additional cities
  'El Paso, TX': [-106.485, 31.7619],
  'Lubbock, TX': [-101.8552, 33.5779],
  'Amarillo, TX': [-101.8313, 35.222],
  'Corpus Christi, TX': [-97.3964, 27.8006],
  'McAllen, TX': [-98.23, 26.2034],
  'Waco, TX': [-97.1467, 31.5493],
  'Beaumont, TX': [-94.1266, 30.0802],
  'Midland, TX': [-102.0779, 31.9973],
  'Pensacola, FL': [-87.2169, 30.4213],
  'Tallahassee, FL': [-84.2807, 30.4383],
  'Gainesville, FL': [-82.3248, 29.6516],
  'Daytona Beach, FL': [-81.0228, 29.2108],
  'Fort Myers, FL': [-81.8723, 26.6406],
  'Sarasota, FL': [-82.5308, 27.3364],
  'West Palm Beach, FL': [-80.0534, 26.7153],
  'Naples, FL': [-81.7948, 26.142],
  'Savannah, GA': [-81.0998, 32.0809],
  'Augusta, GA': [-81.9748, 33.4735],
  'Macon, GA': [-83.6324, 32.8407],
  'Athens, GA': [-83.3776, 33.961],
  'Columbia, SC': [-81.0348, 34.0007],
  'Charleston, SC': [-79.9311, 32.7765],
  'Greenville, SC': [-82.3941, 34.8526],
  'Roanoke, VA': [-79.9414, 37.2709],
  'Lynchburg, VA': [-79.1422, 37.4138],
  'Knoxville, TN': [-83.9207, 35.9606],
  'Chattanooga, TN': [-85.3097, 35.0456],
  'Lexington, KY': [-84.5037, 38.0406],
  'Grand Rapids, MI': [-85.6681, 42.9634],
  'Lansing, MI': [-84.5555, 42.7325],
  'Ann Arbor, MI': [-83.7382, 42.2808],
  'Flint, MI': [-83.6875, 43.0125],
  'Saginaw, MI': [-83.9508, 43.4195],
  'Akron, OH': [-81.519, 41.0814],
  'Toledo, OH': [-83.5379, 41.6528],
  'Dayton, OH': [-84.1916, 39.7589],
  'Youngstown, OH': [-80.6495, 41.0998],
  'Canton, OH': [-81.3784, 40.7989],
  'Fort Wayne, IN': [-85.1289, 41.0793],
  'Evansville, IN': [-87.5711, 37.9716],
  'South Bend, IN': [-86.2519, 41.6764],
  'Madison, WI': [-89.4012, 43.0731],
  'Green Bay, WI': [-88.0198, 44.5192],
  'Rockford, IL': [-89.094, 42.2711],
  'Peoria, IL': [-89.589, 40.6936],
  'Springfield, IL': [-89.6501, 39.7817],
  'St. Paul, MN': [-93.09, 44.9537],
  'Duluth, MN': [-92.1005, 46.7867],
  'Rochester, MN': [-92.4802, 44.0121],
  'Sioux Falls, SD': [-96.7311, 43.5446],
  'Fargo, ND': [-96.7898, 46.8772],
  'Billings, MT': [-108.5007, 45.7833],
  'Cheyenne, WY': [-104.8202, 41.134],
  'Allentown, PA': [-75.4902, 40.6023],
  'Scranton, PA': [-75.6624, 41.4089],
  'Harrisburg, PA': [-76.8867, 40.2732],
  'Erie, PA': [-80.0852, 42.1292],
  'Reading, PA': [-75.9268, 40.3356],
  'Lancaster, PA': [-76.3055, 40.0379],
  'York, PA': [-76.7275, 39.9626],
  'Wilmington, DE': [-75.5398, 39.7391],
  'Trenton, NJ': [-74.7596, 40.2206],
  'Camden, NJ': [-75.1196, 39.9259],
  'Paterson, NJ': [-74.1718, 40.9168],
  'Elizabeth, NJ': [-74.2107, 40.6639],
  'Atlantic City, NJ': [-74.4229, 39.3643]
}

// State code to full name
export const stateNames = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'DC': 'Washington DC', 'FL': 'Florida',
  'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana',
  'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine',
  'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire',
  'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota',
  'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'PR': 'Puerto Rico',
  'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas',
  'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'VI': 'Virgin Islands', 'WA': 'Washington',
  'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'AE': 'Armed Forces Europe', 'AP': 'Armed Forces Pacific', 'AA': 'Armed Forces Americas'
}

/**
 * Get state code from zip code
 * @param {string} zipCode - Full or partial zip code
 * @returns {string|null} - Two-letter state code or null
 */
export function getStateFromZip(zipCode) {
  if (!zipCode) return null
  const prefix = zipCode.toString().padStart(5, '0').substring(0, 3)
  return zipToState[prefix] || null
}

/**
 * Get city name from zip code
 * @param {string} zipCode - Full or partial zip code
 * @returns {string} - City name or 'Unknown'
 */
export function getCityFromZip(zipCode) {
  if (!zipCode) return 'Unknown'
  const prefix = zipCode.toString().padStart(5, '0').substring(0, 3)
  return zipToCity[prefix] || 'Unknown'
}

/**
 * Get full state name from state code
 * @param {string} stateCode - Two-letter state code
 * @returns {string} - Full state name
 */
export function getStateName(stateCode) {
  return stateNames[stateCode] || stateCode
}

/**
 * Aggregate shipping data by state from sales array
 * @param {Array} sales - Array of sale objects with buyer_zip_code
 * @returns {Object} - { stateCode: count }
 */
export function aggregateByState(sales) {
  const stateCounts = {}
  for (const sale of sales) {
    if (sale.buyer_zip_code) {
      const state = getStateFromZip(sale.buyer_zip_code)
      if (state) {
        stateCounts[state] = (stateCounts[state] || 0) + 1
      }
    }
  }
  return stateCounts
}

/**
 * Get top cities from sales data
 * @param {Array} sales - Array of sale objects with buyer_zip_code
 * @param {number} limit - Max number of cities to return
 * @returns {Array} - [{ city, state, count }]
 */
export function getTopCities(sales, limit = 5) {
  const cityCounts = {}

  for (const sale of sales) {
    if (sale.buyer_zip_code) {
      const city = getCityFromZip(sale.buyer_zip_code)
      const state = getStateFromZip(sale.buyer_zip_code)
      if (city !== 'Unknown' && state) {
        const key = `${city}, ${state}`
        cityCounts[key] = (cityCounts[key] || 0) + 1
      }
    }
  }

  return Object.entries(cityCounts)
    .map(([location, count]) => {
      const [city, state] = location.split(', ')
      return { city, state, count }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/**
 * Get cities with coordinates for map markers
 * @param {Array} sales - Array of sale objects with buyer_zip_code
 * @param {number} limit - Max number of cities to return (0 for all)
 * @returns {Array} - [{ city, state, count, coordinates: [lng, lat] }]
 */
export function getCitiesWithCoordinates(sales, limit = 0) {
  const cityCounts = {}

  for (const sale of sales) {
    if (sale.buyer_zip_code) {
      const city = getCityFromZip(sale.buyer_zip_code)
      const state = getStateFromZip(sale.buyer_zip_code)
      if (city !== 'Unknown' && state) {
        const key = `${city}, ${state}`
        cityCounts[key] = (cityCounts[key] || 0) + 1
      }
    }
  }

  const cities = Object.entries(cityCounts)
    .map(([location, count]) => {
      const [city, state] = location.split(', ')
      const coordinates = cityCoordinates[location] || null
      return { city, state, count, coordinates }
    })
    .filter(c => c.coordinates !== null) // Only include cities with known coordinates
    .sort((a, b) => b.count - a.count)

  return limit > 0 ? cities.slice(0, limit) : cities
}
