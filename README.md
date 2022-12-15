## DISES Community Forest Project

This project is investigating the role of Community Forests (CFs) in livelihoods and biophysical paramaters in SE Asia with a focus on Vietnam, Cambodia and Thailand. The following documentation corresponds to Google Earth Engine (GEE) scripts that can be used to generate forest canopy cover products, area analogues (counterfactuals), summarize those products by vector-based area and perform some basic change detection processes. The scripts listed below are available in this Github repo or at a publicly available [GEE repo](https://code.earthengine.google.com/?accept_repo=users/ak_glaciers/DISES_CF_project). Beyond generating canopy cover data, a big part of the code available in this repo also relates to the selection of counterfactuals or analogues. This means that for each of the CFs in the study area, we have selected a number of possible analogue areas that are characterized by similar biophysical characteristics and potentially also socio-economic characteristics. These are then used as 'control groups' for further analysis, specifically of the conditions that proceed and come after the establishment of CFs. There are numerous ways to do this but the research group has settled on three potential ways of doing it from a geographic perspective including: the full CF boundary and looking for similarly shaped things across the landscape, using image chips selected from inside the CF boundary and then using a pixel-based approach. 

There are a number of benefits and drawbacks associated with each option outlined below. Using the full polygon area allows for associated metadata and potential selection criteria that consider the shape of each CF boundary. This approach also makes more sense than some of the others when using it for species distribution modeling or considering connectivity issues. However, as the areas are much larger than either image chips or pixels, there is only so much area we can choose from that will fulfill the criteria of one CF without overlapping other CFs. The code to do this is also a bit more complicated than the other options because of the need to preserve the CF shape. 

The image chip approach requires that a sample of image chips of a given size are selected from inside a CF boundary. For each chip in that sample, we then search for similar chips on the landscape based on our selected predictor variables. This has the benefit of regularity of shape, one can 'fit' a lot more of the chips on the landscape and therefore at least theoretically more options are available for counterfactuals. The size of these units can also be (relatively) easily changed depending on the requirements of the user. Additionally, a higher degree of variability can be captured for a CF than by using the full boundary. For example, by including some chips from the interior region of the CF with higher canopy cover vs lower canopy cover for a chip near the edge we can capture a higher degree of heterogenaity than if there is just one mean value for the CF. Like with the full polygons, these have some drawbacks. These issues center mostly around controlling for differences in the CFs and deciding how you summarize the predictor variables inside each of the image chips. The CFs vary significantly in size meaning that if you draw image chips of a uniform resolution across all the CFs you will get a very different number in the larger CFs than in the smaller CFs. This can be ameliorated by randomly selecting a subset of the sample/population but you're working from different population sizes in different CFs. One could adjust the population size to the CF boundary to accommodate that but then you will have to change the spatial resolution, making the image chips less comparable across CFs. 

The final option would be to select a random subset of pixels from within the CF boundary and then a corresponding sample from the landscape, looking for pixels with similar characteristics based on the predictor variables. This is not really a recommended approach unless some kind of resampling is applied because pixels are inherently somewhat noisy, especially for some of the 30m predictor variable products so a group of pixels is generally a better representation of the characteristics of a particular part of a CF. That being said, there is some resampling of the predictor variables that is happening in both the polygon and image chip versions of the workflow but only after the summary stats for an area have been calculated at the predictor variable's native resolution. 

## Scripts: 

- generate_CF_counterfactuals_polys_raster.js
- generate_CF_counterfactuals_chips_raster.js
- generate_CF_counterfactuals_pixels.js [NEEDS UPDATING]
- generate_rma_canopy_cover.js 
- extract_stats_from_CFs.js
- annual_change_detection.js 

Below is a description of how these scripts generally work, what the user defined arguments look like and how they should be passed and some information on things that are not complete or need further decisions to be made. 

#### Generate CF counterfactuals using polygons (CF boundaries)

To assess the impacts of community forest establishment and management practices we select some counterfactuals or analogues for each known CF. These are areas with similar geographic, biophysical and socio-economic characteristics where CFs have not been established. We use these as control cases against which to compare the CFs and associated management practices. There are multiple options and potential inputs for creating and selecting these counterfactuals but they are generally selected using a suite of predictor variables and rule-based filtering. Note that this will create possible counterfactuals that are the same shape as the base CF and will distribute those around the landscape.  The basic logic for doing this is that we calculate the x,y offset of each vertex that makes up the perimiter of a CF to the CF's centroid in lat/lon coordinates. We then move the centroid and recalculate the location of each vertex based on the offset to the centroid. As noted in the code, this only works in the northern/eastern hemisphere quadrant of the world and therefore assumes that longitude is increasingly positive moving from west to east and latitude is increasingly positive moving from the equater north. The direction of the math would have to be amended to run in another part of the world. To set the new centroids, we employ the same masking logic employed in the image chip approach (described below) to get the image chips and then get the centroid of the image chip and use that to define the new CF boundary. Some of the drawbacks of this approach are elaborated below. 

###### General running instructions (also applies to image chips below)

1. Either copy the code from Github or create a version in your own repo from the link to the shared repo above
2. Change user defined params
3. Change export names/destinations 
4. Note that this will currently (12/15/22) just export for one CF. Details for changing this are included in the notes below on things to change and decisions to be made

###### User defined params 

**CFs: ee.FeatureCollection**       
    A feature collection of CF boundaries. Process was developed using the CF boundaries for Cambodia (ee.FeatureCollection('users/ak_glaciers/All_CF_Cambodia_July_2016')).        

**place: str**     
    This will be used in naming structures and could be used to filter on a country dataset like LSIB etc.      

**aoi: ee.Geometry()**      
    Should be an ee.Geometry() or a FC cast as a geometry(). Can be set to filter with place like: ee.FeatureCollection("USDOS/LSIB/2017").filter(ee.Filter.eq('COUNTRY_NA',place)).geometry().   

**baselineYr: str**     
    A bandname for the year you are using as your baseline in the canopy cover dataset. Testing was conducted with the year 2000 like: 'yr_2000'

**canopyCover_thresh: int**   
    The threshold used to define forest/not forest. Defaults to 15 percent canopy cover. 

**resolution: int**
    Defines the resolution of the regular grid (raster) that is used to create image chips. The associated image chips will have this resolution at creation. For the CF boundary version this will start at 1000m. 
**pct: float**  
    When the program tries to select appropriate analogues it will calculate summary statistics for each predictor variable for a CF boundary. It will then multiply this number by the mean statistic, for example, and add (subtract) that number from the mean to calculate the max (min) value allowable for that predictor variable. Raising this number will allow more possibilites through masking while lowering it will keep possible analogues closer to the source mean. 

**proj: ee.Projection object**   
    Used to resample all the predictor variable layers to a common grid. Defaults to ee.Projection("EPSG:3857").atScale(resolution); 

###### Predictor variables (as of 12/15/22)

These are the predictor variables currently being used in the decisition making for counterfactuals. The code setup is a bit clunky but the masks are being called on line 121 where they can be added or subtracted (commented out). That line looks like: 

output = full_raster.updateMask(cc_mask).updateMask(density_mask).updateMask(slope_mask)//.updateMask(aspect_mask)//.updateMask(rd_mask).updateMask(edge_mask);

**roads:** defaults to road from Open Street Map ee.FeatureCollection('projects/ee-dises-cf-project/assets/uploads/gis_osm_roads_free_1')

**road_dist:** distance from a road calculated using: roads.distance()

**canopyCover:** calculated using the method described below and defaults to: ee.Image('users/ak_glaciers/reem_cf_outputs/reem_canopy_cover_2000_pts_rma_nbr_timeseries_remapped_full')

**non_forest_mask:** thresholded Hansen product defaults to: ee.Image("UMD/hansen/global_forest_change_2021_v1_9").select('treecover2000').lte(canopyCover_thresh)

**dist_to_edge:** distance to a transition from forest to non-forest or reverse. Defaults to: non_forest_mask.fastDistanceTransform()

**dem:** defaults to: ee.Image("USGS/SRTMGL1_003")

**terrain:** ee.Algorithms.Terrain(dem)

**slope:** terrain.select('slope')

**aspect:** terrain.select('aspect')

**pop_dens:** population density with band renamed to 'density' ee.Image("CIESIN/GPWv411/GPW_UNWPP-Adjusted_Population_Density/gpw_v4_population_density_adjusted_to_2015_unwpp_country_totals_rev11_2000_30_sec").select("unwpp-adjusted_population_density")

###### Outputs
This script will output a featureCollection of possible analogues/counterfactuals for the target CF. Note the exceptions outlined below. 

###### Problems/things to resolve
The major issues with this approach are very similar to those described above for image chips because the process is fairly similar. However, this has the extra added issue of having less possibilities to choose from because the targets are generally bigger and there is only one base CF instead of x number of chips for each CF. The issues with masking etc. are the same though. 

- The code as of 12/15/22 is not set up to run all of the CFs in the FeatureCollection as it was written for testing. To change this, one would need to take the *mask_pixels* function which is defined on line 88 and then called on line 142 and map that function over the full CF featureCollection. To do that you need to change the CF that is passed as an argument to the mask_pixels function on 142. You would also need to change the generation of counterfactual polygons which happens in the call to *move_feature* on line 146 to reflect a mapping over the CFs in the full featureCollection. 

- Exports are setup on line 182. Naming is not fully automated so this needs to be changed for different types of runs. 

- Masking and thus centroids are taken from pixels/image chips - when we move a CF boundary polygon the location is defined by the centroid. The centroids in this case are drawn from the selected pixels/image chips in the process described above for image chips from rasters. The issue here is that there is a spatial dissonence between the area of the CF polygon and the size of the pixel/image chip from which the centroid was taken. What that means is that its likely that a CF polygon extends outside the boundary of the underlying pixel/image chip that was used to define the centroid. This can be mitigated by increasing the spatial resolution (resolution arg) so that there is a closer relationship between the size of the pixel and the CF boundary but that will not totally solve the problem. It would require further work but there are sometimes clusters of pixels that pass through the multiple masking steps and it may be that multiple smaller pixels could be combined to define and area from which a centroid could be drawn and an associated polygon created. 

- The main problem with creating a viable output quantity is that applying all of the masks generally results in very few or no possible analogues. There are three easy solutions to this issue and probably more complicated options: 
    1. Use less masks (predictor variables) - right now these are set in the output variable in line 110 of the script but this could be reconfigured
    2. increase the pct arg in the user defined args - that will allow for chips that are further from the base chip (i.e. this defines the plus or minus that is allowed for predictor variable values)
    3. Reduce the spatial resolution - reducing the spatial resolution creates more pixels and thus more chips and potential counterfactuals. There is a limit to doing this as eventually you are just working on a pixel scale (i.e. when the resolution arg is set to the same spatial resolution of the input predictor variable) - this is definitely a problem with the CF poly approach because we don't really want to use a 200m pixel to define the centroid of a CF that is 10 km2 due to the spatial dissonence. 

- The output is set up so that it will create a featureCollection with all the possible counterfactual chips for all the original counterfactual chips in a CF boundary so the featureCollection will be the number of image chips you used from the base CF times whatever number were left for each after masking. This could be adjusted depending on how its going to be used and what would be most helpful. 

- These are allowed to overlap each other (not other CFs) which should probably be changed

- Need to add more metadata, specifically about the status of protected areas and other commercial land concessions

- Decide what should be done with the distance metrics in terms of reducer. Currently, this is just set to mean as well as the other ones but could (and probably should) be set to distance from centroid or something along those lines. 

- Convert to run for more than one CF - this can easily be done by taking the masking logic and just mapping all of that over a full featureCollection of CF boundaries

#### Generate CF counterfactuals using image chips (raster version)
This is set up very similarly to the previous version based on creating an excess of vector chips and filtering out the ones we don't want. However, that is a very computationally expensive way to accomplish the process because we are using a series of reducers on thousands of polygons which we are ultimately not using, lots of unnecessary overhead. However, if we do this in a raster-based process and mask out the areas we're not interested in a priori it results in an orders of magnitude savings in time. With the image chips, the theory for their creation is based on a post from Noel Gorelick on [medium.com](https://medium.com/google-earth/random-samples-with-buffering-6c8737384f8c) where we create a raster grid with a known pixel resolution. These pixels serve as the image chips so setting the resolution arg in the user inputs defines the output size of the image chips. We do this both in the base CF and then across the country or other aoi that you are using. We can map over the small number of chips that were created in the base CF and attribute a vector version of the raster pixels with their associated values for our predictor variables. We then create the raster for the full aoi at the same spatial resolution and using the mean predictor variable values for each image chip we can mask the full aoi, leaving only the pixels we're interested in. Converting these from raster to vector then yields the possible counterfactuals for the associated chip and base CF. Note that the user defined params and the predictor variables are the same as for polygons and are thus outlined above. 

###### Outputs
This script will output a featureCollection of possible analogues/counterfactuals. It is set to just create this for one test CF but can be amended to map over the full FC (details below). The featureCollection will include all image chips but chips will have a property called source_CF that includes the English name of the origin CF and a unique id that comes from the original image chip. 

###### Problems/things to resolve
- The code as of 12/15/22, like for polygons, is not set up to map over all the CFs in the full featureCollection. To do this, one would create image chips for all CFs like in line 45, not just for the CF_example. You would then calculate statistics for all of the image chips in all of the CFs i.e. map the function on line 50 over the full featureCollection of CFs, not just the image chips. Similarly, the masking step (defined on line 76) needs to be mapped across all CFs, not just the test one. This is called on line 127. Finally, you would want to map the function defined on line 135 across the full CF featureCollection so that all image chips in all the CFs have summary stats. 

- Exporting starts on line 156 and is not fully automated in terms of naming so you need to change this for different runs. 

- The resolution of the created raster defines the size of the output image chips. This is at the moment the same regardless of the size of the CF of interest. It may make more sense to have resolutions that are variable with CF size and/or to adjust the number of chips that are selected from inside each CF so they are the same irrespective of the size of the CF boundary. 

- The main problem with creating a viable output is that applying all of the masks generally results in very few or no possible analogues. There are three easy solutions to this issue and probably more complicated options: 
    1. Use less masks (predictor variables) - right now these are set in the output variable in line 110 of the script but this could be reconfigured
    2. increase the pct arg in the user defined args - that will allow for chips that are further from the base chip (i.e. this defines the plus or minus that is allowed for predictor variable values)
    3. Reduce the spatial resolution - reducing the spatial resolution creates more pixels and thus more chips and potential counterfactuals. There is a limit to doing this as eventually you are just working on a pixel scale (i.e. when the resolution arg is set to the same spatial resolution of the input predictor variable)

- The output is set up so that it will create a featureCollection with all the possible counterfactual chips for all the original counterfactual chips in a CF boundary so the featureCollection will be the number of image chips you used from the base CF times whatever number were left for each after masking. This could be adjusted depending on how its going to be used and what would be most helpful. 

- Decide what should be done with the distance metrics in terms of reducer. Currently, this is just set to mean as well as the other ones but could (and probably should) be set to distance from centroid or something along those lines. 

-convert to run for more than one CF - this can easily be done by taking the masking logic and just mapping all of that over a full featureCollection of CF boundaries

- Need to add more metadata, specifically about the status of protected areas and other commercial land concessions

#### Generate annual canopy cover

As of 11/2/2022, this process relies on Reduced Major Axis (RMA) regression to take stabilized image composites and an existing canopy cover product ([Hansen et al](https://glad.earthengine.app/view/global-forest-change#dl=1;old=off;bl=off;lon=20;lat=10;zoom=3;) or [GFCC](https://doi.org/10.5067/MEaSUREs/GFCC/GFCC30TC.003)). The input imagery could be from any source but this was built with imagery from LandTrendr temporal stabilization and the LandTrendr Optimization (LTOP) [workflow](https://github.com/eMapR/LTOP_FTV_Py). Note that the output of the LTOP workflow is just the breakpoints for a time series from LandTrendr. To generate something useful for this workflow/code you need to run the [image stabilization process](https://github.com/eMapR/LTOP_FTV_Py/blob/main/scripts/create_stabilized_comps.py) and then create an imageCollection using code like: 

    `var yr_images = []; for (var y = 1990;y < 2022; y++){ var im = ee.Image("projects/servir-mekong/composites/" + y.toString()); yr_images.push(im); }`

The script is set up to access an asset that has the format of that imageCollection so you should export this collection to an asset. 

**User defined params**

label: str    
    Label is based on the reducer that is being used for training data creation below. This could be changed   

bands: list     
    This was originally set up as a bivariate thing, could be changed in the future.    

yr_band = str    
    yr_XXXX is from the structure of the temporally fitted data (ftv or fit) and should align with the year of forest cover from GFCC or Hansen.    

startYear: int   

endYear: int     

canopy_band: str   
    Canopy_band is dictated by the target dataset (GFCC or Hansen). It is 'treecover2000' for Hansen and 'tree_canopy_cover' for GFCC.     

place: ee.Geometry object     
    Use a geometry or if a featureCollection, make sure it is cast to geometry before using.    

map_palette: ee palette object     
    Map palette just creates a green palette for visualizing the outputs. For example: {min: 0, max: 100, palette: ['ffffff', '004000']}     

nbr: ee.Image()     
    This expects an imageCollection of fitted imagery generated from the LTOP process (linked above). nbr etc comes from the fitted imagery with RMA just set up as a bivariate thing but may be expanded in the future. An additional call would look like: var ndvi = ee.Image('users/ak_glaciers/NDVI_fitted_image_stack_from_LTOP_1990_start')   

num_points: int    
    This is the number of random points that will be generated to use for the RMA. It is not known exactly what the 'right' number of points are here. You're trying to balance comprehensive exploration of the dataspace with computation and serial auto-correlation.     

The output of this script will be either a multiband image with each band being a year of canopy cover or a time series in ee.ImageCollection form with each image in the collection being a year of canopy cover data. Canopy cover will be expressed as a percentage (0 is no canopy cover). The script is not currently (11/2/2022) set up to decide what the output looks like by default. It is still set up so that the user needs to comment or uncomment the export statements to determine what you want to export and where it should go. 

#### Extract stats from CFs

This is just a simple script to generate summary statistics for specific CFs in the domain. The script is set up to generate an ee.chart and will be set up to export a csv. 

###### User defined params

**cambodiaCFs: ee.FeatureCollection**
    The featureCollection of CFs. For example the cambodia asset is: ee.FeatureCollection('users/ak_glaciers/All_CF_Cambodia_July_2016'); 

**example_cf: ee.FeatureCollection**
    Filter the CF FC to get a specific CF. This could also be set to some other geometry but its generally intended to deal with CFs. For example: cambodiaCFs.filter(ee.Filter.eq('CF_Name_En','Torb Cheang'))

**canopy_ts = ee.ImageCollection**
    This is the output of the generate_stats_from_CFs and is an imageCollection of annual canopy cover %

Note that the reducer defaults to ee.Reducer.mean(). This can be manually changed and/or set as a user-defined argument if more is added to this script. 

The default for this script is to take the imageCollection and generate a chart of the time series change with time. 
