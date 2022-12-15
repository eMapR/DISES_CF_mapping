## DISES Community Forest Project

This project is investigating the role of Community Forests (CFs) in livelihoods and biophysical paramaters in SE Asia with a focus on Vietnam, Cambodia and Thailand. The following documentation corresponds to Google Earth Engine (GEE) scripts that can be used to generate forest canopy cover products, summarize those products by vector-based area and perform some basic change detection processes. The scripts listed below are available in this Github repo or at a publicly available [GEE repo](https://code.earthengine.google.com/?accept_repo=users/ak_glaciers/DISES_CF_project). A big part of the code available in this repo also relates to the selection of counterfactuals or analogues. This means that for each of the CFs in the study area, we have selected a number of possible analogue areas that are characterized by similar biophysical characteristics and potentially also socio-economic characteristics. There are three possible ways of doing this which include using the full CF boundary and looking for similarly shaped things across the landscape, using image chips selected from inside the CF boundary and then using a pixel-based approach. There are benefits and drawbacks to each of these potential options.

## Scripts: 

- generate_rma_canopy_cover.js 
- extract_stats_from_CFs.js
- generate_CF_counterfactuals_polys.js
- generate_CF_counterfactuals_pixels.js
- generate_CF_counterfactuals_chips.js
- generate_CF_counterfactuals_polys_raster.js
- generate_CF_counterfactuals_chips_raster.js
- annual_change_detection.js 

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


#### Generate CF counterfactuals using polygons

To assess the impacts of community forest establishment and management practices we select some counterfactuals or analogues for each known CF. These are areas with similar geographic, biophysical and socio-economic characteristics where CFs have not been established. We use these as control cases against which to compare the CFs and associated management practices. There are multiple options and potential inputs for creating and selecting these counterfactuals but they are generally selected using a suite of predictor variables and rule-based filtering. Note that this will create possible counterfactuals that are the same shape as the base CF and will distribute those around the landscape.  

###### User defined params 

**CFs: ee.FeatureCollection**       
    A feature collection of CF boundaries. Process was developed using the CF boundaries for Cambodia (ee.FeatureCollection('users/ak_glaciers/All_CF_Cambodia_July_2016')).     

**canopyCover: ee.Image()**    
    An output of the canopy cover model above for a baseline year. Testing was conducted using the year 2000 as a baseline. This acts as a primary predictor variable for the counterfactual selection but will be augmented in future versions.     

**plusMinus: int**     
    When we select the thresholds for appropriate forest cover analogues this will determine how far off the CF mean we can be.    

**numFeats: int**     
    In the first version of this script it will randomly shuffle the CF boundaries in four geographic quadrants. This will produce this many feats per cardnial direction quadrant   

**place: str**     
    This will be used in naming structures and could be used to filter on a country dataset like LSIB etc.      

**aoi: ee.Geometry()**      
    Should be an ee.Geometry() or a FC cast as a geometry(). Can be set to filter with place like: ee.FeatureCollection("USDOS/LSIB/2017").filter(ee.Filter.eq('COUNTRY_NA',place)).geometry().   

**moveCoeff: int**     
    This will be multiplied by the 0-1 distributed random numbers to define how much polygons are moved inside geographic coordinates. There is no 'right' answer here but testing was conducted with a value of 5. This is determined by the size of your study area. 

**baselineYr: str**     
    A bandname for the year you are using as your baseline in the canopy cover dataset. Testing was conducted with the year 2000 like: 'yr_2000'

###### Outputs
This script will output a featureCollection of possible analogues/counterfactuals for each CF in the CF featureCollection. As of 12/8/2022 this is using the following predictor variables:   

- canopy cover - defined in RMA above and based on Hansen et al 2014 base layer for the year 2000. 
- distance to roads - from open street map 
- distance to edge - using the Hansen dataset, a binary layer is created using a default threshold of 15% canopy cover. 
- slope - calculated in GEE from SRTM. 
- slope - calculated in GEE from SRTM. 

#### Generate CF counterfactuals using image chips 

Very similar to the section above on generating CF counterfactuals using polygons but instead of using the full CF boundary we subset the CF boundary with uniform image chips of a given size (defined in user params). These chips are then distributed on the landscape and a series of rule-based filtering steps pare down the collection. 

###### User defined params 

**CFs: ee.FeatureCollection**       
    A feature collection of CF boundaries. Process was developed using the CF boundaries for Cambodia (ee.FeatureCollection('users/ak_glaciers/All_CF_Cambodia_July_2016')).     

**numChips: int** 
    The number of chips to create in a CF boundary. Currently set so that a uniform number of chips are created in every boundary. It is possible this should be adjusted to be more dynamic and based on the size of the CF. Defaults to 1000. This number likely needs to be increased. 

**place: str**     
    This will be used in naming structures and could be used to filter on a country dataset like LSIB etc.     

**aoi: ee.Geometry()**      
    Should be an ee.Geometry() or a FC cast as a geometry(). Can be set to filter with place like: ee.FeatureCollection("USDOS/LSIB/2017").filter(ee.Filter.eq('COUNTRY_NA',place)).geometry().   

**baselineYr: str**     
    A bandname for the year you are using as your baseline in the canopy cover dataset. Testing was conducted with the year 2000 like: 'yr_2000'    

**canopyCover_thresh: int**   
    Threshold for where we define forest/not forest. Defaults to 15 percent.   

**resolution: int**    
    Defines the size of the chips, expressed in m. 

**seed: int**   

**PRJ: str**     
    The crs for creating the image chips. Used in reproject and to define some of the chip shapes/sizes below. Defaults to something universal like: EPSG:3857".      

**pct: float (percent)**
    This is used as a plus/minus for getting analogues with similar characteristics to the base CF. For example, the code will calculate the mean canopy cover for a given CF and then add 10% and subtract 10% from that value. Any potential analogue with canopy cover within that range will be included.    

###### Outputs
This script will output a featureCollection of possible analogues/counterfactuals. It is set to just create this for one test CF but can be amended to map over the full FC. As of 12/8/2022 this is using the following predictor variables:   

- canopy cover - defined in RMA above and based on Hansen et al 2014 base layer for the year 2000. 
- distance to roads - from open street map 
- distance to edge - using the Hansen dataset, a binary layer is created using a default threshold of 15% canopy cover. 
- slope - calculated in GEE from SRTM. 
- slope - calculated in GEE from SRTM. 

#### Generate CF counterfactuals using image chips (raster version)
This is set up very similarly to the previous version based on creating an excess of vector chips and filtering out the ones we don't want. However, that is a very computationally expensive way to accomplish the process because we are using a series of reducers on thousands of polygons which we are ultimately not using, lots of unnecessary overhead. However, if we do this in a raster-based process and mask out the areas we're not interested in a priori it results in an orders of magnitude savings in time. With the image chips, the theory for their creation is based on a post from Noel Gorelick on [medium.com](https://medium.com/google-earth/random-samples-with-buffering-6c8737384f8c) where we create a raster grid with a known pixel resolution. These pixels serve as the image chips so setting the resolution arg in the user inputs defines the output size of the image chips. We do this both in the base CF and then across the country or other aoi that you are using. We can map over the small number of chips that were created in the base CF and attribute a vector version of the raster pixels with their associated values for our predictor variables. We then create the raster for the full aoi at the same spatial resolution and using the mean predictor variable values for each image chip we can mask the full aoi, leaving only the pixels we're interested in. Converting these from raster to vector then yields the possible counterfactuals for the associated chip and base CF. 

###### Problems/things to resolve
- The resolution of the created raster defines the size of the output image chips. This is at the moment the same regardless of the size of the CF of interest. It may make more sense to have resolutions that are variable with CF size and/or to adjust the number of chips that are selected from inside each CF so they are the same irrespective of the size of the CF boundary. 
- The main problem with creating a viable output is that applying all of the masks generally results in very few or no possible analogues. There are three easy solutions to this issue and probably more complicated options: 
    1. Use less masks (predictor variables) - right now these are set in the output variable in line 110 of the script but this could be reconfigured
    2. increase the pct arg in the user defined args - that will allow for chips that are further from the base chip (i.e. this defines the plus or minus that is allowed for predictor variable values)
    3. Reduce the spatial resolution - reducing the spatial resolution creates more pixels and thus more chips and potential counterfactuals. There is a limit to doing this as eventually you are just working on a pixel scale (i.e. when the resolution arg is set to the same spatial resolution of the input predictor variable)
- The output is set up so that it will create a featureCollection with all the possible counterfactual chips for all the original counterfactual chips in a CF boundary so the featureCollection will be the number of image chips you used from the base CF times whatever number were left for each after masking. This could be adjusted depending on how its going to be used and what would be most helpful. 
- Decide what should be done with the distance metrics in terms of reducer. Currently, this is just set to mean as well as the other ones but could (and probably should) be set to distance from centroid or something along those lines. 
-convert to run for more than one CF - this can easily be done by taking the masking logic and just mapping all of that over a full featureCollection of CF boundaries
- Need to add more metadata, specifically about the status of protected areas and other commercial land concessions

#### Generate CF counterfactuals using image polygons (raster version)
This works in a very similar fashion to the CF counterfactuals for image chips from rasters described above. The same raster creation and masking steps are used to create a series of pixels that are the selected CF counterfactuals. We use the full CF boundary to calculate predictor variable values (e.g. mean population density) instead of individual image chips inside the CF boundary. The main difference is that instead of converting the pixels that make it through the multiple masks to vector and finishing there, we just take the centroid of those image chips and use that to define a new polygon boundary. These polygons have the same shape and orientation as the original polygon. 

###### Problems/things to resolve
The major issues with this approach are very similar to those described above for image chips because the process is fairly similar. However, this has the extra added issue of having less possibilities to choose from because the targets are generally bigger and there is only one base CF instead of x number of chips for each CF. The issues with masking etc. are the same though. 

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