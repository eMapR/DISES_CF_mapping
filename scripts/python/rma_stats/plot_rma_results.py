import os
import sys
import matplotlib.pyplot as plt
import seaborn as sns
import glob
import pandas as pd 
from sklearn.metrics import r2_score
from scipy import stats
import numpy as np




if __name__ == '__main__':
	df = pd.read_csv("/vol/v1/proj/reem_cf_project/csvs/rma_model/ee-chart.csv")

	


	fig,ax = plt.subplots(1)

	ax.scatter(df['first'],df.NBR)
	ax.set_xlabel('Hanson % canopy cover')
	ax.set_ylabel('Scaled NBR values')
	


	slope, intercept, r_value, p_value, std_err = stats.linregress(df['first'],df['NBR'])
	# predict_y = intercept + slope * x
	print(r_value)

	ax.plot(np.unique(df['first']), np.poly1d(np.polyfit(df['first'], df['NBR'], 1))(np.unique(df['first'])))

	ax.annotate(f'n = {df.shape[0]}',xy = (0.1,0.9), xycoords='axes fraction')
	ax.annotate(f'r2 = {round(r_value,2)}',xy=(0.1,0.8),xycoords='axes fraction')

	plt.show()
	plt.close('all')