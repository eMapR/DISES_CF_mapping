//////////////////////////////////////////////////////////////////////////////////
////////////////////// DISES SE ASIA CF COUNTERFACTUALS///////////////////////////
//////////////////////////////////////////////////////////////////////////////////

//this script is intended to take a fc of community forests and find analogue regions with similar biophysical and socio-economic characteristics. The pairing will likely 
//be done in multiple steps. A rough outline might be: 

//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//define some user params 
var CFs = ee.FeatureCollection('users/ak_glaciers/All_CF_Cambodia_July_2016'); 
var numChips = 1000; //number of image chips in a CF boundary 
var place = 'Cambodia'; 
var aoi = ee.FeatureCollection("USDOS/LSIB/2017").filter(ee.Filter.eq('COUNTRY_NA',place)).geometry();
var baselineYr = 'yr_2000'; //for the canopy cover mostly 
var canopyCover_thresh = 15; 
var resolution = 500; 
var seed = 1;  
var PRJ = "EPSG:3857";
var pct = 0.1; 
//define an example cf, this will be a map statement in final version 
var CF_example = CFs.filter(ee.Filter.eq('CF_Name_En','Thmada Ou Teuk Kheav')); 
//add a distance to boundary 
// var cf_dist = CF_example.distance().clip(CF_example)

//define some predictor variables - this could be exapanded for socio economic data 
var roads = ee.FeatureCollection('projects/ee-dises-cf-project/assets/uploads/gis_osm_roads_free_1');
var road_dist = roads.distance();
var canopyCover = ee.Image('users/ak_glaciers/reem_cf_outputs/reem_canopy_cover_2000_pts_rma_nbr_timeseries_remapped_full');
var non_forest_mask = ee.Image("UMD/hansen/global_forest_change_2021_v1_9").select('treecover2000').lte(canopyCover_thresh); 
// var dist_to_edge = non_forest_mask.distance(ee.Kernel.euclidean(10),false)
var dist_to_edge = non_forest_mask.fastDistanceTransform();
var land_cover = ee.ImageCollection("COPERNICUS/Landcover/100m/Proba-V-C3/Global").filter(ee.Filter.eq('system:index','2019')); 
var dem = ee.Image("USGS/SRTMGL1_003"); 
var terrain = ee.Algorithms.Terrain(dem); 
var slope = terrain.select('slope'); 
var aspect = terrain.select('aspect'); 

//////////////////////////////////////////////////////////////////////////////////////////////////
// sjghasdkhga
//try also a raster version from https://medium.com/google-earth/random-samples-with-buffering-6c8737384f8c
function generate_img_chips(bounds,resolution){
  // Generate a random image of integers in Albers projection at the specified cell size.
  var proj = ee.Projection("EPSG:3857").atScale(resolution); 
  var cells = ee.Image.random(seed).multiply(1000000).int().clip(bounds).reproject(proj); 
  // Map.addLayer(cells.randomVisualizer(),{},'cells'); 
  
  // Generate another random image and select the maximum random value 
  // in each grid cell as the sample point.
  var random = ee.Image.random(seed).multiply(1000000).int(); 
  var maximum = cells.addBands(random).reduceConnectedComponents(ee.Reducer.max()); 
    
  // Find all the points that are local maximums.
  var points = random.eq(maximum).selfMask().clip(CF_example); 
  
  // Create a mask to remove every pixel with even coordinates in either X or Y.
  // Using the double not to avoid floating point comparison issues.
  var mask = ee.Image.pixelCoordinates(proj)
      .expression("!((b('x') + 0.5) % 2 != 0 || (b('y') + 0.5) % 2 != 0)"); 
  var strictCells = cells.updateMask(mask).reproject(proj); 
  Map.addLayer(strictCells.randomVisualizer(),{},'strict cells'); 
  
  var strictMax = strictCells.addBands(random).reduceConnectedComponents(ee.Reducer.max()); 
  var strictPoints = random.eq(strictMax).selfMask().clip(bounds); 
  // Map.addLayer(strictPoints.reproject(proj.scale(1/16, 1/16)), {palette: ["white"]},'points')
  
  //these become the image chip centroids 
  var centroids = strictPoints.reduceToVectors({
    reducer: ee.Reducer.countEvery(), 
    geometry: bounds,
    crs: proj.scale(1/16, 1/16), 
    geometryType: "centroid", 
    maxPixels: 1e13
  }); 
  
  //add an id column to the points 
  centroids = centroids.randomColumn('id',seed); 
  centroids = centroids.map(function(ft){
    return ft.set('id',ee.Number(ft.get('id')).multiply(10000000).toInt()); //this scaler is somewhat arbitrary 
  }); 
  // print('centroid size is: ',centroids.size())
  // Add a buffer around each point that is the requested spacing size for visualization.
  // var buffer = samples.map(function(f) { return f.buffer(ee.Number(cellSize).divide(2)) })
  var PRJ = "EPSG:3857";
  
  var error = ee.ErrorMargin(1, 'projected');
  var img_chips = centroids.map(function(pt){
    return ee.Feature(pt.geometry()).buffer(resolution / 2, error, PRJ).bounds(error, PRJ).set('id',pt.get('id'));  
  }); 
  return ee.List([img_chips,centroids]); 
  
}

var img_chips = ee.FeatureCollection(generate_img_chips(CF_example,resolution).get(0));
var centroids = ee.FeatureCollection(generate_img_chips(CF_example,resolution).get(1));

////////////////////////////////////////////////////////////////////////////////
//collect attribute data 

function get_aoi_stat(img,feat,band,source,reducer){
  band = ee.String(band); 
  source = ee.String(source); 
  var mean = img.reduceRegion({
    reducer:reducer,
    geometry:feat.geometry(),
    scale:30,
    tileScale:4,
    maxPixels:1e13
  }); 
  return feat.set(source,ee.Number(mean.get(band))); 
}

////////////////////////////////////////////////////////////////////////////////
//add predictor variable values 
//add canopy cover
img_chips = img_chips.map(function(feat){
return get_aoi_stat(canopyCover.select(baselineYr),feat,baselineYr,'canopyCover',ee.Reducer.mean());  
}); 

//add distance to road 
img_chips = img_chips.map(function(feat){
  return get_aoi_stat(road_dist,feat,'distance','dist_to_rd',ee.Reducer.mean());  
}); 

//add distance to edge
var pts_dist = centroids.map(function(feat){
  return get_aoi_stat(dist_to_edge,feat,'distance','dist_to_edge',ee.Reducer.first()); 
}); 
img_chips = img_chips.map(function(f){
  var f_pt = pts_dist.filter(ee.Filter.eq('id',f.get('id'))).first(); 
  return f.set('dist_to_edge',f_pt.get('dist_to_edge')); 
}); 

//add slope data 
img_chips = img_chips.map(function(feat){
  return get_aoi_stat(slope,feat,'slope','slope',ee.Reducer.mean());  
}); 

//add aspect data 
img_chips = img_chips.map(function(feat){
  return get_aoi_stat(aspect,feat,'aspect','aspect',ee.Reducer.mean());  
}); 

//add also a landcover map - this can/should be switched out for ag suitability at some point
//TODO need to figure out how to deal with these values in filtering because they're discrete
// img_chips = img_chips.map(function(feat){
//     var general_val = get_aoi_stat(land_cover,feat,'discrete_classification','landcover',ee.Reducer.mode());  
//     general_val = general_val.set('landcover_bin',ee.Number(general_val.get('landcover')).eq(40))
//   return general_val
// }); 

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
//then add some random image chips

//there is an issue here where we can create these in two different ways, by using random points and buffering them into squares or by creating rasters and making those into points
//it doesn't work very well to make the raster thing for the full country at a pixel size that makes sense because its too big

var analogues = ee.FeatureCollection.randomPoints(aoi,numChips); 
analogues = analogues.randomColumn('id',seed); 
analogues = analogues.map(function(ft){
  return ft.set('id',ee.Number(ft.get('id')).multiply(10000000).toInt()); //this scaler is somewhat arbitrary 
}); 

var error = ee.ErrorMargin(1, 'projected');
var analogue_chips = analogues.map(function(pt){
  return ee.Feature(pt.geometry()).buffer(resolution / 2, error, PRJ).bounds(error, PRJ).set('id',pt.get('id'));  
}); 

//do a little filtering
//first remove things that overlap other CFs
var intersect = function(feature){

  var fc = analogue_chips.filterBounds(feature.geometry()).map(function(f){
    var intersects = feature.geometry().intersects(f.geometry());
    return(f.set({intersects: intersects}));
  });
  // aggregate the "intersects" to an array and get the frequency of TRUE.
  // Add that result as a property to the feature.  Any overlaps greater than 1
  // means the feature overlaps with a different feature.
  var status = ee.List(fc.aggregate_array("intersects")).frequency(true);
  return(feature.set({overlaps: status}));

};

var newFields = analogue_chips.map(intersect);
newFields = newFields.filter(ee.Filter.lte('overlaps',1));

//add canopy cover
analogue_chips = analogue_chips.map(function(feat){
return get_aoi_stat(canopyCover.select(baselineYr),feat,baselineYr,'canopyCover',ee.Reducer.mean());  
}); 

//add distance to road 
analogue_chips = analogue_chips.map(function(feat){
return get_aoi_stat(road_dist,feat,'distance','dist_to_rd',ee.Reducer.mean());  
}); 

//add distance to edge
var analogue_pts_dist = analogues.map(function(feat){
  return get_aoi_stat(dist_to_edge,feat,'distance','dist_to_edge',ee.Reducer.first()); 
}); 

analogue_chips = analogue_chips.map(function(f){
  var f_pt = analogue_pts_dist.filter(ee.Filter.eq('id',f.get('id'))).first();
  return ee.Feature(f.set('dist_to_edge',f_pt.get('dist_to_edge')));
}); 

//add slope data 
analogue_chips = analogue_chips.map(function(feat){
  return get_aoi_stat(slope,feat,'slope','slope',ee.Reducer.mean());  
}); 

//add aspect data 
analogue_chips = analogue_chips.map(function(feat){
  return get_aoi_stat(aspect,feat,'aspect','aspect',ee.Reducer.mean());  
}); 

//add landcover - could substitute for ag suitability or add in addition
// analogue_chips = analogue_chips.map(function(feat){
//   var general_val = get_aoi_stat(land_cover,feat,'discrete_classification','landcover',ee.Reducer.mode());  
//   general_val = general_val.set('landcover_bin',ee.Number(general_val.get('landcover')).eq(40))
//   return general_val
// }); 

///////////////////////////////////////////////////////////////////////////////////////////
//now remove some possible image chips based on filters and relationship to base chips 

//first we take out the ones that overlap other CFs
var filterInside = ee.Filter.bounds(CFs);
var filterNot = filterInside.not();
analogue_chips = analogue_chips.filter(filterNot); 

//TODO need to decide if we want to have an image chip from inside the CF match a specific image chip on the outside or if we just want the two samples
//to have similar central tendencies 

function upper_lower_limit_filter_func(original_chips,counter_chips,property,lower_limit,upper_limit,pct_diff){
  var filtered = original_chips.map(function(f){
    var max_val = ee.Number(f.get(property)); 
    max_val = max_val.add(max_val.multiply(pct_diff)); 
    
    max_val = ee.Algorithms.If(max_val.gt(upper_limit),
                              upper_limit,
                              max_val); 
    
    var min_val = ee.Number(f.get(property)); 
    min_val = min_val.subtract(min_val.multiply(pct_diff)); 
    min_val = ee.Algorithms.If(min_val.lt(lower_limit),
                               lower_limit,
                               min_val); 
    //cast these vals
    min_val = ee.Number(min_val); 
    max_val = ee.Number(max_val);
    return counter_chips.filter(ee.Filter.and(ee.Filter.gte(property,min_val),ee.Filter.lte(property,max_val))); 
  }); 
  return filtered; 
}

function lower_limit_filter_func(original_chips,counter_chips,property,lower_limit,pct_diff){
  var filtered = original_chips.map(function(f){
    var max_val = ee.Number(f.get(property)); 
    max_val = max_val.add(max_val.multiply(pct_diff)); 
    
    var min_val = ee.Number(f.get(property)); 
    min_val = min_val.subtract(min_val.multiply(pct_diff)); 
    min_val = ee.Algorithms.If(min_val.lt(lower_limit),
                               lower_limit,
                               min_val); 
    //cast these vals
    min_val = ee.Number(min_val); 
    max_val = ee.Number(max_val);
    return counter_chips.filter(ee.Filter.and(ee.Filter.gte(property,min_val),ee.Filter.lte(property,max_val))); 
  }); 
  return filtered; 
}

function upper_limit_filter_func(original_chips,counter_chips,property,upper_limit,pct_diff){
  var filtered = original_chips.map(function(f){
    var max_val = ee.Number(f.get(property)); 
    max_val = max_val.add(max_val.multiply(pct_diff)); 
    max_val = ee.Algorithms.If(max_val.gt(upper_limit),
                               upper_limit,
                               max_val); 
    
    var min_val = ee.Number(f.get(property)); 
    min_val = min_val.subtract(min_val.multiply(pct_diff)); 
    
    //cast these vals
    min_val = ee.Number(min_val); 
    max_val = ee.Number(max_val);
    return counter_chips.filter(ee.Filter.and(ee.Filter.gte(property,min_val),ee.Filter.lte(property,max_val))); 
  }); 
  return filtered; 
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//apply the filters
//first canopy cover 
var counters_filtered = ee.FeatureCollection(upper_lower_limit_filter_func(img_chips,analogue_chips,'canopyCover',0,100,pct).flatten().distinct('id')); 
//then dist to road
counters_filtered = ee.FeatureCollection(lower_limit_filter_func(img_chips,counters_filtered,'dist_to_rd',0,pct).flatten().distinct('id')); 
//then dist to edge
counters_filtered = ee.FeatureCollection(lower_limit_filter_func(img_chips,counters_filtered,'dist_to_edge',0,pct).flatten().distinct('id')); 
//then slope
counters_filtered = ee.FeatureCollection(upper_lower_limit_filter_func(img_chips,counters_filtered,'slope',0,90,pct).flatten().distinct('id')); 
//then aspect 
counters_filtered = ee.FeatureCollection(upper_lower_limit_filter_func(img_chips,counters_filtered,'aspect',0,360,pct).flatten().distinct('id')); 

Export.table.toAsset({
  collection:counters_filtered,
  description:'image_chip_counterfactual_testing_w_terrain',
  assetId:'general_exports'+'/image_chip_counterfactual_testing_w_terrain'
}); 


// Define the chart and print it to the console.
// var cc_chart =
//     ui.Chart.feature
//         .histogram({features: analogue_chips, property: 'canopyCover', maxBuckets: 30})
//         .setOptions({
//           title: 'Canopy Cover analogues',
//           hAxis: {
//             title: 'Canopy Cover (%)',
//             titleTextStyle: {italic: false, bold: true}
//           },
//           vAxis: {
//             title: 'Mean CC (%)',
//             titleTextStyle: {italic: false, bold: true}
//           },
//           colors: ['1d6b99'],
//           legend: {position: 'none'}
//         });
// print(cc_chart);

// //dist to roads
// var roads_chart =
//     ui.Chart.feature
//         .histogram({features: analogue_chips, property: 'dist_to_rd', maxBuckets: 30})
//         .setOptions({
//           title: 'Distance to Road analogues',
//           hAxis: {
//             title: 'Distance to Roads (m)?',
//             titleTextStyle: {italic: false, bold: true}
//           },
//           vAxis: {
//             title: 'Mean distance?',
//             titleTextStyle: {italic: false, bold: true}
//           },
//           colors: ['1d6b99'],
//           legend: {position: 'none'}
//         });
// print(roads_chart);

// //dist to edge
// var edge_chart =
//     ui.Chart.feature
//         .histogram({features: analogue_chips, property: 'dist_to_edge', maxBuckets: 10})
//         .setOptions({
//           title: 'Distance to edge analogues',
//           hAxis: {
//             title: 'Distance to edge',
//             titleTextStyle: {italic: false, bold: true}
//           },
//           vAxis: {
//             title: 'Distance (squared)',
//             titleTextStyle: {italic: false, bold: true}
//           },
//           colors: ['1d6b99'],
//           legend: {position: 'none'}
//         });
// print(edge_chart);
// ////////////////////////////////////////////////////////////////////////////////
// //do some masking? 
// var test = selected_cells.first()

// function create_mask(img,feat,property){
//   print(feat.get(property))
//   var lower = ee.Number(feat.get(property))
//   lower = lower.subtract(lower.multiply(0.1))
//   var upper = ee.Number(feat.get(property))
//   upper = upper.add(upper.multiply(0.1))
//   print(lower,upper)
//   var mask = img.gte(lower).and(img.lte(upper))
//   return mask
// }
// var cc_mask = create_mask(canopyCover.select(baselineYr),test,'canopyCover_mean')
// var dist_mask = create_mask(road_dist,test,'distance_mean')
// Map.addLayer(canopyCover.select(baselineYr),{min:0,max:100},'cc2000')
// Map.addLayer(cc_mask,{},'mask')



