## DISES Community Forest Project

This project is investigating the role of Community Forests (CFs) in livelihoods and biophysical paramaters in SE Asia with a focus on Vietnam, Cambodia and Thailand. The following documentation corresponds to Google Earth Engine (GEE) scripts that can be used to generate forest canopy cover products, summarize those products by vector-based area and perform some basic change detection processes. 

## Scripts: 

- generate_rma_canopy_cover.js 
- extract_stats_from_CFs.js
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

**User defined params**
cambodiaCFs: ee.FeatureCollection
    The featureCollection of CFs. For example the cambodia asset is: ee.FeatureCollection('users/ak_glaciers/All_CF_Cambodia_July_2016'); 

example_cf: ee.FeatureCollection
    Filter the CF FC to get a specific CF. This could also be set to some other geometry but its generally intended to deal with CFs. For example: cambodiaCFs.filter(ee.Filter.eq('CF_Name_En','Torb Cheang'))

canopy_ts = 'example'
    This is the output of the generate_stats_from_CFs and is an imageCollection of annual canopy cover %

Note that the reducer defaults to ee.Reducer.mean(). This can be manually changed and/or set as a user-defined argument if more is added to this script. 

The default for this script is to take the imageCollection and generate a chart of the time series change with time. 
