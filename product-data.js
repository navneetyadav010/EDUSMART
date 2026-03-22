(function () {
  "use strict";

  function makeSvgDataUri(svg) {
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  function createSneakerIllustration(options) {
    var name = options.name;
    var primary = options.primary;
    var secondary = options.secondary;
    var accent = options.accent;
    var glow = options.glow;
    var outsole = options.outsole;
    var label = options.label;
    var rotation = options.rotation || -9;
    var shadowOpacity = options.shadowOpacity || 0.28;
    var stripeOpacity = options.stripeOpacity || 0.9;

    var svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" role="img" aria-label="' + name + '">',
      "  <defs>",
      '    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
      '      <stop offset="0%" stop-color="#050816" />',
      '      <stop offset="100%" stop-color="#11172e" />',
      "    </linearGradient>",
      '    <linearGradient id="upper" x1="10%" y1="0%" x2="90%" y2="100%">',
      '      <stop offset="0%" stop-color="' + primary + '" />',
      '      <stop offset="100%" stop-color="' + secondary + '" />',
      "    </linearGradient>",
      '    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">',
      '      <stop offset="0%" stop-color="' + accent + '" stop-opacity="1" />',
      '      <stop offset="100%" stop-color="' + glow + '" stop-opacity="0.55" />',
      "    </linearGradient>",
      '    <linearGradient id="sole" x1="0%" y1="0%" x2="100%" y2="100%">',
      '      <stop offset="0%" stop-color="' + outsole + '" />',
      '      <stop offset="100%" stop-color="#d8e6ff" />',
      "    </linearGradient>",
      '    <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">',
      '      <feGaussianBlur stdDeviation="18" result="blur" />',
      '      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>',
      "    </filter>",
      "  </defs>",
      '  <rect width="960" height="640" rx="40" fill="url(#bg)" />',
      '  <circle cx="240" cy="150" r="140" fill="' + glow + '" opacity="0.08" />',
      '  <circle cx="750" cy="120" r="120" fill="' + accent + '" opacity="0.08" />',
      '  <g transform="translate(0, 18) rotate(' + rotation + ' 480 320)">',
      '    <ellipse cx="484" cy="492" rx="258" ry="46" fill="#061121" opacity="' + shadowOpacity + '" />',
      '    <ellipse cx="484" cy="492" rx="216" ry="30" fill="' + glow + '" opacity="0.18" filter="url(#softGlow)" />',
      '    <path d="M252 370c32-48 75-73 130-83l109-23c69-14 147 1 195 37l70 51c17 12 40 21 67 25 30 5 54 23 54 44 0 12-6 21-19 27-14 6-31 9-52 9H320c-44 0-80-10-107-30-21-15-31-34-31-58 0-13 3-25 10-36 6-10 27-24 60-41Z" fill="url(#upper)" />',
      '    <path d="M298 412h525c17 0 26 8 26 25 0 13-5 23-16 28s-28 8-51 8H318c-32 0-62-8-90-24-19-10-29-21-29-34 0-10 4-18 12-24 9-6 21-9 37-9Z" fill="url(#sole)" />',
      '    <path d="M342 320c37-32 74-51 111-57l124-19c51-8 109 6 154 37l68 46c20 13 44 22 74 28-7 12-19 18-34 18H351c-32 0-59-8-80-24 18-8 42-18 71-29Z" fill="#f5f9ff" opacity="0.13" />',
      '    <path d="M376 357l180-55c31-9 62-6 93 9l64 31" fill="none" stroke="url(#accent)" stroke-width="18" stroke-linecap="round" stroke-opacity="' + stripeOpacity + '" />',
      '    <path d="M365 331l-36 15M408 319l-31 16M450 307l-30 15M493 298l-29 15M539 292l-28 14" fill="none" stroke="#ebf2ff" stroke-width="8" stroke-linecap="round" opacity="0.68" />',
      '    <path d="M278 433h78M401 433h95M551 433h88M686 433h95" fill="none" stroke="#0d1329" stroke-width="8" stroke-linecap="round" opacity="0.14" />',
      '    <circle cx="274" cy="363" r="19" fill="' + accent + '" opacity="0.94" />',
      '    <circle cx="748" cy="358" r="16" fill="' + glow + '" opacity="0.9" />',
      '    <path d="M312 305c40-16 80-25 120-25" fill="none" stroke="' + glow + '" stroke-width="7" stroke-linecap="round" opacity="0.55" />',
      "  </g>",
      '  <text x="72" y="104" fill="#edf3ff" font-size="58" font-family="Space Grotesk, Arial, sans-serif" font-weight="700">' + name + "</text>",
      '  <text x="72" y="148" fill="' + accent + '" font-size="24" font-family="Inter, Arial, sans-serif" font-weight="600" letter-spacing="6">' + label + "</text>",
      '  <text x="72" y="574" fill="#8ea0c7" font-size="22" font-family="Inter, Arial, sans-serif">AERON atelier performance concept</text>',
      "</svg>"
    ].join("");

    return makeSvgDataUri(svg);
  }

  function buildGallery(name, palette) {
    return [
      createSneakerIllustration({
        name: name,
        label: palette.label + " // profile",
        primary: palette.primary,
        secondary: palette.secondary,
        accent: palette.accent,
        glow: palette.glow,
        outsole: palette.outsole,
        rotation: -8
      }),
      createSneakerIllustration({
        name: name,
        label: palette.label + " // studio",
        primary: palette.secondary,
        secondary: palette.primary,
        accent: palette.glow,
        glow: palette.accent,
        outsole: palette.outsole,
        rotation: 4,
        shadowOpacity: 0.18,
        stripeOpacity: 0.78
      }),
      createSneakerIllustration({
        name: name,
        label: palette.label + " // detail",
        primary: palette.primary,
        secondary: "#1f2740",
        accent: palette.accent,
        glow: palette.glow,
        outsole: "#f7fbff",
        rotation: -14,
        shadowOpacity: 0.22
      })
    ];
  }

  function buildProduct(config) {
    var colors = config.colors.map(function (palette, index) {
      return {
        id: config.id + "-color-" + index,
        name: palette.label,
        primary: palette.primary,
        secondary: palette.secondary,
        accent: palette.accent,
        glow: palette.glow,
        outsole: palette.outsole,
        preview: createSneakerIllustration({
          name: config.name,
          label: palette.label,
          primary: palette.primary,
          secondary: palette.secondary,
          accent: palette.accent,
          glow: palette.glow,
          outsole: palette.outsole,
          rotation: palette.rotation || -9
        }),
        gallery: buildGallery(config.name, palette)
      };
    });

    return {
      id: config.id,
      slug: config.slug,
      name: config.name,
      collection: config.collection,
      category: config.category,
      price: config.price,
      rating: config.rating,
      reviewCount: config.reviewCount,
      badges: config.badges,
      headline: config.headline,
      description: config.description,
      story: config.story,
      supportNote: config.supportNote,
      leadTime: config.leadTime,
      cushioning: config.cushioning,
      drop: config.drop,
      colors: colors,
      sizes: config.sizes,
      image: colors[0].preview,
      gallery: colors[0].gallery,
      heroSummary: config.heroSummary
    };
  }

  var products = [
    buildProduct({
      id: "aurora-x1",
      slug: "aurora-x1",
      name: "Aurora X1",
      collection: "featured",
      category: "Velocity Lab",
      price: 328,
      rating: 4.9,
      reviewCount: 124,
      badges: ["Flagship", "New Drop"],
      headline: "Step Into The Future",
      description: "A reflective knit silhouette suspended above an energy-return chassis made for gallery lights and late-night sprints.",
      story: "Aurora X1 blends a sculpted carbon heel clip, directional mesh airflow, and a luminous sidewall that changes character as light moves across it.",
      supportNote: "Free same-week studio delivery in metro cities.",
      leadTime: "Ships in 48 hours",
      cushioning: "Carbon-reactive foam with dual-density rebound pods.",
      drop: "Midnight capsule // 2026",
      heroSummary: "The signature silhouette engineered for after-dark motion and premium street presence.",
      sizes: [6, 7, 8, 9, 10, 11, 12, 13],
      colors: [
        {
          label: "Neon Noir",
          primary: "#131822",
          secondary: "#2f3548",
          accent: "#7cffbd",
          glow: "#5ef0ff",
          outsole: "#eef3ff",
          rotation: -10
        },
        {
          label: "Frozen Cobalt",
          primary: "#dfe8ff",
          secondary: "#7286d9",
          accent: "#78a6ff",
          glow: "#89fff1",
          outsole: "#fdfefe",
          rotation: -7
        },
        {
          label: "Solar Ember",
          primary: "#231617",
          secondary: "#512325",
          accent: "#ff7d57",
          glow: "#ffd089",
          outsole: "#fde8dd",
          rotation: -13
        }
      ]
    }),
    buildProduct({
      id: "nox-velocity",
      slug: "nox-velocity",
      name: "Nox Velocity",
      collection: "featured",
      category: "Nightline",
      price: 294,
      rating: 4.8,
      reviewCount: 89,
      badges: ["Editors' Pick"],
      headline: "After-hours speed architecture.",
      description: "A stealth trainer with floating lace bridges and a smoked heel chamber tuned for quick cuts and elevated comfort.",
      story: "Every surface on Nox Velocity was refined to feel fast before you move, from the aerodynamic heel scoop to the tensioned lace tunnels.",
      supportNote: "Complimentary concierge sizing support included.",
      leadTime: "Ships next day",
      cushioning: "Aero-foam midsole with flex-groove propulsion.",
      drop: "Velocity edit // 2026",
      heroSummary: "Performance-led minimalism with a luxury nightlife attitude.",
      sizes: [6, 7, 8, 9, 10, 11, 12],
      colors: [
        {
          label: "Phantom Lime",
          primary: "#111319",
          secondary: "#2a3141",
          accent: "#98ff5d",
          glow: "#79ffc9",
          outsole: "#edf3ff"
        },
        {
          label: "Quartz Ash",
          primary: "#dce2eb",
          secondary: "#9aa5bf",
          accent: "#8fe8ff",
          glow: "#78a6ff",
          outsole: "#ffffff"
        }
      ]
    }),
    buildProduct({
      id: "ethos-9",
      slug: "ethos-9",
      name: "Ethos 9",
      collection: "core",
      category: "Studio Core",
      price: 268,
      rating: 4.7,
      reviewCount: 154,
      badges: ["Best Seller"],
      headline: "Quiet luxury, tuned for movement.",
      description: "Ethos 9 strips performance design down to pure proportion, pairing tonal suede overlays with a soft-rebound underfoot platform.",
      story: "Designed for wardrobe versatility, Ethos 9 shifts effortlessly from tailored layers to oversized streetwear without losing technical credibility.",
      supportNote: "Includes a premium dust bag and collector card.",
      leadTime: "Ships in 72 hours",
      cushioning: "Cloud-layer foam with comfort cradle heel support.",
      drop: "Core collection // all season",
      heroSummary: "The everyday luxury runner built to anchor a premium rotation.",
      sizes: [5, 6, 7, 8, 9, 10, 11, 12],
      colors: [
        {
          label: "Sandstone Mist",
          primary: "#e8dfd3",
          secondary: "#b8a795",
          accent: "#ffd089",
          glow: "#ffe5c2",
          outsole: "#fffaf3"
        },
        {
          label: "Slate Cinder",
          primary: "#252832",
          secondary: "#565f73",
          accent: "#78a6ff",
          glow: "#c8d5ff",
          outsole: "#f4f6fb"
        }
      ]
    }),
    buildProduct({
      id: "silica-edge",
      slug: "silica-edge",
      name: "Silica Edge",
      collection: "new",
      category: "Future Foam",
      price: 342,
      rating: 5.0,
      reviewCount: 42,
      badges: ["Limited", "Collector"],
      headline: "Sculptural foam, couture finish.",
      description: "A bold one-piece upper wrapped over a carved translucent sole, built for statement looks with all-day comfort.",
      story: "Silica Edge is our most sculptural release yet, with a fluid chassis silhouette and a luminous undercarriage that glows on the move.",
      supportNote: "Limited pairs with numbered packaging.",
      leadTime: "Pre-order // 10 days",
      cushioning: "Translucent rebound frame with molded side support.",
      drop: "Collector series // 001",
      heroSummary: "A concept-level design turned into a wearable luxury statement.",
      sizes: [6, 7, 8, 9, 10, 11],
      colors: [
        {
          label: "Rose Frost",
          primary: "#f4dce4",
          secondary: "#c9a1ae",
          accent: "#ff7d57",
          glow: "#ffd3db",
          outsole: "#fcf7fb"
        },
        {
          label: "Iris Smoke",
          primary: "#dce3ff",
          secondary: "#9ca9e9",
          accent: "#7e7cff",
          glow: "#b6ecff",
          outsole: "#f8fbff"
        }
      ]
    }),
    buildProduct({
      id: "pulse-runner",
      slug: "pulse-runner",
      name: "Pulse Runner",
      collection: "new",
      category: "Motion Lab",
      price: 286,
      rating: 4.8,
      reviewCount: 67,
      badges: ["New Arrival"],
      headline: "Fast visuals. Soft landing.",
      description: "Pulse Runner balances expressive contour lines with a plush sock-like fit, built for long city loops and quick transitions.",
      story: "The rippling sidewall geometry catches light with every stride, while the hidden heel tab keeps the rear view clean and tailored.",
      supportNote: "Includes alternate reflective laces.",
      leadTime: "Ships in 24 hours",
      cushioning: "Reactive foam shell with adaptive foot wrap.",
      drop: "Motion lab // live now",
      heroSummary: "Street-speed energy wrapped in a softer, more wearable profile.",
      sizes: [6, 7, 8, 9, 10, 11, 12, 13],
      colors: [
        {
          label: "Aurora Ice",
          primary: "#f2fbff",
          secondary: "#bbdce7",
          accent: "#5ef0ff",
          glow: "#89fff1",
          outsole: "#ffffff"
        },
        {
          label: "Storm Signal",
          primary: "#202736",
          secondary: "#48556c",
          accent: "#ff7d57",
          glow: "#ffc28f",
          outsole: "#f6f7fb"
        }
      ]
    }),
    buildProduct({
      id: "nova-terrain",
      slug: "nova-terrain",
      name: "Nova Terrain",
      collection: "core",
      category: "Terrain Luxe",
      price: 318,
      rating: 4.9,
      reviewCount: 73,
      badges: ["Dual Use"],
      headline: "Luxury traction with city composure.",
      description: "A hybrid outdoor sole meets polished upper detailing, giving you rugged confidence without losing the premium atelier finish.",
      story: "Nova Terrain was designed for travel days and weather shifts, with a sculpted lug platform and weather-resistant upper shell.",
      supportNote: "Water-resistant finish with easy-care guide.",
      leadTime: "Ships in 72 hours",
      cushioning: "Trail-ready sole geometry with shock-diffusing heel core.",
      drop: "Terrain capsule // all weather",
      heroSummary: "Utility-driven design elevated through luxury material contrast.",
      sizes: [6, 7, 8, 9, 10, 11, 12],
      colors: [
        {
          label: "Graphite Moss",
          primary: "#1f261f",
          secondary: "#5b6b58",
          accent: "#7cffbd",
          glow: "#d2f0ae",
          outsole: "#f0f4eb"
        },
        {
          label: "Ivory Stone",
          primary: "#f5f0e8",
          secondary: "#c9b7a4",
          accent: "#c3b08f",
          glow: "#ffd089",
          outsole: "#fefcf8"
        }
      ]
    })
  ];

  var testimonials = [
    {
      id: "t1",
      quote: "The site feels like a fashion film you can shop. The 3D viewer sold me before I even read the specs.",
      name: "Jada Monroe",
      role: "Creative Strategist",
      city: "Los Angeles"
    },
    {
      id: "t2",
      quote: "AERON makes performance sneakers feel couture. The fit guidance and finish quality are genuinely premium.",
      name: "Eli Navarro",
      role: "Sneaker Collector",
      city: "New York"
    },
    {
      id: "t3",
      quote: "Silica Edge looks like concept art in real life. Easily one of the boldest drops in my rotation this year.",
      name: "Mina Cho",
      role: "Fashion Editor",
      city: "Seoul"
    }
  ];

  var reviewsByProductId = {
    "aurora-x1": [
      {
        author: "Aarav P.",
        title: "Looks unreal under city lights",
        body: "The glow details are subtle in daylight but incredible at night. Cushioning feels premium, not overly soft.",
        rating: 5
      },
      {
        author: "Sofia L.",
        title: "Design-forward and wearable",
        body: "I expected a concept-shoe compromise, but the fit is excellent and the heel hold is surprisingly secure.",
        rating: 5
      }
    ],
    "nox-velocity": [
      {
        author: "Marco F.",
        title: "Fast silhouette, comfort all day",
        body: "Great for long walks and still sharp enough for evening looks. Phantom Lime is the standout colorway.",
        rating: 5
      }
    ],
    "ethos-9": [
      {
        author: "Clara M.",
        title: "My easiest daily luxury pair",
        body: "This is the pair I reach for when I want understated but elevated. Sandstone Mist goes with everything.",
        rating: 4
      }
    ],
    "silica-edge": [
      {
        author: "Noah T.",
        title: "Feels like a collectible",
        body: "Packaging, finish, and sole geometry all feel special. Rose Frost is a statement without being loud.",
        rating: 5
      }
    ],
    "pulse-runner": [
      {
        author: "Ivy H.",
        title: "Softest ride in the lineup",
        body: "The sock fit and rebound are excellent. Easy recommendation if you want comfort with a futuristic edge.",
        rating: 5
      }
    ],
    "nova-terrain": [
      {
        author: "Dev K.",
        title: "Travel-day essential",
        body: "Took these through rain and airport miles without issue. Grip is strong and the upper still looks refined.",
        rating: 5
      }
    ]
  };

  window.AERON_DATA = {
    brand: {
      name: "AERON Atelier",
      shortName: "AERON",
      strapline: "Luxury streetwear engineered through motion."
    },
    collections: [
      {
        id: "all",
        label: "All silhouettes",
        eyebrow: "Curated rotation",
        description: "Our full premium lineup, spanning concept drops and versatile core essentials."
      },
      {
        id: "featured",
        label: "Featured collection",
        eyebrow: "Hero capsule",
        description: "The statement-making designs anchored by Aurora X1 and Nox Velocity."
      },
      {
        id: "new",
        label: "New arrivals",
        eyebrow: "Fresh drop",
        description: "Latest releases with collector packaging, futuristic forms, and elevated cushioning."
      },
      {
        id: "core",
        label: "Core rotation",
        eyebrow: "Daily luxury",
        description: "Essential silhouettes balancing premium finish, comfort, and everyday styling range."
      }
    ],
    featuredMetrics: [
      { label: "Same-week sell-through", value: "92%" },
      { label: "Average review score", value: "4.9" },
      { label: "Signature colorways", value: "14" }
    ],
    products: products,
    testimonials: testimonials,
    reviewsByProductId: reviewsByProductId,
    stories: [
      {
        title: "Precision Upper Engineering",
        copy: "Sculpted mesh zones, reflective threads, and layered overlays create a silhouette that looks cinematic from every angle."
      },
      {
        title: "Luxury Comfort System",
        copy: "We tune each midsole with soft landings and defined rebound so the experience feels premium the moment you step in."
      },
      {
        title: "Drop-Driven Narrative",
        copy: "Every release has its own palette, accessories, and story language, turning the catalog into an evolving fashion archive."
      }
    ],
    socialLinks: [
      { label: "Instagram", href: "https://instagram.com" },
      { label: "TikTok", href: "https://tiktok.com" },
      { label: "YouTube", href: "https://youtube.com" }
    ]
  };
}());
