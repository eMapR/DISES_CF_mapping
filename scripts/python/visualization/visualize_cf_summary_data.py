import os 
import sys
import glob
import matplotlib.pyplot as plt
import seaborn as sns 
import pandas as pd 
import geopandas as gpd 



def plot_hist(df): 
	fig,ax = plt.subplots(1)
	ax.hist(df.yod,bins=range(2000,2021),align='mid')
	ax.set_xlabel('YOD')
	ax.set_ylabel('Count')
	ax.set_title('Cambodia Year of Disturbance (YOD) 2000-2020 Collection 1')
	ax.set_xticks(range(2000,2021))
	ax.grid(axis='both',alpha=0.25)
	# ax.set_xticklabels(gdf.id, rotation = 90, ha="right")
	# plt.ylim([2000, 2020])

	plt.show()
	plt.close('all')

def reformat_gee_data(df): 
	df.rename(columns={'id':'CF_Name_En'},inplace=True) 
	df.drop(columns=['system:index','.geo'],inplace=True)
	df['yod'] = df['yod'].fillna(0.0).astype(int)
	return df 

if __name__ == '__main__':
	cf_means = "/vol/v1/proj/reem_cf_project/csvs/cf_summary_stats/CFs_yod_stats_cambodia_full_all_bands.csv"
	cf_std = "/vol/v1/proj/reem_cf_project/csvs/cf_summary_stats/CFs_yod_stats_cambodia_full_all_bands_std.csv"
	cf_shp = "/vol/v1/proj/reem_cf_project/vectors/CFs in Cambodia/All_CF_Cambodia_July_2016.shp"
	output_dir = '/vol/v1/proj/reem_cf_project/vectors/modified_shps/'
	
	#read in the shapefile and then join some of the std and means data 
	gdf = gpd.read_file(cf_shp)
	
	means_df = reformat_gee_data(pd.read_csv(cf_means)).sort_values('CF_Name_En')
	means_df = means_df.loc[means_df.yod >=2000]
	std_df = reformat_gee_data(pd.read_csv(cf_std)).sort_values('CF_Name_En')

	# print(means_df[['CF_Name_En','yod']])

	print(means_df.yod.max())

	# means_shp = gdf.merge(means_df,on='CF_Name_En',how='inner').dropna(subset=['yod']).sort_values('CF_Name_En')
	# std_shp = gdf.merge(std_df,on='CF_Name_En',how='inner').dropna(subset=['yod']).sort_values('CF_Name_En')
	
	# means_shp = means_shp.loc[gdf['yod']>=2000]
	

	# print(means_shp[['CF_Name_En','yod']])

	# means_shp.to_file(os.path.join(output_dir,'cf_data_w_change_detection_means.shp'))
	# std_shp.to_file(os.path.join(output_dir,'cf_data_w_change_detection_std.shp'))
	plot_hist(means_df)

	