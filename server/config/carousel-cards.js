/**
 * Curated Carousel Cards Configuration
 *
 * This file contains card IDs for notable/iconic cards to display
 * in the home page carousel. These are hand-picked for visual appeal
 * and player recognition.
 *
 * To add new cards:
 * 1. Upload the card image via admin
 * 2. Find the card_id in the admin interface (first column of cards table)
 * 3. Add the card_id to the appropriate category below
 *
 * The carousel will shuffle these cards and display them.
 *
 * Last updated: January 2026 (from production database)
 */

const CURATED_CAROUSEL_CARDS = {
  // ==========================================================================
  // HALL OF FAMERS & LEGENDS (Vintage)
  // ==========================================================================
  legends: [
    90212,   // Mickey Mantle - 1957 Topps Baseball
    56304,   // Roberto Clemente - 1959 Topps Baseball #478
    56340,   // Bob Gibson - 1959 Topps Baseball #514
    774486,  // Bob Gibson - 1960 Topps Baseball #73
    774428,  // Ernie Banks - 1960 Topps Baseball #10
    774420,  // Early Wynn - 1960 Topps Baseball #1
    778554,  // Nolan Ryan - 1981 Donruss Baseball #260
    774367,  // Ryne Sandberg - 1983 Topps Baseball #83
    904939,  // Ken Griffey Jr - 1989 Upper Deck (Iconic Rookie)
    904963,  // Randy Johnson - 1989 Upper Deck #25
  ],

  // ==========================================================================
  // MODERN LEGENDS (Chrome/Relic Cards of HOFers)
  // ==========================================================================
  modernLegends: [
    982523,  // Bob Gibson - 2025 Allen & Ginter Chrome #61
    982525,  // Stan Musial - 2025 Allen & Ginter Chrome #64
    1006835, // Satchel Paige - 2025 Topps Archives Pink Foilboard #62
    1011896, // Rollie Fingers - 2025 Topps Archives Auto
  ],

  // ==========================================================================
  // CURRENT SUPERSTARS
  // ==========================================================================
  currentSuperstars: [
    1008448, // Mike Trout - 2025 Topps Archives Red Hot Foilboard #175
    913196,  // Aaron Judge - 2022 Allen & Ginter Mini Framed Relics
    913322,  // Aaron Judge - 2022 Allen & Ginter Relics B
    1007872, // Aaron Judge - 2025 Topps Archives Green Foilboard
    904131,  // Aaron Judge - 2025 Topps Holiday Short Prints
    980099,  // Roki Sasaki - 2025 Allen & Ginter Mini A&G Back #92
    1015178, // Carlos Correa - 2025 Heritage Chrome Blue Sparkle
    1007949, // Austin Riley - 2025 Topps Archives Green Foilboard #276
    1007915, // Francisco Alvarez - 2025 Topps Archives Green Foilboard #242
    1015258, // Kenley Jansen - 2025 Heritage Chrome Blue Sparkle #709
    1015252, // Anthony Santander - 2025 Heritage Chrome Blue Sparkle #703
  ],

  // ==========================================================================
  // TOP PROSPECTS & RISING STARS
  // ==========================================================================
  risingStars: [
    940708,  // Jackson Chourio - 2025 Topps Update Sandglitter #US233
    1007009, // Marcelo Mayer - 2025 Topps Archives Pink Foilboard
    982561,  // Marcelo Mayer - 2025 Allen & Ginter Chrome #245
    1015237, // Marcelo Mayer - 2025 Heritage Chrome Blue Sparkle #688
    1006957, // Triston Casas - 2025 Topps Archives Pink Foilboard #184
    982541,  // Luisangel Acuna - 2025 Allen & Ginter Chrome #107
    1015081, // Brett Baty - 2025 Heritage Chrome Blue Sparkle #532
    1015175, // Cade Horton - 2025 Heritage Chrome Blue Sparkle #626
    1015124, // Trevor Story - 2025 Heritage Chrome Blue Sparkle #575
    1015052, // Harrison Bader - 2025 Heritage Chrome Blue Sparkle #503
    1014191, // Javier Baez - 2025 Heritage Blue Border #542
  ],

  // ==========================================================================
  // OTHER SPORTS (Football)
  // ==========================================================================
  football: [
    877582,  // Otto Graham - 1950 Bowman Football #45 (HOF QB)
    877410,  // Milt Plum - 1958 Topps Football #5
  ],

  // ==========================================================================
  // CELEBRITIES & NON-PLAYERS (Allen & Ginter Style)
  // ==========================================================================
  celebrities: [
    982597,  // Bryan Cranston - 2025 Allen & Ginter Chrome #290
  ],
}

// Flatten all categories into a single array of card IDs
const getAllCuratedCardIds = () => {
  return Object.values(CURATED_CAROUSEL_CARDS).flat()
}

// Get count of curated cards
const getCuratedCardCount = () => {
  return getAllCuratedCardIds().length
}

module.exports = {
  CURATED_CAROUSEL_CARDS,
  getAllCuratedCardIds,
  getCuratedCardCount
}
