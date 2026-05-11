export type ChicagoCommunityAreaNumber =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
  | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30
  | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40
  | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50
  | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60
  | 61 | 62 | 63 | 64 | 65 | 66 | 67 | 68 | 69 | 70
  | 71 | 72 | 73 | 74 | 75 | 76 | 77;

export type CommunityAreaPin = {
  name: string;
  lat: number;
  lng: number;
  descriptors: readonly [string, string] | readonly [string, string, string];
};

export const CHICAGO_COMMUNITY_AREA_PINS = {
  1: {
    name: "Rogers Park",
    lat: 42.0082,
    lng: -87.6659,
    descriptors: ["Lakefront", "Red Line", "Diverse"],
  },
  2: {
    name: "West Ridge",
    lat: 41.9977,
    lng: -87.6896,
    descriptors: ["Devon Avenue", "Residential", "Global dining"],
  },
  3: {
    name: "Uptown",
    lat: 41.9653,
    lng: -87.6579,
    descriptors: ["Entertainment district", "Lakefront", "Red Line"],
  },
  4: {
    name: "Lincoln Square",
    lat: 41.9662,
    lng: -87.6885,
    descriptors: ["Brown Line", "Historic square", "Family-friendly"],
  },
  5: {
    name: "North Center",
    lat: 41.9561,
    lng: -87.6782,
    descriptors: ["Neighborhood taverns", "Roscoe Village", "Brown Line"],
  },
  6: {
    name: "Lake View",
    lat: 41.9484,
    lng: -87.6553,
    descriptors: ["Wrigleyville", "Lakefront", "Nightlife"],
  },
  7: {
    name: "Lincoln Park",
    lat: 41.9217,
    lng: -87.6336,
    descriptors: ["Zoo and parks", "Lakefront", "DePaul"],
  },
  8: {
    name: "Near North Side",
    lat: 41.8973,
    lng: -87.6233,
    descriptors: ["Magnificent Mile", "Riverfront", "High-rise"],
  },
  9: {
    name: "Edison Park",
    lat: 42.0054,
    lng: -87.8175,
    descriptors: ["Metra village", "Quiet residential", "Far Northwest"],
  },
  10: {
    name: "Norwood Park",
    lat: 41.9857,
    lng: -87.8023,
    descriptors: ["Historic homes", "Metra access", "Far Northwest"],
  },
  11: {
    name: "Jefferson Park",
    lat: 41.9706,
    lng: -87.7618,
    descriptors: ["Transit hub", "Bungalow belt", "Northwest Side"],
  },
  12: {
    name: "Forest Glen",
    lat: 41.9782,
    lng: -87.7515,
    descriptors: ["Wooded", "Metra access", "Quiet residential"],
  },
  13: {
    name: "North Park",
    lat: 41.9806,
    lng: -87.7192,
    descriptors: ["University corridor", "River parkland", "Residential"],
  },
  14: {
    name: "Albany Park",
    lat: 41.9679,
    lng: -87.7131,
    descriptors: ["Global dining", "Brown Line", "Dense residential"],
  },
  15: {
    name: "Portage Park",
    lat: 41.9578,
    lng: -87.7658,
    descriptors: ["Six Corners", "Bungalows", "Park-centered"],
  },
  16: {
    name: "Irving Park",
    lat: 41.9528,
    lng: -87.7299,
    descriptors: ["Blue Line", "Historic homes", "Bungalow belt"],
  },
  17: {
    name: "Dunning",
    lat: 41.9595,
    lng: -87.7927,
    descriptors: ["Wright College", "Residential", "Northwest Side"],
  },
  18: {
    name: "Montclare",
    lat: 41.9216,
    lng: -87.8006,
    descriptors: ["Metra access", "Compact", "Residential"],
  },
  19: {
    name: "Belmont Cragin",
    lat: 41.9231,
    lng: -87.769,
    descriptors: ["Bungalow belt", "Family neighborhoods", "Northwest Side"],
  },
  20: {
    name: "Hermosa",
    lat: 41.9293,
    lng: -87.737,
    descriptors: ["Kelvyn Park", "Industrial legacy", "Compact"],
  },
  21: {
    name: "Avondale",
    lat: 41.9397,
    lng: -87.7123,
    descriptors: ["Blue Line", "Milwaukee Avenue", "Food scene"],
  },
  22: {
    name: "Logan Square",
    lat: 41.9282,
    lng: -87.7066,
    descriptors: ["Boulevards", "Blue Line", "Nightlife"],
  },
  23: {
    name: "Humboldt Park",
    lat: 41.9064,
    lng: -87.7019,
    descriptors: ["Park-centered", "Puerto Rican culture", "Boulevards"],
  },
  24: {
    name: "West Town",
    lat: 41.907,
    lng: -87.6768,
    descriptors: ["Wicker Park", "Dining corridors", "Blue Line"],
  },
  25: {
    name: "Austin",
    lat: 41.8879,
    lng: -87.7742,
    descriptors: ["Historic parks", "West Side", "Bungalow blocks"],
  },
  26: {
    name: "West Garfield Park",
    lat: 41.8864,
    lng: -87.717,
    descriptors: ["Conservatory", "Green Line", "Boulevards"],
  },
  27: {
    name: "East Garfield Park",
    lat: 41.8818,
    lng: -87.7043,
    descriptors: ["Garfield Park", "Green Line", "West Side"],
  },
  28: {
    name: "Near West Side",
    lat: 41.8807,
    lng: -87.6742,
    descriptors: ["United Center", "UIC", "Medical District"],
  },
  29: {
    name: "North Lawndale",
    lat: 41.86,
    lng: -87.6992,
    descriptors: ["Douglass Park", "Boulevards", "West Side"],
  },
  30: {
    name: "South Lawndale",
    lat: 41.8442,
    lng: -87.7025,
    descriptors: ["Little Village", "26th Street", "Pink Line"],
  },
  31: {
    name: "Lower West Side",
    lat: 41.8579,
    lng: -87.6691,
    descriptors: ["Pilsen", "Murals", "Pink Line"],
  },
  32: {
    name: "Loop",
    lat: 41.8827,
    lng: -87.6233,
    descriptors: ["Downtown", "Millennium Park", "Transit-rich"],
  },
  33: {
    name: "Near South Side",
    lat: 41.8674,
    lng: -87.6266,
    descriptors: ["South Loop", "Museum Campus", "High-rise"],
  },
  34: {
    name: "Armour Square",
    lat: 41.83,
    lng: -87.6339,
    descriptors: ["Chinatown", "Sox Park", "Red Line"],
  },
  35: {
    name: "Douglas",
    lat: 41.8317,
    lng: -87.6258,
    descriptors: ["Bronzeville", "IIT", "Green Line"],
  },
  36: {
    name: "Oakland",
    lat: 41.8226,
    lng: -87.604,
    descriptors: ["Lakefront edge", "Historic homes", "Quiet residential"],
  },
  37: {
    name: "Fuller Park",
    lat: 41.8095,
    lng: -87.632,
    descriptors: ["Red Line", "Industrial edges", "Small area"],
  },
  38: {
    name: "Grand Boulevard",
    lat: 41.8092,
    lng: -87.6183,
    descriptors: ["Bronzeville", "Green Line", "Historic corridor"],
  },
  39: {
    name: "Kenwood",
    lat: 41.8098,
    lng: -87.5925,
    descriptors: ["Lakefront", "Historic mansions", "Hyde Park edge"],
  },
  40: {
    name: "Washington Park",
    lat: 41.7916,
    lng: -87.6074,
    descriptors: ["Major park", "DuSable Museum", "Green Line"],
  },
  41: {
    name: "Hyde Park",
    lat: 41.7943,
    lng: -87.5907,
    descriptors: ["Lakefront", "University town", "Transit-rich"],
  },
  42: {
    name: "Woodlawn",
    lat: 41.7803,
    lng: -87.6059,
    descriptors: ["Green Line", "Obama Center area", "University edge"],
  },
  43: {
    name: "South Shore",
    lat: 41.7628,
    lng: -87.5657,
    descriptors: ["Lakefront", "Cultural Center", "Metra Electric"],
  },
  44: {
    name: "Chatham",
    lat: 41.7509,
    lng: -87.605,
    descriptors: ["79th Street", "Residential", "South Side"],
  },
  45: {
    name: "Avalon Park",
    lat: 41.7448,
    lng: -87.5867,
    descriptors: ["Park-centered", "Residential", "South Side"],
  },
  46: {
    name: "South Chicago",
    lat: 41.7296,
    lng: -87.5515,
    descriptors: ["Commercial Avenue", "Calumet River", "Historic steel"],
  },
  47: {
    name: "Burnside",
    lat: 41.7212,
    lng: -87.6049,
    descriptors: ["Compact", "Residential", "Cottage Grove"],
  },
  48: {
    name: "Calumet Heights",
    lat: 41.7256,
    lng: -87.5857,
    descriptors: ["Pill Hill", "Stony Island", "Bungalow blocks"],
  },
  49: {
    name: "Roseland",
    lat: 41.6927,
    lng: -87.6226,
    descriptors: ["Michigan Avenue", "Far South Side", "Residential"],
  },
  50: {
    name: "Pullman",
    lat: 41.6929,
    lng: -87.6076,
    descriptors: ["National monument", "Historic district", "Metra Electric"],
  },
  51: {
    name: "South Deering",
    lat: 41.7065,
    lng: -87.5685,
    descriptors: ["Calumet River", "Industrial legacy", "Trumbull Park"],
  },
  52: {
    name: "East Side",
    lat: 41.7146,
    lng: -87.53,
    descriptors: ["Calumet Park", "Indiana border", "Industrial lakefront"],
  },
  53: {
    name: "West Pullman",
    lat: 41.6769,
    lng: -87.6399,
    descriptors: ["Far South Side", "Metra Electric", "Residential"],
  },
  54: {
    name: "Riverdale",
    lat: 41.6553,
    lng: -87.6005,
    descriptors: ["Altgeld Gardens", "Far South Side", "Industrial edges"],
  },
  55: {
    name: "Hegewisch",
    lat: 41.6537,
    lng: -87.546,
    descriptors: ["Metra terminus", "Wetlands", "Indiana border"],
  },
  56: {
    name: "Garfield Ridge",
    lat: 41.7906,
    lng: -87.7685,
    descriptors: ["Archer Avenue", "Midway access", "Bungalow blocks"],
  },
  57: {
    name: "Archer Heights",
    lat: 41.7998,
    lng: -87.7245,
    descriptors: ["Orange Line", "Archer Avenue", "Industrial corridors"],
  },
  58: {
    name: "Brighton Park",
    lat: 41.8171,
    lng: -87.696,
    descriptors: ["California Avenue", "Working-class", "Transit corridors"],
  },
  59: {
    name: "McKinley Park",
    lat: 41.8318,
    lng: -87.6729,
    descriptors: ["Major park", "Orange Line", "Industrial edges"],
  },
  60: {
    name: "Bridgeport",
    lat: 41.8306,
    lng: -87.6461,
    descriptors: ["35th Street", "Sox-adjacent", "Neighborhood dining"],
  },
  61: {
    name: "New City",
    lat: 41.8088,
    lng: -87.6656,
    descriptors: ["Back of the Yards", "47th Street", "Industrial legacy"],
  },
  62: {
    name: "West Elsdon",
    lat: 41.7935,
    lng: -87.7239,
    descriptors: ["Midway edge", "Residential", "Southwest Side"],
  },
  63: {
    name: "Gage Park",
    lat: 41.7939,
    lng: -87.696,
    descriptors: ["Major park", "Southwest Side", "Bungalows"],
  },
  64: {
    name: "Clearing",
    lat: 41.7784,
    lng: -87.7716,
    descriptors: ["Midway edge", "Residential", "Southwest Side"],
  },
  65: {
    name: "West Lawn",
    lat: 41.7584,
    lng: -87.7414,
    descriptors: ["Ford City", "Southwest Side", "Commercial strips"],
  },
  66: {
    name: "Chicago Lawn",
    lat: 41.7719,
    lng: -87.7016,
    descriptors: ["Marquette Park", "63rd Street", "Residential"],
  },
  67: {
    name: "West Englewood",
    lat: 41.7798,
    lng: -87.6639,
    descriptors: ["63rd Street", "Green Line", "Residential"],
  },
  68: {
    name: "Englewood",
    lat: 41.7797,
    lng: -87.6451,
    descriptors: ["Halsted corridor", "Green Line", "South Side"],
  },
  69: {
    name: "Greater Grand Crossing",
    lat: 41.7586,
    lng: -87.5864,
    descriptors: ["75th Street", "Stony Island", "Rail crossings"],
  },
  70: {
    name: "Ashburn",
    lat: 41.7431,
    lng: -87.7037,
    descriptors: ["Southwest Side", "Bungalows", "Park access"],
  },
  71: {
    name: "Auburn Gresham",
    lat: 41.7508,
    lng: -87.644,
    descriptors: ["79th Street", "Bungalow belt", "South Side"],
  },
  72: {
    name: "Beverly",
    lat: 41.7214,
    lng: -87.6719,
    descriptors: ["Historic homes", "Metra Electric", "Hilltop streets"],
  },
  73: {
    name: "Washington Heights",
    lat: 41.7065,
    lng: -87.6441,
    descriptors: ["103rd Street", "Metra Electric", "Residential"],
  },
  74: {
    name: "Mount Greenwood",
    lat: 41.6916,
    lng: -87.7046,
    descriptors: ["111th Street", "Park-centered", "Far Southwest"],
  },
  75: {
    name: "Morgan Park",
    lat: 41.6919,
    lng: -87.6685,
    descriptors: ["Historic village", "Metra Electric", "Far South Side"],
  },
  76: {
    name: "O'Hare",
    lat: 41.9776,
    lng: -87.9047,
    descriptors: ["Airport", "Blue Line", "Regional hub"],
  },
  77: {
    name: "Edgewater",
    lat: 41.9835,
    lng: -87.6588,
    descriptors: ["Lakefront", "Red Line", "High-rises"],
  },
} as const satisfies Record<ChicagoCommunityAreaNumber, CommunityAreaPin>;
