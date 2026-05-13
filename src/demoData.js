export function buildDemoHistory() {
  const listings = [];
  const usedIphonePrices = [
    219, 225, 229, 230, 239, 240, 245, 249, 250, 255, 259, 260, 269, 270, 280, 290, 300
  ];

  usedIphonePrices.forEach((price, index) => {
    listings.push({
      listingId: `hist-iphone-used-${index + 1}`,
      category: "phone",
      brand: "Apple",
      model: "iPhone 13",
      storageGb: 128,
      condition: "used_excellent",
      city: "Amman",
      price,
      title: "Apple iPhone 13 128 GB in Amman",
      description: "Used excellent condition, original battery, no repairs.",
      sellerVerified: index % 3 === 0,
      sellerAccountAgeDays: 90 + index
    });
  });

  [320, 329, 340, 345, 350, 366, 369, 380].forEach((price, index) => {
    listings.push({
      listingId: `hist-iphone-new-${index + 1}`,
      category: "phone",
      brand: "Apple",
      model: "iPhone 13",
      storageGb: 128,
      condition: "brand_new",
      city: "Amman",
      price,
      title: "iPhone 13 128GB new warranty",
      description: "Brand new sealed phone with local warranty.",
      sellerVerified: true,
      sellerAccountAgeDays: 365
    });
  });

  [11200, 11600, 11900, 12100, 12400, 12750, 13000, 13200, 13500].forEach((price, index) => {
    listings.push({
      listingId: `hist-corolla-${index + 1}`,
      category: "car",
      brand: "Toyota",
      model: "Corolla",
      year: 2018,
      condition: "used_good",
      city: "Amman",
      mileageKm: 90000 + index * 3000,
      price,
      title: "Toyota Corolla 2018 in Amman",
      description: "Good condition, customs paid, automatic transmission.",
      sellerVerified: index % 2 === 0,
      sellerAccountAgeDays: 200
    });
  });

  [82000, 85000, 87000, 91000, 94000, 96000, 99000, 104000].forEach((price, index) => {
    listings.push({
      listingId: `hist-apartment-${index + 1}`,
      category: "property",
      condition: "used_good",
      city: "Amman",
      district: "Tla Ali",
      areaSqm: 120,
      price,
      title: "Apartment for sale in Tla Ali 120 sqm",
      description: "Three bedrooms, good building, ready to move.",
      sellerVerified: true,
      sellerAccountAgeDays: 500
    });
  });

  return listings;
}

export function iphoneDemoListing(price = 700) {
  return {
    listingId: "demo-iphone-13-128-used",
    category: "phone",
    brand: "Apple",
    model: "iPhone 13",
    storageGb: 128,
    condition: "used_excellent",
    city: "Amman",
    price,
    title: "iPhone 13 128GB used excellent condition",
    description: "Original battery, no repair, excellent condition.",
    sellerVerified: true,
    sellerAccountAgeDays: 420
  };
}

