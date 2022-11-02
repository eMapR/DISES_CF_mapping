//this script is intended to take a fc of community forests and find analogue regions with similar biophysical and socio-economic characteristics. The pairing will likely 
//be done in multiple steps. A rough outline might be: 

// 1. Find all (some) possible analogues that have similar shapes (area and perimiter?) and similar forest cover characteristics. Use a baseline year for forest cover.
// 2. Do 1 so that each cf starts from a blank image and therefore there will be a lot of overlap 
// 3. Introduce additional biophysical/socio-economic factors so that we can narrow down the possible options for analogue areas 

//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//import some existing data 
var CFs = ee.FeatureCollection('users/ak_glaciers/All_CF_Cambodia_July_2016'); 
var canopyCover = ee.Image('users/ak_glaciers/reem_cf_outputs/reem_canopy_cover_2000_pts_rma_nbr_timeseries_remapped_full')
var plusMinus = 10; //when we select the thresholds for appropriate forest cover analogues this will determine how far off the CF mean we can be
var numFeats = 2000 //this will produce this many feats per cardnial direction quadrant
var place = 'Cambodia'; 
var aoi = ee.FeatureCollection("USDOS/LSIB/2017").filter(ee.Filter.eq('COUNTRY_NA',place)).geometry()
var moveCoeff = 5; //this will be multiplied by the 0-1 distributed random numbers to define how much polygons are moved
var baselineYr = 'yr_2000'

//////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////Start CODE //////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//define some additional functions 
//define a function to create a randNumber col
function addRandom(fc,colName){
  return fc.randomColumn({
    columnName:colName,
    seed:5
  }); 
}

//define a series of functions that randomly move the polygon around four directional quadrants

function shuffleNW(coords_list,feat){
  var output = coords_list.map(function(coords){
  var first = ee.Number(ee.List(coords).get(0)).subtract(feat.get('lon_move')); 
  var second = ee.Number(ee.List(coords).get(1)).add(feat.get('lat_move'));  
  return ee.List([first,second]); 
  }); 
  return output; 
}

function shuffleSW(coords_list,feat){
  var output = coords_list.map(function(coords){
  var first = ee.Number(ee.List(coords).get(0)).subtract(feat.get('lon_move')); 
  var second = ee.Number(ee.List(coords).get(1)).subtract(feat.get('lat_move'));  
  return ee.List([first,second]); 
  }); 
  return output; 
}

function shuffleSE(coords_list,feat){
  var output = coords_list.map(function(coords){
  var first = ee.Number(ee.List(coords).get(0)).add(feat.get('lon_move')); 
  var second = ee.Number(ee.List(coords).get(1)).subtract(feat.get('lat_move'));  
  return ee.List([first,second]); 
  }); 
  return output; 
}

function shuffleNE(coords_list,feat){
  var output = coords_list.map(function(coords){
  var first = ee.Number(ee.List(coords).get(0)).add(feat.get('lon_move')); 
  var second = ee.Number(ee.List(coords).get(1)).add(feat.get('lat_move'));  
  return ee.List([first,second]); 
  }); 
  return output; 
}

//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//define a big function that will create a new fc for each feature in the CFs featureCollection where each fc is a set of randomly shuffled and filtered versions
function createNewFCs(baseFeat){
  
  //get the coordinate list of a feature - this original format only works for polygons but not multipolygons
  var featCoords = ee.List(ee.Feature(baseFeat).geometry().coordinates().get(0)); 
  //for multipolygons it seems like we'd actually need to map over this element
  // var featCoordsList = ee.Feature(baseFeat).geometry().coordinates(); //this is a list of lists with each sublist being a list of coords
  
  //////////////////////////////////////////////////////////////////////////////////////////////////
  //get the mean canopy cover for a feature
  var mean_cc = canopyCover.select(baselineYr).reduceRegion({
    reducer:ee.Reducer.mean(), 
    geometry:baseFeat.geometry(), 
    scale:30
  }); 
  
  //define a threshold for the example feature
  var cc_threshold = ee.Number(mean_cc.get(baselineYr)).round(); 
  
  //just select the baseline year for now 
  canopyCover = canopyCover.select(baselineYr); 
  //////////////////////////////////////////////////////////////////////////////////////////////////
  //create some numbers to move the feature around randomly 
  var randNumsList = ee.List.sequence(0,numFeats); 
  var randNums = ee.FeatureCollection(randNumsList.map(function(x){ 
    x = ee.Number(x).toInt(); 
    var output = ee.Dictionary(['id',x]); 
    return ee.Feature(null,output); 
  })); 
  
  //add random numbers for both lat and lon
  randNums = addRandom(randNums,'lon_move');
  randNums = addRandom(randNums,'lat_move'); 
  
  //now make the random number columns bigger. By default its a 0-1 distribution but this won't move the polygon enough to cover the country
  randNums = randNums.map(function(feat){
    return feat.set('lon_move',ee.Number(feat.get('lon_move')).multiply(moveCoeff))
              .set('lat_move',ee.Number(feat.get('lat_move')).multiply(moveCoeff)); 
  }); 
  //////////////////////////////////////////////////////////////////////////////////////////////////
  //now make the new polygons
  //build the collection of shuffled polygons. This is currently limited by the length of the list included above.
  //these are redundant and could be made more concise 
  var nwFC = randNums.map(function(feat){
    var geometry = ee.Geometry.Polygon(shuffleNW(featCoords,feat)); 
    var output = ee.Dictionary(['id',feat.get('id')]); 
    return ee.Feature(geometry,output); 
  }); 
  
  var swFC = randNums.map(function(feat){
    var geometry = ee.Geometry.Polygon(shuffleSW(featCoords,feat)); 
    var output = ee.Dictionary(['id',feat.get('id')]); 
    return ee.Feature(geometry,output); 
  }); 
  
  var seFC = randNums.map(function(feat){
    var geometry = ee.Geometry.Polygon(shuffleSE(featCoords,feat)); 
    var output = ee.Dictionary(['id',feat.get('id')]); 
    return ee.Feature(geometry,output); 
  }); 
  
  var neFC = randNums.map(function(feat){
    var geometry = ee.Geometry.Polygon(shuffleNE(featCoords,feat)); 
    var output = ee.Dictionary(['id',feat.get('id')]); 
    return ee.Feature(geometry,output); 
  }); 
  
  //the output for the test feature - this will be the output of a mapped statement 
  var combined = ee.FeatureCollection(nwFC.merge(swFC).merge(seFC).merge(neFC)); 
  
  //above here we would want to insert logic to calculate summary stats for other params/variables besides canopy cover. 
  //these would then also be set as properties here so we can filter on them below. 
  return combined.set('CF_Name_En',baseFeat.get('CF_Name_En'))
                 .set('original_cc',cc_threshold)
                 .set('lower_limit',cc_threshold.subtract(plusMinus))
                 .set('upper_limit',cc_threshold.add(plusMinus)); 
} //end the big function 


//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//create the output featureCollections 
//there is a problem where the design does not accommodate multipolygons correctly, it assumes a polygon geometry.Fix that here.
CFs = CFs.map(function(feat){
  var geomType = feat.geometry().type(); 
  return feat.set('geomType',geomType); 
}); 

var polygons = CFs.filter(ee.Filter.eq('geomType','Polygon')); 
var multiPolygons = CFs.filter(ee.Filter.eq('geomType','MultiPolygon'));  


var combined = ee.FeatureCollection(polygons.map(createNewFCs).flatten()); 

//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//now apply some filters - this isn't a very efficient way to do this but might be an ok first cut
//first just confine to the same country - this doesn't matter physically but will for socio-economic data
combined = combined.filterBounds(aoi); 

//second we make sure that none of the analogues overlap another existing CF
combined = combined.map(function(feat){
  return feat.set('intersects',feat.intersects(CFs.geometry())); 
}); 
combined = combined.filter(ee.Filter.eq('intersects',false)); 

//third get only features that have similar canopy cover to the original feature 
//add a mean canopy cover field to each feature
combined = combined.map(function(feat){
  var mean_cc = canopyCover.reduceRegion({
    reducer:ee.Reducer.mean(), 
    geometry:feat.geometry(), 
    scale:30
  }); 
  return feat.set('new_cc',ee.Number(mean_cc.get(baselineYr))); 
}); 

//then do the actual filtering 
combined = combined.filter(ee.Filter.greaterThanOrEquals({leftField:'lower_limit',rightField:'new_cc'})); 
combined = combined.filter(ee.Filter.lessThanOrEquals({leftField:'upper_limit',rightField:'new_cc'})); 

//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////

//export the result 
Export.table.toAsset({
  collection:combined, 
  description:'CF_randomly_shuffled_featureCollection_polygons_only_'+place, 
  assetId:'reem_cf_outputs/CF_randomly_shuffled_featureCollection_polygons_only_'+place
}); 