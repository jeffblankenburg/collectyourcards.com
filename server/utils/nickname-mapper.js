/**
 * Nickname Mapper
 *
 * Maps common nicknames to their full name equivalents for better player matching.
 * Handles cases like "Matt" -> "Matthew", "Mike" -> "Michael", etc.
 */

// Map of nicknames to full names
const NICKNAME_MAP = {
  // Common nicknames
  'al': ['albert', 'alan', 'allen', 'alvin', 'alfonso'],
  'alex': ['alexander', 'alexis'],
  'andy': ['andrew', 'anderson'],
  'art': ['arthur'],
  'ben': ['benjamin', 'bennett'],
  'bill': ['william'],
  'billy': ['william'],
  'bob': ['robert'],
  'bobby': ['robert'],
  'brad': ['bradley', 'bradford'],
  'charlie': ['charles'],
  'chris': ['christopher', 'christian'],
  'chuck': ['charles'],
  'dan': ['daniel', 'danny'],
  'danny': ['daniel'],
  'dave': ['david'],
  'dick': ['richard'],
  'don': ['donald'],
  'ed': ['edward', 'edwin', 'edgar', 'edmund'],
  'eddie': ['edward', 'edwin'],
  'frank': ['francis', 'franklin'],
  'fred': ['frederick', 'alfred'],
  'gene': ['eugene'],
  'greg': ['gregory'],
  'hank': ['henry', 'harold'],
  'jack': ['john', 'jackson'],
  'jake': ['jacob'],
  'jim': ['james'],
  'jimmy': ['james'],
  'joe': ['joseph', 'joel'],
  'joey': ['joseph'],
  'john': ['jonathan'],
  'jon': ['jonathan', 'john'],
  'josh': ['joshua'],
  'ken': ['kenneth', 'kendrick'],
  'kenny': ['kenneth'],
  'larry': ['lawrence', 'laurence'],
  'len': ['leonard'],
  'leo': ['leonard', 'leon', 'leonardo'],
  'lou': ['louis', 'lewis'],
  'mac': ['malcolm'],
  'marty': ['martin'],
  'matt': ['matthew'],
  'max': ['maxwell', 'maximus', 'maximilian'],
  'mel': ['melvin'],
  'mick': ['michael'],
  'micky': ['michael'],
  'mike': ['michael'],
  'pat': ['patrick', 'patricia'],
  'pete': ['peter'],
  'phil': ['philip', 'phillip'],
  'ray': ['raymond', 'rayford'],
  'rich': ['richard'],
  'rick': ['richard', 'frederick', 'eric'],
  'ricky': ['richard'],
  'rob': ['robert'],
  'rod': ['rodney', 'roderick'],
  'ron': ['ronald'],
  'ronnie': ['ronald'],
  'sam': ['samuel', 'samson'],
  'steve': ['steven', 'stephen'],
  'ted': ['theodore', 'edward'],
  'tim': ['timothy'],
  'tom': ['thomas'],
  'tommy': ['thomas'],
  'tony': ['anthony', 'antonio'],
  'vic': ['victor'],
  'vinny': ['vincent'],
  'will': ['william', 'willard'],
  'zach': ['zachary', 'zachariah']
}

// Reverse map (full name -> nicknames)
const REVERSE_NICKNAME_MAP = {}
for (const [nickname, fullNames] of Object.entries(NICKNAME_MAP)) {
  fullNames.forEach(fullName => {
    if (!REVERSE_NICKNAME_MAP[fullName]) {
      REVERSE_NICKNAME_MAP[fullName] = []
    }
    if (!REVERSE_NICKNAME_MAP[fullName].includes(nickname)) {
      REVERSE_NICKNAME_MAP[fullName].push(nickname)
    }
  })
}

/**
 * Get possible full names for a nickname
 * @param {string} nickname - Nickname to expand (e.g., "Matt")
 * @returns {Array<string>} - Possible full names (e.g., ["matthew"])
 */
function getFullNames(nickname) {
  const normalized = nickname.toLowerCase().trim()
  return NICKNAME_MAP[normalized] || []
}

/**
 * Get possible nicknames for a full name
 * @param {string} fullName - Full name (e.g., "Matthew")
 * @returns {Array<string>} - Possible nicknames (e.g., ["matt"])
 */
function getNicknames(fullName) {
  const normalized = fullName.toLowerCase().trim()
  return REVERSE_NICKNAME_MAP[normalized] || []
}

/**
 * Check if two names could be nickname variations
 * @param {string} name1 - First name
 * @param {string} name2 - Second name
 * @returns {boolean} - True if they could be nickname variations
 */
function areNicknameVariations(name1, name2) {
  const normalized1 = name1.toLowerCase().trim()
  const normalized2 = name2.toLowerCase().trim()

  // Check if name1 is a nickname of name2
  const fullNamesForName1 = getFullNames(normalized1)
  if (fullNamesForName1.includes(normalized2)) {
    return true
  }

  // Check if name2 is a nickname of name1
  const fullNamesForName2 = getFullNames(normalized2)
  if (fullNamesForName2.includes(normalized1)) {
    return true
  }

  // Check if they're both nicknames of the same full name
  for (const fullName of fullNamesForName1) {
    if (fullNamesForName2.includes(fullName)) {
      return true
    }
  }

  return false
}

/**
 * Generate all possible name variations (nicknames + full names)
 * @param {string} name - Name to generate variations for
 * @returns {Array<string>} - All possible variations
 */
function getNameVariations(name) {
  const normalized = name.toLowerCase().trim()
  const variations = new Set([normalized])

  // Add full names if this is a nickname
  const fullNames = getFullNames(normalized)
  fullNames.forEach(fn => variations.add(fn))

  // Add nicknames if this is a full name
  const nicknames = getNicknames(normalized)
  nicknames.forEach(nn => variations.add(nn))

  return Array.from(variations)
}

module.exports = {
  getFullNames,
  getNicknames,
  areNicknameVariations,
  getNameVariations,
  NICKNAME_MAP,
  REVERSE_NICKNAME_MAP
}
