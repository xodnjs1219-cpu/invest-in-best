"""
Check example files structure
"""
import pandas as pd

print("=== department_kpi.xlsx ===")
df = pd.read_excel('../example/department_kpi.xlsx')
print("Columns:", df.columns.tolist())
print("\nFirst 5 rows:")
print(df.head())
print("\nData types:")
print(df.dtypes)
