## DISES Community Forest Project

This project is investigating the role of Community Forests (CFs) in livelihoods and biophysical paramaters in SE Asia with a focus on Vietnam, Cambodia and Thailand. The following documentation corresponds to Google Earth Engine (GEE) scripts that can be used to generate forest canopy cover products, summarize those products by vector-based area and perform some basic change detection processes. The scripts listed below are available in this Github repo or at a publicly available [GEE repo](https://code.earthengine.google.com/?accept_repo=users/ak_glaciers/DISES_CF_project). A big part of the code available in this repo also relates to the selection of counterfactuals or analogues. This means that for each of the CFs in the study area, we have selected a number of possible analogue areas that are characterized by similar biophysical characteristics and potentially also socio-economic characteristics. There are three possible ways of doing this which include using the full CF boundary and looking for similarly shaped things across the landscape, using image chips selected from inside the CF boundary and then using a pixel-based approach. There are benefits and drawbacks to each of these potential options.s

## Scripts: 

- generate_rma_canopy_cover.js 
- extract_stats_from_CFs.js
- generate_CF_counterfactuals_polys.js
- generate_CF_counterfactuals_pixels.js
- generate_CF_counterfactuals_polys.js
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