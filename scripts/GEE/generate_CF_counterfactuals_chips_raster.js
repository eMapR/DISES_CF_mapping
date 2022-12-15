//////////////////////////////////////////////////////////////////////////////////
////////////////////// DISES SE ASIA CF COUNTERFACTUALS///////////////////////////
//////////////////////////////////////////////////////////////////////////////////

//this script is intended to take a fc of community forests and find analogue regions with similar biophysical and socio-economic characteristics. 
//This version is for image chips
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//define some user params 
var CFs = ee.FeatureCollection('users/ak_glaciers/All_CF_Cambodia_July_2016'); 
var place = 'Cambodia'; 
var aoi = ee.FeatureCollection("USDOS/LSIB/2017").filter(ee.Filter.eq('COUNTRY_NA',place)).geometry();
var baselineYr = 'yr_2000'; //for the canopy cover mostly 
var canopyCover_thresh = 15; 
var resolution = 300; 
var seed = 1;  
var PRJ = "EPSG:3857";
var pct = 0.1; 
var proj = ee.Projection("EPSG:3857").atScale(resolution);
//define an example cf, this will be a map statement in final version 
var CF_example = CFs.filter(ee.Filter.eq('CF_Name_En','Thmada Ou Teuk Kheav')); 

//define some predictor variables - this could be exapanded for socio economic data 
var roads = ee.FeatureCollection('projects/ee-dises-cf-project/assets/uploads/gis_osm_roads_free_1');
var road_dist = roads.distance();
var canopyCover = ee.Image('users/ak_glaciers/reem_cf_outputs/reem_canopy_cover_2000_pts_rma_nbr_timeseries_remapped_full');
var non_forest_mask = ee.Image("UMD/hansen/global_forest_change_2021_v1_9").clip(aoi).select('treecover2000').lte(canopyCover_thresh); 
// var dist_to_edge = non_forest_mask.distance(ee.Kernel.euclidean(10),false)
var dist_to_edge = non_forest_mask.fastDistanceTransform();
var land_cover = ee.ImageCollection("COPERNICUS/Landcover/100m/Proba-V-C3/Global").filter(ee.Filter.eq('system:index','2019')); 
var dem = ee.Image("USGS/SRTMGL1_003").clip(aoi.buffer(1000)); 
var terrain = ee.Algorithms.Terrain(dem); 
var slope = terrain.select('slope'); 
var aspect = terrain.select('aspect'); 
//this layer was used in the Wolf et al paper Matt introduced but it says its deprecated in the GEE catalogue
//'travel_time':ee.Image("Oxford/MAP/accessibility_to_cities_2015_v1_0"),
var pop_dens = ee.Image("CIESIN/GPWv411/GPW_UNWPP-Adjusted_Population_Density/gpw_v4_population_density_adjusted_to_2015_unwpp_country_totals_rev11_2000_30_sec").select("unwpp-adjusted_population_density")
                                                                                                                                                                 .rename(['density'])
                                                                                                                                                                 .clip(aoi); 
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////Base image chips ///////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//create chips inside a CF boundary from raster pixels 
var img_chips = ee.FeatureCollection(generate_img_chips(CF_example,resolution).get(0));
var centroids = ee.FeatureCollection(generate_img_chips(CF_example,resolution).get(1));

////////////////////////////////////////////////////////////////////////////////
//add predictor variable values to the CF chips 
img_chips = img_chips.map(function(feat){
  var cc_out = get_aoi_stat(canopyCover.select(baselineYr),feat,baselineYr,'canopyCover',ee.Reducer.mean()); 
  //this could be amended to be distance from CF centroid to road 
  var rd_out = get_aoi_stat(road_dist,feat,'distance','dist_to_rd',ee.Reducer.mean()); 
  var edge_out = get_aoi_stat(dist_to_edge,feat,'distance','dist_to_edge',ee.Reducer.mean());
  var slope_out = get_aoi_stat(slope,feat,'slope','slope',ee.Reducer.mean()); 
  var aspect_out = get_aoi_stat(aspect,feat,'aspect','aspect',ee.Reducer.mean()); 
  var density_out = get_aoi_stat(pop_dens,feat,'density','density',ee.Reducer.mean()); 
  return feat.set('canopyCover',cc_out)
             .set('dist_to_rd',rd_out)
             .set('dist_to_edge',edge_out)
             .set('slope',slope_out)
             .set('aspect',aspect_out)
             .set('density',density_out)
             .set('source_CF',CF_example.first().get('CF_Name_En')); //this will have to be changed to run all CFs
}); 

//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////Counter factuals ///////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//next create some random chips across the aoi 

//try doing the raster ones
//create chips from raster pixels - these are a regular grid with every other cell removed to ensure they don't touch each other
var regular_chips = ee.Image(generate_img_chips(aoi,resolution).get(2));

var masked_chips = img_chips.map(function(feat){
  //now create some masks 
  //reproject them so we're masking full pixels from the random pixels above
  var cc_mask = canopyCover.select(baselineYr).gte(ee.Number(get_min_max(feat,'canopyCover').get(0)))
                                              .and(canopyCover.select(baselineYr)
                                              .lte(ee.Number(get_min_max(feat,'canopyCover').get(1))))
                                              .reproject(proj); 
  
  var rd_mask = (road_dist.gte(ee.Number(get_min_max(feat,'dist_to_rd').get(0)))
                          .and(road_dist
                          .lte(ee.Number(get_min_max(feat,'dist_to_rd').get(1)))))
                          .reproject(proj); 
  
  var edge_mask = (dist_to_edge.gte(ee.Number(get_min_max(feat,'dist_to_edge').get(0)))
                              .and(dist_to_edge
                              .lte(ee.Number(get_min_max(feat,'dist_to_edge').get(1)))))    
                              .reproject(proj); 
  
  var slope_mask = (slope.gte(ee.Number(get_min_max(feat,'slope').get(0)))
                        .and(slope
                        .lte(ee.Number(get_min_max(feat,'slope').get(1)))))
                        .reproject(proj); 
   
  var aspect_mask = (aspect.gte(ee.Number(get_min_max(feat,'aspect').get(0)))
                          .and(aspect
                          .lte(ee.Number(get_min_max(feat,'aspect').get(1)))))
                          .reproject(proj); 
  
  var density_mask = (pop_dens.gte(ee.Number(get_min_max(feat,'density').get(0)))
                          .and(pop_dens
                          .lte(ee.Number(get_min_max(feat,'density').get(1)))))
                          .reproject(proj); 
  
  var output = regular_chips.updateMask(cc_mask).updateMask(density_mask).updateMask(slope_mask).updateMask(aspect_mask).updateMask(rd_mask).updateMask(edge_mask);
  
  //try converting what's left to a featureCollection
  //these become the image chip centroids 
  var vect_chips = output.reduceToVectors({
    reducer: ee.Reducer.countEvery(), 
    geometry: aoi,
    crs: proj, 
    geometryType: "polygon", 
    maxPixels: 1e13
  }); 
  //add the id back so we know which chip it came from and maybe add the stats??
  vect_chips = vect_chips.map(function(f){
    return f.set('source_chip_id',feat.get('id')); 
  }); 
  return vect_chips;
}); 

masked_chips = ee.FeatureCollection(masked_chips.flatten()); 

//remove chips that overlap other CFs
var filterInside = ee.Filter.bounds(CFs);
var filterNot = filterInside.not();
masked_chips = masked_chips.filter(filterNot); 

//add the actual predictor variable values back into the features as properties so we can see and plot them 
masked_chips = masked_chips.map(function(feat){
  var cc_out = get_aoi_stat(canopyCover.select(baselineYr),feat,baselineYr,'canopyCover',ee.Reducer.mean()); 
  //this could be amended to be distance from CF centroid to road 
  var rd_out = get_aoi_stat(road_dist,feat,'distance','dist_to_rd',ee.Reducer.mean()); 
  var edge_out = get_aoi_stat(dist_to_edge,feat,'distance','dist_to_edge',ee.Reducer.mean());
  var slope_out = get_aoi_stat(slope,feat,'slope','slope',ee.Reducer.mean()); 
  var aspect_out = get_aoi_stat(aspect,feat,'aspect','aspect',ee.Reducer.mean());   
  var density_out = get_aoi_stat(pop_dens,feat,'density','density',ee.Reducer.mean()); 
  return feat.set('canopyCover',cc_out)
             .set('dist_to_rd',rd_out)
             .set('dist_to_edge',edge_out)
             .set('slope',slope_out)
             .set('aspect',aspect_out)
             .set('density',density_out)
             .set('source_CF',CF_example.first().get('CF_Name_En')); //this will have to be changed to run all CFs
}); 

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

Export.table.toAsset({
  collection:masked_chips,
  description:'image_chip_counterfactual_testing_rasters_all_masks_w_props',
  assetId:'general_exports'+'/image_chip_counterfactual_testing_rasters_all_masks_w_props'
}); 

Export.table.toDrive({
  collection: masked_chips,
  description:'CF_image_chips_from_rasters_filtered_w_props', 
  fileNamePrefix:'CF_image_chips_from_rasters_filtered_w_props',
  folder: 'DISES_counterfactuals',
  fileFormat:'CSV'
}); 

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
//add general functions
////////////////////////////////////////////////////////////////////////////////
//get summary stats for a chip for each predictor variable 
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
  return ee.Number(mean.get(band));
}

//get min and max vals based on chip mean predictor variable plus or minus pct var 
function get_min_max(chip,property){
  var val = ee.Number(chip.get(property)); 
  var min_val = val.subtract(val.multiply(pct)); 
  var max_val = val.add(val.multiply(pct));
  return ee.List([min_val,max_val]); 
}


//create image chips 
//try a raster version from https://medium.com/google-earth/random-samples-with-buffering-6c8737384f8c
function generate_img_chips(bounds,resolution){
  // Generate a random image of integers in Albers projection at the specified cell size.
  var proj = ee.Projection("EPSG:3857").atScale(resolution); 
  var cells = ee.Image.random(seed).multiply(1000000).int().clip(bounds).reproject(proj); 
  // Map.addLayer(cells.randomVisualizer(),{},'cells')
  // Generate another random image and select the maximum random value 
  // in each grid cell as the sample point.
  var random = ee.Image.random(seed).multiply(1000000).int(); 
  var maximum = cells.addBands(random).reduceConnectedComponents(ee.Reducer.max()); 
  // Map.addLayer(maximum.randomVisualizer(),{},'max')
  // Find all the points that are local maximums.
  var points = random.eq(maximum).selfMask().clip(bounds); 
  
  // Create a mask to remove every pixel with even coordinates in either X or Y.
  // Using the double not to avoid floating point comparison issues.
  var mask = ee.Image.pixelCoordinates(proj)
      .expression("!((b('x') + 0.5) % 2 != 0 || (b('y') + 0.5) % 2 != 0)"); 
  var strictCells = cells.updateMask(mask).reproject(proj); 
  
  var strictMax = strictCells.addBands(random).reduceConnectedComponents(ee.Reducer.max()); 
  var strictPoints = random.eq(strictMax).selfMask().clip(bounds); 
  // Map.addLayer(strictPoints.reproject(proj.scale(1/16, 1/16)), {palette: ["white"]},'points')
  // Map.addLayer(strictMax,{},'strict max')
  
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
  // Add a buffer around each point that is the requested spacing size for visualization.
  // var buffer = samples.map(function(f) { return f.buffer(ee.Number(cellSize).divide(2)) })
  var PRJ = "EPSG:3857";
  
  var error = ee.ErrorMargin(1, 'projected');
  var img_chips = centroids.map(function(pt){
    return ee.Feature(pt.geometry()).buffer(resolution / 2, error, PRJ).bounds(error, PRJ).set('id',pt.get('id'));  
  }); 
  return ee.List([img_chips,centroids,strictMax]); 
}


