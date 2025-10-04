import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import StandardScaler, LabelEncoder
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
warnings.filterwarnings('ignore')

class AnomalyDetectorXGBoost:
    """
    Anomaly Detection using XGBoost for identifying patterns in normal vs anomalous data
    """
    
    def __init__(self, normal_csv_path, anomalous_csv_path, label_column='label'):
        """
        Initialize the anomaly detector
        
        Args:
            normal_csv_path (str): Path to CSV file containing normal data
            anomalous_csv_path (str): Path to CSV file containing anomalous data
            label_column (str): Name of the label column indicating anomaly (default: 'label')
        """
        self.normal_csv_path = normal_csv_path
        self.anomalous_csv_path = anomalous_csv_path
        self.label_column = label_column
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.feature_columns = None
        
    def load_and_prepare_data(self):
        """
        Load data from CSV files and prepare it for training
        
        Returns:
            tuple: (X, y) where X is features and y is labels
        """
        print("Loading data from CSV files...")
        
        # Load normal data
        try:
            normal_data = pd.read_csv(self.normal_csv_path)
            print(f"Normal data shape: {normal_data.shape}")
        except FileNotFoundError:
            print(f"Error: Could not find {self.normal_csv_path}")
            return None, None
        except Exception as e:
            print(f"Error loading normal data: {e}")
            return None, None
            
        # Load anomalous data
        try:
            anomalous_data = pd.read_csv(self.anomalous_csv_path)
            print(f"Anomalous data shape: {anomalous_data.shape}")
        except FileNotFoundError:
            print(f"Error: Could not find {self.anomalous_csv_path}")
            return None, None
        except Exception as e:
            print(f"Error loading anomalous data: {e}")
            return None, None
        
        # Check if label column exists
        if self.label_column not in normal_data.columns:
            print(f"Warning: Label column '{self.label_column}' not found in normal data")
            print(f"Available columns: {list(normal_data.columns)}")
            return None, None
            
        if self.label_column not in anomalous_data.columns:
            print(f"Warning: Label column '{self.label_column}' not found in anomalous data")
            print(f"Available columns: {list(anomalous_data.columns)}")
            return None, None
        
        # Combine datasets
        combined_data = pd.concat([normal_data, anomalous_data], ignore_index=True)
        print(f"Combined data shape: {combined_data.shape}")
        
        # Separate features and labels
        self.feature_columns = [col for col in combined_data.columns if col != self.label_column]
        X = combined_data[self.feature_columns]
        y = combined_data[self.label_column]
        
        # Handle categorical features
        X = self._handle_categorical_features(X)
        
        # Encode labels (assuming 0 for normal, 1 for anomalous)
        y_encoded = self.label_encoder.fit_transform(y)
        
        print(f"Features: {len(self.feature_columns)}")
        print(f"Label distribution: {np.bincount(y_encoded)}")
        
        return X, y_encoded
    
    def _handle_categorical_features(self, X):
        """
        Handle categorical features by encoding them
        
        Args:
            X (DataFrame): Feature matrix
            
        Returns:
            DataFrame: Processed feature matrix
        """
        X_processed = X.copy()
        
        for column in X_processed.columns:
            if X_processed[column].dtype == 'object':
                # Use label encoding for categorical variables
                le = LabelEncoder()
                X_processed[column] = le.fit_transform(X_processed[column].astype(str))
                print(f"Encoded categorical feature: {column}")
        
        return X_processed
    
    def train_model(self, test_size=0.2, random_state=42):
        """
        Train the XGBoost model for anomaly detection
        
        Args:
            test_size (float): Proportion of data to use for testing
            random_state (int): Random state for reproducibility
        """
        print("\nPreparing data for training...")
        X, y = self.load_and_prepare_data()
        
        if X is None or y is None:
            print("Failed to load data. Exiting...")
            return
        
        # Split the data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        print(f"Training set size: {X_train_scaled.shape}")
        print(f"Test set size: {X_test_scaled.shape}")
        
        # Initialize XGBoost model with parameters optimized for anomaly detection
        self.model = xgb.XGBClassifier(
            objective='binary:logistic',
            n_estimators=200,
            learning_rate=0.1,
            max_depth=6,
            min_child_weight=1,
            subsample=0.8,
            colsample_bytree=0.8,
            use_label_encoder=False,
            eval_metric='logloss',
            random_state=random_state
        )
        
        print("\nTraining XGBoost model...")
        self.model.fit(X_train_scaled, y_train)
        
        # Make predictions
        y_pred = self.model.predict(X_test_scaled)
        y_pred_proba = self.model.predict_proba(X_test_scaled)[:, 1]
        
        # Evaluate model
        self._evaluate_model(y_test, y_pred, y_pred_proba)
        
        # Store test data for analysis
        self.X_test = X_test_scaled
        self.y_test = y_test
        self.y_pred = y_pred
        self.y_pred_proba = y_pred_proba
        
        return X_test_scaled, y_test, y_pred, y_pred_proba
    
    def _evaluate_model(self, y_true, y_pred, y_pred_proba):
        """
        Evaluate the model performance
        
        Args:
            y_true: True labels
            y_pred: Predicted labels
            y_pred_proba: Prediction probabilities
        """
        print("\n" + "="*50)
        print("MODEL EVALUATION")
        print("="*50)
        
        # Accuracy
        accuracy = accuracy_score(y_true, y_pred)
        print(f"Accuracy: {accuracy:.4f}")
        
        # Classification report
        print("\nClassification Report:")
        print(classification_report(y_true, y_pred, 
                                  target_names=['Normal', 'Anomalous']))
        
        # Confusion matrix
        cm = confusion_matrix(y_true, y_pred)
        print(f"\nConfusion Matrix:")
        print(f"True Negatives: {cm[0,0]}, False Positives: {cm[0,1]}")
        print(f"False Negatives: {cm[1,0]}, True Positives: {cm[1,1]}")
        
        # Additional metrics
        tn, fp, fn, tp = cm.ravel()
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        print(f"\nPrecision: {precision:.4f}")
        print(f"Recall: {recall:.4f}")
        print(f"F1-Score: {f1_score:.4f}")
    
    def analyze_feature_importance(self, top_n=20):
        """
        Analyze and display feature importance to identify patterns
        
        Args:
            top_n (int): Number of top features to display
        """
        if self.model is None:
            print("Model not trained yet. Please train the model first.")
            return
        
        print("\n" + "="*50)
        print("FEATURE IMPORTANCE ANALYSIS")
        print("="*50)
        
        # Get feature importance
        importance_scores = self.model.feature_importances_
        feature_names = self.feature_columns
        
        # Create importance DataFrame
        importance_df = pd.DataFrame({
            'feature': feature_names,
            'importance': importance_scores
        }).sort_values('importance', ascending=False)
        
        print(f"\nTop {top_n} Most Important Features:")
        print("-" * 40)
        for i, (_, row) in enumerate(importance_df.head(top_n).iterrows()):
            print(f"{i+1:2d}. {row['feature']:<30} {row['importance']:.4f}")
        
        # Visualize feature importance
        plt.figure(figsize=(12, 8))
        top_features = importance_df.head(top_n)
        plt.barh(range(len(top_features)), top_features['importance'])
        plt.yticks(range(len(top_features)), top_features['feature'])
        plt.xlabel('Feature Importance')
        plt.title(f'Top {top_n} Feature Importance for Anomaly Detection')
        plt.gca().invert_yaxis()
        plt.tight_layout()
        plt.show()
        
        return importance_df
    
    def predict_anomaly(self, data_point):
        """
        Predict if a single data point is anomalous
        
        Args:
            data_point: Single data point to predict
            
        Returns:
            tuple: (prediction, probability)
        """
        if self.model is None:
            print("Model not trained yet. Please train the model first.")
            return None, None
        
        # Ensure data point is in correct format
        if isinstance(data_point, (list, np.ndarray)):
            data_point = np.array(data_point).reshape(1, -1)
        elif isinstance(data_point, pd.Series):
            data_point = data_point.values.reshape(1, -1)
        
        # Scale the data point
        data_point_scaled = self.scaler.transform(data_point)
        
        # Make prediction
        prediction = self.model.predict(data_point_scaled)[0]
        probability = self.model.predict_proba(data_point_scaled)[0]
        
        return prediction, probability
    
    def visualize_results(self):
        """
        Create visualizations for the results
        """
        if not hasattr(self, 'y_test'):
            print("No test results available. Please train the model first.")
            return
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        
        # Confusion Matrix
        cm = confusion_matrix(self.y_test, self.y_pred)
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                   xticklabels=['Normal', 'Anomalous'],
                   yticklabels=['Normal', 'Anomalous'], ax=axes[0,0])
        axes[0,0].set_title('Confusion Matrix')
        axes[0,0].set_ylabel('True Label')
        axes[0,0].set_xlabel('Predicted Label')
        
        # Prediction Probabilities Distribution
        axes[0,1].hist(self.y_pred_proba[self.y_test == 0], bins=30, alpha=0.7, 
                      label='Normal', color='blue')
        axes[0,1].hist(self.y_pred_proba[self.y_test == 1], bins=30, alpha=0.7, 
                      label='Anomalous', color='red')
        axes[0,1].set_xlabel('Prediction Probability')
        axes[0,1].set_ylabel('Frequency')
        axes[0,1].set_title('Distribution of Prediction Probabilities')
        axes[0,1].legend()
        
        # Feature Importance (top 10)
        importance_scores = self.model.feature_importances_
        top_10_indices = np.argsort(importance_scores)[-10:]
        top_10_features = [self.feature_columns[i] for i in top_10_indices]
        top_10_scores = importance_scores[top_10_indices]
        
        axes[1,0].barh(range(len(top_10_features)), top_10_scores)
        axes[1,0].set_yticks(range(len(top_10_features)))
        axes[1,0].set_yticklabels(top_10_features)
        axes[1,0].set_xlabel('Importance Score')
        axes[1,0].set_title('Top 10 Feature Importance')
        
        # ROC Curve (simplified)
        from sklearn.metrics import roc_curve, auc
        fpr, tpr, _ = roc_curve(self.y_test, self.y_pred_proba)
        roc_auc = auc(fpr, tpr)
        
        axes[1,1].plot(fpr, tpr, color='darkorange', lw=2, 
                      label=f'ROC curve (AUC = {roc_auc:.2f})')
        axes[1,1].plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
        axes[1,1].set_xlim([0.0, 1.0])
        axes[1,1].set_ylim([0.0, 1.05])
        axes[1,1].set_xlabel('False Positive Rate')
        axes[1,1].set_ylabel('True Positive Rate')
        axes[1,1].set_title('ROC Curve')
        axes[1,1].legend(loc="lower right")
        
        plt.tight_layout()
        plt.show()


def create_sample_data():
    """
    Create sample CSV files for demonstration
    """
    print("Creating sample data files...")
    
    # Create sample normal data
    np.random.seed(42)
    n_normal = 1000
    
    normal_data = pd.DataFrame({
        'feature1': np.random.normal(0, 1, n_normal),
        'feature2': np.random.normal(5, 2, n_normal),
        'feature3': np.random.normal(10, 1.5, n_normal),
        'feature4': np.random.uniform(0, 100, n_normal),
        'feature5': np.random.choice(['A', 'B', 'C'], n_normal),
        'label': 'normal'
    })
    
    # Create sample anomalous data
    n_anomalous = 200
    
    anomalous_data = pd.DataFrame({
        'feature1': np.random.normal(3, 2, n_anomalous),  # Different distribution
        'feature2': np.random.normal(2, 3, n_anomalous),  # Different distribution
        'feature3': np.random.normal(15, 2, n_anomalous), # Different distribution
        'feature4': np.random.uniform(80, 120, n_anomalous), # Different range
        'feature5': np.random.choice(['D', 'E'], n_anomalous), # Different categories
        'label': 'anomalous'
    })
    
    # Save to CSV files
    normal_data.to_csv('normal_data.csv', index=False)
    anomalous_data.to_csv('anomalous_data.csv', index=False)
    
    print("Sample data files created:")
    print("- normal_data.csv")
    print("- anomalous_data.csv")
    
    return 'normal_data.csv', 'anomalous_data.csv'


def main():
    """
    Main function to demonstrate the anomaly detection system
    """
    print("XGBoost Anomaly Detection System")
    print("=" * 50)
    
    # Create sample data if files don't exist
    import os
    if not os.path.exists('normal_data.csv') or not os.path.exists('anomalous_data.csv'):
        normal_file, anomalous_file = create_sample_data()
    else:
        normal_file = 'normal_data.csv'
        anomalous_file = 'anomalous_data.csv'
    
    # Initialize the anomaly detector
    detector = AnomalyDetectorXGBoost(
        normal_csv_path=normal_file,
        anomalous_csv_path=anomalous_file,
        label_column='label'
    )
    
    # Train the model
    detector.train_model()
    
    # Analyze feature importance
    detector.analyze_feature_importance()
    
    # Visualize results
    detector.visualize_results()
    
    # Example prediction
    print("\n" + "="*50)
    print("EXAMPLE PREDICTION")
    print("="*50)
    
    # Create a sample data point for prediction
    sample_point = [2.5, 3.0, 16.0, 90.0, 'D']  # This should be predicted as anomalous
    prediction, probability = detector.predict_anomaly(sample_point)
    
    if prediction is not None:
        label = 'Anomalous' if prediction == 1 else 'Normal'
        print(f"Sample data point: {sample_point}")
        print(f"Prediction: {label}")
        print(f"Probability: {probability}")
        print(f"Confidence: {max(probability):.4f}")


if __name__ == "__main__":
    main()
