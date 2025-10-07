import xgboost as xgb
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

# Load data (features X, labels y)
iris = load_iris()
X, y = iris.data, iris.target
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Create DMatrix (XGBoost's optimized data structure)
dtrain = xgb.DMatrix(X_train, label=y_train)
dtest = xgb.DMatrix(X_test, label=y_test)

# Parameters: objective='multi:softmax' for multi-class classification
params = {
    'objective': 'multi:softmax',
    'num_class': 3,
    'max_depth': 3,
    'eta': 0.1,  # Learning rate
    'eval_metric': 'mlogloss'  # Evaluation metric during training
}

# Train the model
bst = xgb.train(params, dtrain, num_boost_round=10)

# Predict
y_pred = bst.predict(dtest)
accuracy = accuracy_score(y_test, y_pred)
print(f"Accuracy: {accuracy:.2f}")

#f1 score

from sklearn.metrics import f1_score

# After training (from previous example)
y_pred_proba = bst.predict(dtest, output_margin=False)  # Probabilities if needed
y_pred = bst.predict(dtest)  # Hard labels (argmax for multi-class)

# Compute F1 (macro average treats classes equally)
f1 = f1_score(y_test, y_pred, average='macro')
print(f"F1 Score (macro): {f1:.2f}")

# For binary classification with probabilities, threshold at 0.5:
# y_pred_binary = (y_pred_proba[:, 1] > 0.5).astype(int)
# f1_binary = f1_score(y_test, y_pred_binary)
