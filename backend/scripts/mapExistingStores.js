const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const Sale = require("../models/Sale");
const Store = require("../models/Store");

const expectedStoreIds = [
  "STR-1006",
  "STR-1010",
  "STR-1026",
  "STR-1038",
  "STR-1044",
  "STR-1074",
  "STR-1075",
  "STR-1080",
  "STR-1082",
  "STR-1085",
  "STR-1094",
  "STR-1105",
  "STR-1107",
  "STR-1109",
  "STR-1114",
  "STR-1145",
  "STR-1148",
  "STR-1149",
  "STR-1157",
  "STR-1163",
  "STR-1194",
  "STR-1198",
  "STR-1203",
  "STR-1219",
  "STR-1222",
  "STR-1229",
  "STR-1234",
  "STR-1235",
  "STR-1237",
  "STR-1253",
  "STR-1255",
  "STR-1305",
  "STR-1308",
  "STR-1335",
  "STR-1338",
  "STR-1344",
  "STR-1348",
  "STR-1350",
  "STR-1353",
  "STR-1369",
];

const mappings = [
  {
    storeId: "STR-1006",
    name: "Amma Naana Supermarket",
    location:
      "82/100, Pasumpon Muthuramalinga Thevar Road, Raja Annamalaipuram, Tamil Nadu 600018, India",
    latitude: 13.02872,
    longitude: 80.2496,
    sourceUrl: "https://www.google.com/maps?q=13.02872,80.24960",
  },
  {
    storeId: "STR-1010",
    name: "Freshco Supermarket",
    location:
      "16/1, Sait Colony 1st St, Egmore, Chennai, Tamil Nadu 600008, India",
    latitude: 13.0722279,
    longitude: 80.2533875,
    sourceUrl:
      "https://www.google.com/maps/place/Freshco+Supermarket/@13.0722279,80.2533875,17z",
  },
  {
    storeId: "STR-1026",
    name: "Smart Bazaar",
    location:
      "L/2, Ambience Mall, SN UGF/36, LGF/32, Nelson Mandela Marg, Vasant Kunj, New Delhi, Delhi 110070, India",
    latitude: 28.5417344,
    longitude: 77.1549294,
    sourceUrl: "https://www.openstreetmap.org/node/14046155145",
  },
  {
    storeId: "STR-1038",
    name: "Hiranandani Dmart",
    location:
      "10-A, Orchard Ave, Hiranandani Gardens, Powai, Mumbai, Maharashtra 400076, India",
    latitude: 19.1166239,
    longitude: 72.9104481,
    sourceUrl:
      "https://www.google.com/maps/place/Hiranandani+Dmart/@19.1166239,72.9104481,17z",
  },
  {
    storeId: "STR-1044",
    name: "Ratnadeep Supermarket",
    location:
      "H NO: 8, PLOT NO: F 11 & 12, Yousufguda Main Rd, near Vohra Towers, Rahmat Nagar, Madhura Nagar, Hyderabad, Telangana 500038, India",
    latitude: 17.4366593,
    longitude: 78.4337777,
    sourceUrl:
      "https://www.google.com/maps/place/Ratnadeep+Supermarket/@17.4366593,78.4337777,17z",
  },
  {
    storeId: "STR-1074",
    name: "More Supermarket - KORAMANGALA - 2",
    location:
      "472, Adugodi Main Rd, Koramangala 8th Block, Koramangala, Bengaluru, Karnataka 560095, India",
    latitude: 12.9423145,
    longitude: 77.6151206,
    sourceUrl:
      "https://www.google.com/maps/place/More+Supermarket+-+KORAMANGALA+-+2/@12.9423145,77.6151206,17z",
  },
  {
    storeId: "STR-1075",
    name: "Reliance SMART Bazaar",
    location:
      "City Gold Center I, Sardar Patel Ring Rd, opposite Rapid Action Force Headquarters, Vastral, Ahmedabad, Gujarat 382418, India",
    latitude: 22.9880523,
    longitude: 72.6636914,
    sourceUrl: "https://www.openstreetmap.org/node/14014984331",
  },
  {
    storeId: "STR-1080",
    name: "Star Bazaar",
    location:
      "Ground Floor, Phoenix Marketcity, Pune-Nagar Rd, Viman Nagar, Pune, Maharashtra 411014, India",
    latitude: 18.5625505,
    longitude: 73.9164007,
    sourceUrl:
      "https://www.google.com/maps/place/Star+Bazaar/@18.5625505,73.9164007,17z",
  },
  {
    storeId: "STR-1082",
    name: "Vijetha Supermarket - KPHB 6th Phase",
    location:
      "KPHB 6th Phase Rd, Vidhura Vihar, Kukatpally, Hyderabad, Telangana 500085, India",
    latitude: 17.4881886,
    longitude: 78.3894591,
    sourceUrl:
      "https://www.google.com/maps/place/Vijetha+Supermarket+-+KPHB+6th+Phase/@17.4881886,78.3894591,17z",
  },
  {
    storeId: "STR-1085",
    name: "D-Mart",
    location:
      "Grand Square Mall, 46, 1st Main Rd, V.O.C Nagar, Velachery, Chennai, Tamil Nadu 600042, India",
    latitude: 12.9719389,
    longitude: 80.2206814,
    sourceUrl:
      "https://www.google.com/maps/place/D-Mart/@12.9719389,80.2206814,17z",
  },
  {
    storeId: "STR-1094",
    name: "Reliance SMART Bazaar",
    location:
      "New Era Mill Compound, Mogul Ln, Matunga West, Mumbai, Maharashtra 400016, India",
    latitude: 19.0314768,
    longitude: 72.8468509,
    sourceUrl: "https://www.openstreetmap.org/node/11298191069",
  },
  {
    storeId: "STR-1105",
    name: "LuLu Hypermarket",
    location: "34/1000, Edapally, Kochi, Ernakulam, Kerala 682024, India",
    latitude: 10.0279384,
    longitude: 76.3078141,
    sourceUrl:
      "https://www.google.com/maps/place/LuLu+Hypermarket/data=!4m7!3m6!1s0x3b080d3c2bf6d70d:0x8ff4c6109f235d0b!8m2!3d10.0279384!4d76.3078141",
  },
  {
    storeId: "STR-1107",
    name: "Vishal Mega Mart",
    location:
      "Plot No. 1, Elevated Ajmer Rd, opposite Government Hostel, Gopalbari, Jaipur, Rajasthan 302006, India",
    latitude: 26.9168945,
    longitude: 75.8004485,
    sourceUrl:
      "https://www.google.com/maps/place/Vishal+Mega+Mart/@26.9168945,75.8004485,17z",
  },
  {
    storeId: "STR-1109",
    name: "DMART",
    location:
      "Sirsi Road, Ganga Colony, Rajendra Nagar, Panchyawala, Jaipur, Rajasthan 302034, India",
    latitude: 26.9214721,
    longitude: 75.7295,
    sourceUrl: "https://www.openstreetmap.org/way/1428312960",
  },
  {
    storeId: "STR-1114",
    name: "Reliance Smart Bazaar",
    location:
      "Paschimanagari, Kothrud, Karve Nagar, Pune, Maharashtra 411038, India",
    latitude: 18.4991655,
    longitude: 73.821795,
    sourceUrl: "https://www.openstreetmap.org/node/1884355789",
  },
  {
    storeId: "STR-1145",
    name: "MORE Supermarket",
    location:
      "Kamineni Hospital Road, Viveka Nanda Nagar, Mansoorabad, Hyderabad, Telangana 500068, India",
    latitude: 17.3455101,
    longitude: 78.5688091,
    sourceUrl: "https://www.openstreetmap.org/way/357129494",
  },
  {
    storeId: "STR-1148",
    name: "Star Bazaar",
    location:
      "Vishal Tower Entrance Path, Prahladnagar, Ahmedabad, Gujarat 380015, India",
    latitude: 23.0168484,
    longitude: 72.5155041,
    sourceUrl: "https://www.openstreetmap.org/way/1005772527",
  },
  {
    storeId: "STR-1149",
    name: "Lulu Hypermarket",
    location:
      "Salem-Kochi-Kanyakumari Road, Kochuveli, Thiruvananthapuram, Kerala 695001, India",
    latitude: 8.5158076,
    longitude: 76.8974562,
    sourceUrl: "https://www.openstreetmap.org/way/1535270932",
  },
  {
    storeId: "STR-1157",
    name: "Vijetha Super Market",
    location:
      "JP Nagar Road, Prasanth Nagar, Miyapur, Hyderabad, Telangana 500049, India",
    latitude: 17.4946955,
    longitude: 78.3482583,
    sourceUrl: "https://www.openstreetmap.org/node/8386727030",
  },
  {
    storeId: "STR-1163",
    name: "DMart",
    location:
      "Punyadham Ashram Road, Krushna Nagar, Kondhwa Budruk, Pune, Maharashtra 411048, India",
    latitude: 18.4576353,
    longitude: 73.892598,
    sourceUrl: "https://www.openstreetmap.org/node/10561419315",
  },
  {
    storeId: "STR-1194",
    name: "Reliance Fresh",
    location:
      "Sant Dnyaneshwar Mauli Marg, Nerul East, Navi Mumbai, Maharashtra 400614, India",
    latitude: 19.0389091,
    longitude: 73.0259136,
    sourceUrl: "https://www.openstreetmap.org/node/4273389599",
  },
  {
    storeId: "STR-1198",
    name: "Nature's Basket",
    location:
      "Road No. 2, Gandhi Nagar, Bandra East, Mumbai, Maharashtra 400017, India",
    latitude: 19.0562641,
    longitude: 72.8477761,
    sourceUrl: "https://www.openstreetmap.org/node/14006259820",
  },
  {
    storeId: "STR-1203",
    name: "Nature's Basket",
    location:
      "Cubic Mall parking exit, Wadavli Village, Chembur, Mumbai, Maharashtra 400074, India",
    latitude: 19.0456054,
    longitude: 72.9029338,
    sourceUrl: "https://www.openstreetmap.org/node/9024157517",
  },
  {
    storeId: "STR-1219",
    name: "Nature's Basket",
    location:
      "Kavi Ram Basakhetre Road, Adarsh Nagar, Oshiwara, Mumbai, Maharashtra 400053, India",
    latitude: 19.1454282,
    longitude: 72.8292549,
    sourceUrl: "https://www.openstreetmap.org/node/7426184248",
  },
  {
    storeId: "STR-1222",
    name: "Nature's Basket",
    location:
      "TL Wasvani Road, Cuffe Parade, Mumbai, Maharashtra 400005, India",
    latitude: 18.914704,
    longitude: 72.8181018,
    sourceUrl: "https://www.openstreetmap.org/node/4048759190",
  },
  {
    storeId: "STR-1229",
    name: "Nature's Basket",
    location:
      "Khwaja Abbas Marg, Juhu, Mumbai, Maharashtra 400049, India",
    latitude: 19.1008959,
    longitude: 72.8278252,
    sourceUrl: "https://www.openstreetmap.org/node/7320270232",
  },
  {
    storeId: "STR-1234",
    name: "Ratnadeep supermarket",
    location:
      "Himayath Nagar Road, Narayanguda, Hyderabad, Telangana 500029, India",
    latitude: 17.3995968,
    longitude: 78.4862354,
    sourceUrl: "https://www.openstreetmap.org/node/7244264230",
  },
  {
    storeId: "STR-1237",
    name: "Ratnadeep Supermarket",
    location:
      "Huda Techno Enclave Road, Vittal Rao Nagar, Madhapur, Hyderabad, Telangana 500081, India",
    latitude: 17.4460891,
    longitude: 78.3847015,
    sourceUrl: "https://www.openstreetmap.org/node/1042229873",
  },
  {
    storeId: "STR-1253",
    name: "Ratnadeep SuperMarket",
    location:
      "Gachibowli-Miyapur Highway, Whitefields, Kothaguda, Hyderabad, Telangana 500084, India",
    latitude: 17.4561835,
    longitude: 78.3646926,
    sourceUrl: "https://www.openstreetmap.org/node/2586288038",
  },
  {
    storeId: "STR-1255",
    name: "Ratnadeep Supermarket",
    location:
      "Road No. 1, Nanakramguda, Hyderabad, Telangana 500032, India",
    latitude: 17.4155088,
    longitude: 78.3407077,
    sourceUrl: "https://www.openstreetmap.org/node/11341063146",
  },
  {
    storeId: "STR-1305",
    name: "Reliance Fresh",
    location:
      "9008, Deshbandhu Gupta Road, Aram Bagh, Paharganj, Delhi 110055, India",
    latitude: 28.645693,
    longitude: 77.2108527,
    sourceUrl: "https://www.openstreetmap.org/node/4415219190",
  },
  {
    storeId: "STR-1308",
    name: "Reliance Fresh",
    location: "Hariom Gahlot Marg, Dwarka, Delhi 110078, India",
    latitude: 28.6185595,
    longitude: 77.0300178,
    sourceUrl: "https://www.openstreetmap.org/node/12368097238",
  },
  {
    storeId: "STR-1335",
    name: "Vishal Mega Mart",
    location:
      "Jaipur Road, Shiv Nagar, Vidyadhar Nagar, Jaipur, Rajasthan 302001, India",
    latitude: 26.969883,
    longitude: 75.7732925,
    sourceUrl: "https://www.openstreetmap.org/node/4141343712",
  },
  {
    storeId: "STR-1338",
    name: "Spencer's Supermarket (bottom level)",
    location: "Gariahat Road, Park Circus, Kolkata, West Bengal 700017, India",
    latitude: 22.5390133,
    longitude: 88.3655357,
    sourceUrl: "https://www.openstreetmap.org/node/6698626686",
  },
  {
    storeId: "STR-1348",
    name: "Reliance Smart",
    location:
      "1402, Bannerghatta Road, Panduranga Nagar, Arekere, Bengaluru, Karnataka 560076, India",
    latitude: 12.8909043,
    longitude: 77.5978268,
    sourceUrl: "https://www.openstreetmap.org/node/6152899108",
  },
  {
    storeId: "STR-1350",
    name: "Dorabjee's",
    location:
      "Lane No. 7, Koregaon Park, Pune, Maharashtra 411001, India",
    latitude: 18.5372632,
    longitude: 73.8998887,
    sourceUrl: "https://www.openstreetmap.org/node/13955720855",
  },
  {
    storeId: "STR-1369",
    name: "Star Bazaar",
    location:
      "Satellite Road, Ramdev Nagar, Ahmedabad, Gujarat 380015, India",
    latitude: 23.0269648,
    longitude: 72.5242142,
    sourceUrl: "https://www.openstreetmap.org/node/4199023908",
  },
];

const validCoordinate = (value, min, max) =>
  Number.isFinite(value) && value >= min && value <= max;

const getReferenceCounts = async (Model, session) => {
  const counts = await Model.aggregate([
    { $group: { _id: "$store", count: { $sum: 1 } } },
  ])
    .session(session)
    .exec();
  return new Map(counts.map((entry) => [String(entry._id), entry.count]));
};

const sameCounts = (first, second) =>
  [...new Set([...first.keys(), ...second.keys()])].every(
    (key) => first.get(key) === second.get(key)
  );

const getUniqueStoresByCode = (stores, codes) => {
  const storesByCode = new Map();
  for (const store of stores) {
    if (!codes.includes(store.code)) continue;
    const matches = storesByCode.get(store.code) || [];
    matches.push(store);
    storesByCode.set(store.code, matches);
  }
  return storesByCode;
};

const getStoreSnapshots = (stores, names) =>
  new Map(
    names.map((name) => {
      const matches = stores.filter((store) => store.name === name);
      if (matches.length !== 1) {
        throw new Error(`Expected exactly one "${name}" record; found ${matches.length}`);
      }
      return [name, JSON.stringify(matches[0])];
    })
  );

const verifyDatasetCodes = (stores, label) => {
  const storesByCode = getUniqueStoresByCode(stores, expectedStoreIds);
  const missingIds = expectedStoreIds.filter((id) => !storesByCode.has(id));
  const duplicateIds = expectedStoreIds.filter(
    (id) => (storesByCode.get(id) || []).length > 1
  );
  if (missingIds.length || duplicateIds.length) {
    throw new Error(
      `${label}: missing dataset codes: ${missingIds.join(", ") || "none"}; ` +
        `duplicate dataset codes: ${duplicateIds.join(", ") || "none"}`
    );
  }
  return storesByCode;
};

const verifyNoDuplicateCodes = (stores, label) => {
  const codes = stores.map((store) => store.code).filter(Boolean);
  if (new Set(codes).size !== codes.length) {
    const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
    throw new Error(`${label}: duplicate Store codes: ${[...new Set(duplicates)].join(", ")}`);
  }
};

const verifyMappingCoordinates = () => {
  const coordinates = new Set();
  for (const mapping of mappings) {
    const key = `${mapping.latitude},${mapping.longitude}`;
    if (coordinates.has(key)) {
      throw new Error(`Duplicate mapping coordinates at ${mapping.storeId}`);
    }
    coordinates.add(key);
  }
};

const verifyUpdatedStores = (stores, unresolvedIds) => {
  if (stores.length !== 42) {
    throw new Error(`Expected 42 Store documents after mapping; found ${stores.length}`);
  }
  verifyNoDuplicateCodes(stores, "Post-write verification");
  const storesByCode = verifyDatasetCodes(stores, "Post-write verification");
  const mappedStores = mappings.map(
    (mapping) => storesByCode.get(mapping.storeId)[0]
  );
  if (
    mappedStores.some(
      (store) =>
        !validCoordinate(store.latitude, -90, 90) ||
        !validCoordinate(store.longitude, -180, 180)
    )
  ) {
    throw new Error("Post-write verification: mapped coordinates are missing or invalid");
  }
  if (mappedStores.length !== 37) {
    throw new Error(`Expected 37 mapped dataset stores; found ${mappedStores.length}`);
  }

  for (const storeId of unresolvedIds) {
    const store = storesByCode.get(storeId)[0];
    if (store.latitude !== undefined || store.longitude !== undefined) {
      throw new Error(
        `Post-write verification: ${storeId} should remain without coordinates`
      );
    }
  }

  return storesByCode;
};

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  const mappedIds = new Set();
  for (const mapping of mappings) {
    if (mappedIds.has(mapping.storeId)) {
      throw new Error(`Duplicate mapping for ${mapping.storeId}`);
    }
    mappedIds.add(mapping.storeId);
    if (
      !mapping.name ||
      !mapping.location ||
      !mapping.sourceUrl ||
      !validCoordinate(mapping.latitude, -90, 90) ||
      !validCoordinate(mapping.longitude, -180, 180)
    ) {
      throw new Error(`Invalid mapping for ${mapping.storeId}`);
    }
  }

  if (mappings.length !== 37) {
    throw new Error(`Expected 37 verified mappings; found ${mappings.length}`);
  }

  const unresolvedIds = expectedStoreIds.filter((id) => !mappedIds.has(id));
  if (unresolvedIds.join(",") !== "STR-1235,STR-1344,STR-1353") {
    throw new Error(`Unexpected unresolved IDs: ${unresolvedIds.join(", ")}`);
  }
  verifyMappingCoordinates();

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
  });
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB connection was not established");
  }

  const session = await mongoose.startSession();
  try {
    let updateCount = 0;
    await session.withTransaction(async () => {
      const storesBefore = await Store.find({}).session(session).lean();
      if (storesBefore.length !== 42) {
        throw new Error(
          `Pre-write verification: expected 42 Store documents; found ${storesBefore.length}`
        );
      }
      verifyNoDuplicateCodes(storesBefore, "Pre-write verification");
      const storesByCode = verifyDatasetCodes(
        storesBefore,
        "Pre-write verification"
      );
      const unresolvedBefore = unresolvedIds.map(
        (id) => storesByCode.get(id)[0]
      );
      const preservedStoreSnapshots = getStoreSnapshots(storesBefore, [
        "Main Store",
        "Anna Nagar Store",
      ]);
      const unresolvedStoreSnapshots = new Map(
        unresolvedIds.map((id, index) => [
          id,
          JSON.stringify(unresolvedBefore[index]),
        ])
      );
      const inventoryBefore = await getReferenceCounts(Inventory, session);
      const salesBefore = await getReferenceCounts(Sale, session);

      console.log("Pre-write checks passed.");
      console.log("37 existing Store records to update:");
      for (const mapping of mappings) {
        console.log(
          `  ${mapping.storeId} | ${mapping.name} | ${mapping.location} | ` +
            `${mapping.latitude}, ${mapping.longitude} | ${mapping.sourceUrl}`
        );
      }
      console.log(
        `Skipped unchanged: ${unresolvedIds.join(", ")}; Main Store; Anna Nagar Store`
      );

      const operations = mappings.map((mapping) => ({
        updateOne: {
          filter: { code: mapping.storeId },
          update: {
            $set: {
              name: mapping.name,
              location: mapping.location,
              latitude: mapping.latitude,
              longitude: mapping.longitude,
            },
          },
        },
      }));
      const result = await Store.bulkWrite(operations, {
        ordered: true,
        session,
      });
      if (result.matchedCount !== mappings.length) {
        throw new Error(
          `Expected to match 37 existing stores; matched ${result.matchedCount}`
        );
      }
      updateCount = result.matchedCount;

      const [storesAfter, inventoryAfter, salesAfter] = await Promise.all([
        Store.find({}).session(session).lean(),
        getReferenceCounts(Inventory, session),
        getReferenceCounts(Sale, session),
      ]);
      const storesAfterByCode = verifyUpdatedStores(storesAfter, unresolvedIds);
      const invalidMappings = mappings.filter((mapping) => {
        const store = storesAfterByCode.get(mapping.storeId)[0];
        return (
          store.name !== mapping.name ||
          store.location !== mapping.location ||
          store.latitude !== mapping.latitude ||
          store.longitude !== mapping.longitude
        );
      });
      if (invalidMappings.length) {
        throw new Error(
          `Post-write verification failed for: ${invalidMappings
            .map((mapping) => mapping.storeId)
            .join(", ")}`
        );
      }

      const unresolvedChanged = unresolvedIds.filter(
        (id, index) =>
          JSON.stringify(storesAfterByCode.get(id)[0]) !==
          unresolvedStoreSnapshots.get(id)
      );
      if (unresolvedChanged.length) {
        throw new Error(
          `Unresolved Store records changed: ${unresolvedChanged.join(", ")}`
        );
      }
      const preservedStoresAfter = getStoreSnapshots(storesAfter, [
        "Main Store",
        "Anna Nagar Store",
      ]);
      for (const [name, snapshot] of preservedStoreSnapshots) {
        if (preservedStoresAfter.get(name) !== snapshot) {
          throw new Error(`${name} changed during the mapping update`);
        }
      }

      const originalIds = new Set(storesBefore.map((store) => String(store._id)));
      const resultingIds = new Set(storesAfter.map((store) => String(store._id)));
      if (
        originalIds.size !== resultingIds.size ||
        [...originalIds].some((id) => !resultingIds.has(id))
      ) {
        throw new Error("Store document IDs changed during the mapping update");
      }
      if (
        !sameCounts(inventoryBefore, inventoryAfter) ||
        !sameCounts(salesBefore, salesAfter)
      ) {
        throw new Error("Inventory or Sale store references changed");
      }

      console.log("Post-write checks passed inside transaction.");
    });
    console.log("StockSense geographic mapping update committed.");
    console.log(`Total Store documents: 42`);
    console.log(`Dataset Store codes present exactly once: 40/40`);
    console.log(`Records updated: ${updateCount}`);
    console.log(`Records skipped: ${unresolvedIds.length} pending + 2 preserved named stores`);
    console.log(`Mapped dataset stores: ${mappings.length}/40`);
    console.log(`Unmapped pending stores: ${unresolvedIds.join(", ")}`);
    console.log("Mapped coordinates are valid and unique.");
    console.log("Inventory and Sale store reference counts preserved.");
    console.log("Store _id values preserved; no documents created or deleted.");
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error("Store geographic mapping failed:", error.message);
  process.exitCode = 1;
});
