import numpy as np
import pandas as pd

def euler_method_custom_x(f, x_values, y0):
    y_values = np.zeros(len(x_values))  # Create array for y values
    y_values[0] = y0                    # Set initial y value

    for i in range(1, len(x_values)):
        h = 0.5  # Compute step size between current and previous x
        y_values[i] = y_values[i-1] + h * f(x_values[i-1], y_values[i-1])

    return y_values

# Define the function f(x, y) = (1 + 2x) / (y + x)
def f(x, y):
    return (1 + 2 * x) / (y + x)

# Initial conditions
x_values = [0.0, 0.1, 0.2, 0.5, 0.6, 1.8]  # Given x values
y0 = 5                                     # Initial y value

# Apply Euler's method for the custom x values
y_values = euler_method_custom_x(f, x_values, y0)

# Create DataFrame and print the results
df = pd.DataFrame({'x': x_values, 'y': y_values})
print(df)
