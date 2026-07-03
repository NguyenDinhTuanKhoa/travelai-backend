/**
 * Script to safely find and merge duplicate destinations in MongoDB.
 * 
 * Usage:
 *   Dry run (only show duplicates and references):
 *     node src/scripts/dedupDestinations.js
 * 
 *   Execute merge (update references and delete duplicates):
 *     node src/scripts/dedupDestinations.js --commit
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const User = require('../models/User');
const Review = require('../models/Review');
const Itinerary = require('../models/Itinerary');
const ChatHistory = require('../models/ChatHistory');
const UserBehavior = require('../models/UserBehavior');

const COMMIT = process.argv.includes('--commit');

// Global stop words (categories, business types, generic terms, food names, market names)
const GLOBAL_STOP_WORDS = new Set([
  'khu', 'du', 'lich', 'nha', 'hang', 'khach', 'san', 'nha', 'nghi', 'cafe', 'coffee', 'hotel', 'motel', 'villa', 'homestay',
  'quan', 'an', 'tp', 'thanh', 'pho', 'tinh', 'huyen', 'xa', 'phuong', 'viet', 'nam', 'resort', 'kdl', 'sinh', 'thai',
  'coop', 'mart', 'go', 'bigc', 'trung', 'tam', 'ong', 'cua', 'hang', 'dac', 'san', 'di', 'tich', 'danh', 'lam', 'thang', 'canh',
  'chua', 'den', 'dinh', 'mieu', 'am', 'thac', 'ho', 'song', 'suoi', 'bien', 'bai', 'tam', 'dao', 'nui', 'rung', 'doi', 'tours', 'tour',
  'banh', 'xeo', 'bun', 'ca', 'phu', 'quoc', 'hai', 'san', 'pho', 'lau', 'com', 'chao', 'oc', 'nem', 'cho', 'huyen', 'cu', 'lao', 'cham',
  'tho', 'giao', 'xu', 'lang', 'tre', 'vuon', 'trai', 'cay', 'be', 'noi', 'cho', 'ao', 'dam', 'pha', 'mui', 'ban', 'dao', 'vinh', 'cang',
  'ga', 'san', 'bay', 'ben', 'tau', 'xe', 'pha', 'do'
]);

function getNormalizedString(s) {
  if (!s) return '';
  return s.replace(/đ/g, 'd').replace(/Đ/g, 'd')
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^\w\s]/g, "")
          .trim();
}

function getCleanWords(normName, additionalStopWords = new Set()) {
  const words = normName.split(/\s+/).filter(Boolean);
  return new Set(words.filter(w => {
    return !GLOBAL_STOP_WORDS.has(w) && !additionalStopWords.has(w);
  }));
}

function getSimilarity(cleanWords1, cleanWords2, norm1, norm2) {
  if (norm1 === norm2) return 1.0;
  if (cleanWords1.size === 0 || cleanWords2.size === 0) {
    return norm1 === norm2 ? 1.0 : 0.0;
  }
  
  const intersection = new Set([...cleanWords1].filter(x => cleanWords2.has(x)));
  const union = new Set([...cleanWords1, ...cleanWords2]);
  
  return intersection.size / union.size;
}

function isSubset(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return false;
  if (setA.size <= setB.size) {
    for (const elem of setA) {
      if (!setB.has(elem)) return false;
    }
    return true;
  } else {
    for (const elem of setB) {
      if (!setA.has(elem)) return false;
    }
    return true;
  }
}

function areCategoriesCompatible(cat1, cat2) {
  if (cat1 === cat2) return true;
  
  const isFood1 = cat1 === 'restaurant' || cat1 === 'cafe';
  const isFood2 = cat2 === 'restaurant' || cat2 === 'cafe';
  if (isFood1 && isFood2) return true;
  if (isFood1 || isFood2) return false;
  
  const isHotel1 = cat1 === 'hotel';
  const isHotel2 = cat2 === 'hotel';
  if (isHotel1 && isHotel2) return true;
  if (isHotel1 || isHotel2) return false;
  
  const isTemple1 = cat1 === 'temple';
  const isTemple2 = cat2 === 'temple';
  if (isTemple1 && isTemple2) return true;
  if (isTemple1 || isTemple2) return false;
  
  return true;
}

// Disjoint Set (Union-Find) structure
class DisjointSet {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }
  
  find(i) {
    if (this.parent[i] === i) return i;
    this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }
  
  union(i, j) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent[rootI] = rootJ;
      return true;
    }
    return false;
  }
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');
    if (COMMIT) {
      console.log('⚠️ RUNNING IN COMMIT MODE. Changes will be written to the database.');
    } else {
      console.log('ℹ️ RUNNING IN DRY RUN MODE. No changes will be written. Use --commit to apply.');
    }
    
    const destinations = await Destination.find({});
    console.log(`Loaded ${destinations.length} destinations.`);
    
    // Group by city to perform local checks
    const byCity = {};
    destinations.forEach((d, index) => {
      const city = d.location?.city?.toLowerCase()?.trim() || 'unknown';
      if (!byCity[city]) {
        byCity[city] = [];
      }
      byCity[city].push({ d, index });
    });
    
    const ds = new DisjointSet(destinations.length);
    
    // Find duplicates and union them
    for (const [cityName, list] of Object.entries(byCity)) {
      // Create city-specific stop words
      const cityWords = new Set(getNormalizedString(cityName).split(/\s+/).filter(Boolean));
      
      const processedList = list.map(item => {
        const normName = getNormalizedString(item.d.name);
        const cleanWords = getCleanWords(normName, cityWords);
        return {
          index: item.index,
          id: item.d._id.toString(),
          name: item.d.name,
          normName,
          cleanWords,
          category: item.d.category,
          coords: item.d.location?.coordinates || null,
          raw: item.d
        };
      });
      
      for (let i = 0; i < processedList.length; i++) {
        const d1 = processedList[i];
        for (let j = i + 1; j < processedList.length; j++) {
          const d2 = processedList[j];
          
          if (!areCategoriesCompatible(d1.category, d2.category)) continue;
          
          let isDuplicate = false;
          
          // 1. Exact name match
          if (d1.normName === d2.normName && d1.normName !== '') {
            isDuplicate = true;
          }
          
          // 2. High clean name similarity (Jaccard >= 0.75)
          const sim = getSimilarity(d1.cleanWords, d2.cleanWords, d1.normName, d2.normName);
          if (sim >= 0.75) {
            isDuplicate = true;
          }
          
          // 3. Geographic check + clean words match / subset / town match
          if (d1.coords && d1.coords.lat != null && d1.coords.lng != null &&
              d2.coords && d2.coords.lat != null && d2.coords.lng != null) {
            const dist = Math.sqrt(Math.pow(d1.coords.lat - d2.coords.lat, 2) + Math.pow(d1.coords.lng - d2.coords.lng, 2));
            
            if (dist < 0.015) { // General town fallback range
              if (d1.cleanWords.size === 0 && d2.cleanWords.size === 0) {
                // If clean names are empty (generic town descriptor)
                if (d1.normName.includes('tam dao') && d2.normName.includes('tam dao')) {
                  isDuplicate = true;
                } else if (d1.normName.includes('ben tre') && d2.normName.includes('ben tre')) {
                  isDuplicate = true;
                } else if (d1.normName.includes('tra vinh') && d2.normName.includes('tra vinh')) {
                  isDuplicate = true;
                }
              }
            }
            
            if (dist < 0.0005) { // ~55m close range
              if (sim >= 0.65) {
                isDuplicate = true;
              } else if (isSubset(d1.cleanWords, d2.cleanWords)) {
                isDuplicate = true;
              }
            }
          }
          
          if (isDuplicate) {
            ds.union(d1.index, d2.index);
          }
        }
      }
    }
    
    // Group all processed destinations by root
    const processedAll = destinations.map((d, index) => {
      const normName = getNormalizedString(d.name);
      return {
        index,
        id: d._id.toString(),
        name: d.name,
        normName,
        category: d.category,
        isIconic: d.isIconic || false,
        reviewCount: d.reviewCount || 0,
        rating: d.rating || 0,
        imagesCount: d.images?.length || 0,
        raw: d
      };
    });
    
    const groups = {};
    for (let i = 0; i < processedAll.length; i++) {
      const root = ds.find(i);
      if (!groups[root]) {
        groups[root] = [];
      }
      groups[root].push(processedAll[i]);
    }
    
    // Filter groups to only keep duplicate groups (size > 1)
    const duplicateGroups = Object.values(groups).filter(g => g.length > 1);
    console.log(`\nFound ${duplicateGroups.length} duplicate groups.`);
    
    let totalDeleted = 0;
    
    // Process each duplicate group
    for (let gIdx = 0; gIdx < duplicateGroups.length; gIdx++) {
      const group = duplicateGroups[gIdx];
      
      // Determine the primary destination to KEEP
      group.sort((a, b) => {
        if (a.isIconic !== b.isIconic) return b.isIconic ? 1 : -1;
        if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;
        if (a.rating !== b.rating) return b.rating - a.rating;
        if (a.imagesCount !== b.imagesCount) return b.imagesCount - a.imagesCount;
        if (a.name.length !== b.name.length) return a.name.length - b.name.length;
        return a.id.localeCompare(b.id);
      });
      
      const primary = group[0];
      const duplicates = group.slice(1);
      
      console.log(`\n--------------------------------------------------`);
      console.log(`Group #${gIdx + 1} (Size: ${group.length}) in City: "${primary.raw.location?.city || 'Unknown'}"`);
      console.log(`🟢 KEEP Primary: [${primary.category}] "${primary.name}" (${primary.id})`);
      console.log(`   isIconic: ${primary.isIconic}, Reviews: ${primary.reviewCount}, Rating: ${primary.rating}, Images: ${primary.imagesCount}`);
      
      for (const d of duplicates) {
        console.log(`🔴 DELETE Duplicate: [${d.category}] "${d.name}" (${d.id})`);
        console.log(`   isIconic: ${d.isIconic}, Reviews: ${d.reviewCount}, Rating: ${d.rating}, Images: ${d.imagesCount}`);
        totalDeleted++;
        
        // Find reference counts in other collections
        const dupObjectId = new mongoose.Types.ObjectId(d.id);
        const priObjectId = new mongoose.Types.ObjectId(primary.id);
        
        const [userCount, reviewCount, itineraryCount, chatCount, behaviorCount] = await Promise.all([
          User.countDocuments({ savedDestinations: dupObjectId }),
          Review.countDocuments({ destination: dupObjectId }),
          Itinerary.countDocuments({ 'destinations.destination': dupObjectId }),
          ChatHistory.countDocuments({ destinations: dupObjectId }),
          UserBehavior.countDocuments({ 
            $or: [
              { 'viewedDestinations.destination': dupObjectId }, 
              { 'savedDestinations.destination': dupObjectId }
            ] 
          })
        ]);
        
        const refSum = userCount + reviewCount + itineraryCount + chatCount + behaviorCount;
        if (refSum > 0) {
          console.log(`   ⚠️ References found: User=${userCount}, Review=${reviewCount}, Itinerary=${itineraryCount}, Chat=${chatCount}, Behavior=${behaviorCount}`);
        }
        
        if (COMMIT) {
          // 1. Update User savedDestinations
          if (userCount > 0) {
            await User.updateMany(
              { savedDestinations: dupObjectId },
              { $pull: { savedDestinations: dupObjectId } }
            );
            await User.updateMany(
              { _id: { $in: await User.find({ savedDestinations: { $ne: priObjectId } }).select('_id') } },
              { $addToSet: { savedDestinations: priObjectId } }
            );
            console.log(`   ✅ Updated User references.`);
          }
          
          // 2. Update Reviews
          if (reviewCount > 0) {
            await Review.updateMany(
              { destination: dupObjectId },
              { $set: { destination: priObjectId } }
            );
            console.log(`   ✅ Updated Review references.`);
          }
          
          // 3. Update Itineraries
          if (itineraryCount > 0) {
            await Itinerary.updateMany(
              { 'destinations.destination': dupObjectId },
              { $set: { 'destinations.$[elem].destination': priObjectId } },
              { arrayFilters: [{ 'elem.destination': dupObjectId }] }
            );
            console.log(`   ✅ Updated Itinerary references.`);
          }
          
          // 4. Update ChatHistory
          if (chatCount > 0) {
            await ChatHistory.updateMany(
              { destinations: dupObjectId },
              { $pull: { destinations: dupObjectId } }
            );
            await ChatHistory.updateMany(
              { _id: { $in: await ChatHistory.find({ destinations: { $ne: priObjectId } }).select('_id') } },
              { $addToSet: { destinations: priObjectId } }
            );
            console.log(`   ✅ Updated ChatHistory references.`);
          }
          
          // 5. Update UserBehavior
          if (behaviorCount > 0) {
            await UserBehavior.updateMany(
              { 'viewedDestinations.destination': dupObjectId },
              { $set: { 'viewedDestinations.$[elem].destination': priObjectId } },
              { arrayFilters: [{ 'elem.destination': dupObjectId }] }
            );
            await UserBehavior.updateMany(
              { 'savedDestinations.destination': dupObjectId },
              { $set: { 'savedDestinations.$[elem].destination': priObjectId } },
              { arrayFilters: [{ 'elem.destination': dupObjectId }] }
            );
            console.log(`   ✅ Updated UserBehavior references.`);
          }
          
          // 6. Delete the duplicate destination
          await Destination.deleteOne({ _id: dupObjectId });
          console.log(`   ✅ Deleted duplicate destination document.`);
        }
      }
    }
    
    console.log(`\n==================================================`);
    if (COMMIT) {
      console.log(`🎉 Successfully merged duplicate groups. Total deleted destinations: ${totalDeleted}`);
    } else {
      console.log(`🔍 Dry run completed. Total duplicates to delete: ${totalDeleted}`);
      console.log(`👉 Run "node src/scripts/dedupDestinations.js --commit" to execute the merge.`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error in main execution:', err);
    process.exit(1);
  }
}

main();
