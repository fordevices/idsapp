import xgboost as xgb
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

# 1. Generate a synthetic dataset
X, y = make_classification(n_samples=1000, n_features=20, n_informative=10, 
                           n_redundant=5, random_state=42)

# 2. Split the data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 3. Initialize and train the XGBoost classifier
# Parameters can be tuned for better performance
model = xgb.XGBClassifier(objective='binary:logistic',  # For binary classification
                          n_estimators=100,             # Number of boosting rounds (trees)
                          learning_rate=0.1,            # Step size shrinkage
                          max_depth=3,                  # Maximum depth of a tree
                          use_label_encoder=False,      # Suppress warning for older versions
                          eval_metric='logloss')        # Evaluation metric

model.fit(X_train, y_train)

# 4. Make predictions on the test set
y_pred = model.predict(X_test)

# 5. Evaluate the model
accuracy = accuracy_score(y_test, y_pred)
print(f"Accuracy: {accuracy:.2f}")

# Example of predicting a single data point
# Ensure the input is in the correct 2D format
single_data_point = X_test[0].reshape(1, -1) 
single_prediction = model.predict(single_data_point)
print(f"Prediction for a single data point: {single_prediction[0]}")