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
var numFeats = 10000; //this will produce this many feats per cardnial direction quadrant
var place = 'Cambodia'; 
var aoi = ee.FeatureCollection("USDOS/LSIB/2017").filter(ee.Filter.eq('COUNTRY_NA',place)).geometry(); 
var moveCoeff = 1; //this will be multiplied by the 0-1 distributed random numbers to define how much polygons are moved
var baselineYr = 'yr_2000'; 
var canopyCover_thresh = 15; 
var resolution = 1000; 
var seed = 1;  
var pct = 0.2; 
var proj = ee.Projection("EPSG:3857").atScale(resolution); 

//just for testing this, make the CFs smaller so we just run on one feature to compare with image chips
// CFs = CFs.filter(ee.Filter.eq('CF_Name_En','Thmada Ou Teuk Kheav')); 

//define some predictor variables - this could be exapanded for socio economic data 
var roads = ee.FeatureCollection('projects/ee-dises-cf-project/assets/uploads/gis_osm_roads_free_1');
var road_dist = roads.distance();
var canopyCover = ee.Image('users/ak_glaciers/reem_cf_outputs/reem_canopy_cover_2000_pts_rma_nbr_timeseries_remapped_full');
var non_forest_mask = ee.Image("UMD/hansen/global_forest_change_2021_v1_9").select('treecover2000').lte(canopyCover_thresh); 
var dist_to_edge = non_forest_mask.fastDistanceTransform();
var canopyCover = ee.Image('users/ak_glaciers/reem_cf_outputs/reem_canopy_cover_2000_pts_rma_nbr_timeseries_remapped_full');
// var land_cover = ee.ImageCollection("COPERNICUS/Landcover/100m/Proba-V-C3/Global").filter(ee.Filter.eq('system:index','2019')); 
//add topography data 
var dem = ee.Image("USGS/SRTMGL1_003"); 
var terrain = ee.Algorithms.Terrain(dem); 
var slope = terrain.select('slope'); 
var aspect = terrain.select('aspect'); 
//this layer was used in the Wolf et al paper Matt introduced but it says its deprecated in the GEE catalogue
//'travel_time':ee.Image("Oxford/MAP/accessibility_to_cities_2015_v1_0"),
var pop_dens = ee.Image("CIESIN/GPWv411/GPW_UNWPP-Adjusted_Population_Density/gpw_v4_population_density_adjusted_to_2015_unwpp_country_totals_rev11_2000_30_sec").select("unwpp-adjusted_population_density")
                                                                                                                                                                 .rename(['density'])
                                                                                                                                                                 .clip(aoi);            
//////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////Start CODE //////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////

//create the output featureCollections 
//there is a problem where the design does not accommodate multipolygons correctly, it assumes a polygon geometry.Fix that here.
CFs = CFs.map(function(feat){
  var geomType = feat.geometry().type(); 
  return feat.set('geomType',geomType); 
}); 

var polygons = CFs.filter(ee.Filter.eq('geomType','Polygon')); 
//just for testing do this for the first polygon
var polygons = CFs.filter(ee.Filter.eq('CF_Name_En','Thmada Ou Teuk Kheav')); 
var multiPolygons = CFs.filter(ee.Filter.eq('geomType','MultiPolygon'));  

//add summary stats to all of the CFs so we can use them for filtering later
//this would have to be put in a map statement for the full dataset 

polygons = polygons.map(function(feat){
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
             .set('source_CF',polygons.first().get('CF_Name_En')); //this will have to be changed to run all CFs
}); 

//////////////////////////////////////////////////////////////////////////////////////
///////////////////////////Now replicate masking done in chips ///////////////////////
//////////////////////////////////////////////////////////////////////////////////////
//create some chips that can be used for masking and centroids which are used to create the polys
var starting_pts = generate_img_chips(aoi,resolution); 
var regular_chips = ee.Image(starting_pts.get(1));
var poly_centroids = ee.FeatureCollection(starting_pts.get(0)); 


function mask_pixels(feat,full_raster){
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
  
  var output = full_raster.updateMask(cc_mask).updateMask(density_mask).updateMask(slope_mask)//.updateMask(aspect_mask)//.updateMask(rd_mask).updateMask(edge_mask);
  
  //try converting what's left to a featureCollection - we need the centroids to create the polygons
  var vect_chips = output.reduceToVectors({
    reducer: ee.Reducer.countEvery(), 
    geometry: aoi,
    crs: proj, 
    geometryType: "polygon", 
    maxPixels: 1e13
  }); 
  
  //now get the centroids of each chip 
  var new_centroids = vect_chips.map(function(f){
    return ee.Feature(ee.Feature(f).geometry().centroid(1)); 
  }); 
  
  return new_centroids;
  
} 

//this should be mapped if we're running all the CFs
var selected_centroids = ee.FeatureCollection(mask_pixels(polygons.first(),regular_chips)); 

//now we create the polygons using the selected centroids
var analogue_polys = selected_centroids.map(function(pt){
  return ee.Feature(move_feature(ee.Feature(polygons.first()),pt.geometry())); 
}); 

analogue_polys = ee.FeatureCollection(analogue_polys)
print(analogue_polys)
Map.addLayer(analogue_polys,{},'aslghasjlfgh')
//////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////prep data for export /////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//remove polygons that overlap other CFs
var filterInside = ee.Filter.bounds(CFs);
var filterNot = filterInside.not();
analogue_polys = analogue_polys.filter(filterNot); 

//add the actual predictor variable values back into the features as properties so we can see and plot them 
analogue_polys = analogue_polys.map(function(feat){
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
             .set('source_CF',polygons.first().get('CF_Name_En')); //this will have to be changed to run all CFs
}); 
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////

//export the result 
Export.table.toAsset({
  collection:analogue_polys, 
  description:'CF_polys_from_rasters_filtered_w_props', 
  assetId:'general_exports'+'/CF_polys_from_rasters_filtered_w_props'
}); 

Export.table.toDrive({
  collection: analogue_polys,
  description:'CF_polys_from_rasters_filtered_w_props', 
  fileNamePrefix:'CF_polys_from_rasters_filtered_w_props',
  folder: 'DISES_counterfactuals',
  fileFormat:'CSV'
}); 

//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////define general functions////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
function get_min_max(chip,property){
  var val = ee.Number(chip.get(property)); 
  var min_val = val.subtract(val.multiply(pct)); 
  var max_val = val.add(val.multiply(pct));
  return ee.List([min_val,max_val]); 
}


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
  return ee.Number(mean.get(band)); 
}

//this comes from the image chip version but if we just use the centroids as the starting locations for the polys we can use the same
//masking scheme that is used in the chips version and speeds things up considerably
//try a raster version from https://medium.com/google-earth/random-samples-with-buffering-6c8737384f8c
function generate_img_chips(bounds,resolution){
  // Generate a random image of integers in Albers projection at the specified cell size.
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
  //TODO remove? probably only needed for image chips??
  // var error = ee.ErrorMargin(1, 'projected');
  // var img_chips = centroids.map(function(pt){
  //   return ee.Feature(pt.geometry()).buffer(resolution / 2, error, PRJ).bounds(error, PRJ).set('id',pt.get('id'));  
  // }); 
  return ee.List([centroids,strictMax]); 
}


//create a new random fc for a CF - as of 12/8/22 this will just make the fc for one CF but that can be amended easily with a map statement
function move_feature(base_feat,new_centroid){
  //note that the strategy applied below will only work/make sense in the northern/eastern hemisphere quadrant of the world. 
  //otherwise you would need to change the add/subtract strategies. It will also return a CF in the same geographic orientation as the original.
  //get the coords that make up the bounds of a CF
  var coords = base_feat.geometry().coordinates(); 
  coords = ee.List(coords.get(0)); //just based on the GEE construction which is a nested list 
  //get the CF centroid, this is how we'll decide where to move vertices 
  var centroid = base_feat.geometry().centroid(); 
  //get centroid lat/lon
  var cent_lon = ee.Number(centroid.coordinates().get(0)); 
  var cent_lat = ee.Number(centroid.coordinates().get(1)); 
  //get lat/lon for the new centroid
  var new_cent_lon = ee.Number(new_centroid.coordinates().get(0)); 
  var new_cent_lat = ee.Number(new_centroid.coordinates().get(1)); 
  
  var vertices = coords.map(function(pair){
    pair = ee.List(pair); 
    var lon = ee.Number(pair.get(0)); 
    var lat = ee.Number(pair.get(1)); 
    //decide how much to move a vertex and in which direction from the centroid
    var lon_offset = lon.subtract(cent_lon); 
    
    var lat_offset = lat.subtract(cent_lat);
    
    //now reconstruct the new feature
    var new_lon = ee.Algorithms.If(lon_offset.lte(0),
                                   new_cent_lon.subtract(lon_offset.multiply(-1)),
                                   new_cent_lon.add(lon_offset)); 
    var new_lat = ee.Algorithms.If(lat_offset.lte(0),
                                   new_cent_lat.subtract(lat_offset.multiply(-1)),
                                   new_cent_lat.add(lat_offset)); 
  
  return ee.List([new_lon,new_lat]); 
  }); 
  return ee.Geometry.Polygon(vertices); 
}

//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////